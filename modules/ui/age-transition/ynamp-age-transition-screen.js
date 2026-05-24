import ContextManager from '/core/ui/context-manager/context-manager.js';
import NavTray from '/core/ui/navigation-tray/model-navigation-tray.js';
import Panel from '/core/ui/panel-support.js';
import { ScreenProfilePageExternalStatus } from '/core/ui/profile-page/screen-profile-page.js';
import { GetAgeMap } from '/core/ui/shell/create-panels/age-civ-select-model.js';
import { getPlayerCardInfo } from '/core/ui/utilities/utilities-liveops.js';
import { FocusManager } from '/core/ui-next/services/focus-manager.js';
import { InterfaceMode } from '/core/ui/interface-modes/interface-modes.js';
import { YnAMPCustomAgeTransitionSelectionScreen } from './ynamp-age-transition-selection-model.js';
import '/core/ui/framework.js';
import '/core/ui/context-manager/display-queue-manager.js';
import '/core/ui/dialog-box/manager-dialog-box.js';
import '/core/ui/input/cursor.js';
import '/core/ui/views/view-manager.js';
import '/core/ui/input/input-support.js';
import '/core/ui/input/focus-support.js';
import '/core/ui/spatial/spatial-manager.js';
import '/core/ui/shell/shell-components/icon-dropdown.js';
import '/core/ui/components/fxs-activatable.js';

Automation.log("[YnAMP age-Transition] Loading ynamp-age-transition-screen.js");

const screenModuleShellContext = typeof UI.isInShell === 'function' ? UI.isInShell() : 'unknown';
const screenModuleGameContext = typeof UI.isInGame === 'function' ? UI.isInGame() : 'unknown';

Automation.log(
  '[YnAMP age-Transition] Screen module context shell=' + screenModuleShellContext + ' game=' + screenModuleGameContext
);

if (screenModuleShellContext === true) {
  console.warn('[YnAMP age-Transition] Screen module loaded while UI.isInShell() is true.');
}

const styles = 'fs://game/core/ui/shell/age-transition/age-transition-civ-select.css';

class YnAMPAgeTransitionScreen extends Panel {
  isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
  ageMap = GetAgeMap();
  customPlayerListScrollable = document.createElement('fxs-scrollable');
  customBackgroundContainer;
  customPanel = document.createElement('div');
  customPlayerListPanel = document.createElement('div');
  customPlayerList = document.createElement('div');
  customPlayerDetailsPanel = document.createElement('div');
  customPlayerLeader = document.createElement('div');
  customPlayerCivilization = document.createElement('div');
  customPlayerHint = document.createElement('div');
  customPreviousLeaderValue = document.createElement('div');
  customPreviousCivilizationValue = document.createElement('div');
  customUnlockedCivilizations = document.createElement('div');
  customUnlockedEmpty = document.createElement('div');
  customLockedHint = document.createElement('div');
  customLockedCivilizations = document.createElement('div');
  customLockedEmpty = document.createElement('div');
  customBottomBar = document.createElement('div');
  customConfirmButton = document.createElement('fxs-hero-button');
  customPlayerSelectionStates = [];
  customPlayerRows = [];
  selectedCustomPlayerState;
  selectedCustomPlayerRow;
  customHistoricalSnapshots = new Map();
  hydratedCustomPlayerIds = new Set();
  customUnlockedListRenderKey = '';
  customLockedListRenderKey = '';
  isProgressionShown = false;
  engineInputEventListener = this.onEngineInput.bind(this);

  constructor(root) {
    super(root);
    Automation.log('[YnAMP age-Transition] constructor root=' + (root?.tagName ?? 'unknown'));
    this.render();
  }

  onInitialize() {
    super.onInitialize();
    Automation.log('[YnAMP age-Transition] onInitialize root=' + (this.Root?.tagName ?? 'missing'));
    this.Root.classList.add('fullscreen', 'age-transition-civ-select', 'trigger-nav-help', 'ynamp-custom-age-transition');
  }

  onReceiveFocus() {
    super.onReceiveFocus();
    NavTray.clear();
    NavTray.addOrUpdateShellAction1('LOC_END_GAME_TRANSITION');
    this.setPreferredFocus(this.selectedCustomPlayerRow ?? this.customPlayerRows[0] ?? this.Root);
  }

  onAttach() {
    super.onAttach();
    Automation.log('[YnAMP age-Transition] onAttach rootConnected=' + (this.Root?.isConnected ?? false));
    this.Root.addEventListener('engine-input', this.engineInputEventListener);
  }

  onDetach() {
    this.Root.removeEventListener('engine-input', this.engineInputEventListener);
    NavTray.clear();
    super.onDetach();
  }

  setPreferredFocus(target) {
    if (!target) {
      return;
    }
    if (typeof FocusManager?.get === 'function') {
      FocusManager.get().setFocus(target);
      return;
    }
    FocusManager.setFocus?.(target);
  }

  onEngineInput(inputEvent) {
    if (inputEvent.detail.status != InputActionStatuses.FINISH) {
      return;
    }
    switch (inputEvent.detail.name) {
      case 'sys-menu':
        this.showProgression();
        inputEvent.stopPropagation();
        inputEvent.preventDefault();
        break;
      case 'shell-action-1':
        this.startCustomGame();
        inputEvent.stopPropagation();
        inputEvent.preventDefault();
        break;
    }
  }

  showProgression() {
    if (this.isProgressionShown && Network.isMetagamingAvailable()) {
      ScreenProfilePageExternalStatus.isGameCreationDomainInitialized = true;
      ContextManager.push('screen-profile-page', {
        singleton: true,
        createMouseGuard: true,
        panelOptions: { onlyChallenges: false, onlyLeaderboards: false }
      });
    }
  }

  setPlayerParameterValue(playerId, parameterId, value) {
    const setupParam = GameSetup.findPlayerParameter(playerId, parameterId);
    const previousValue = setupParam?.value?.value ?? null;
    Automation.log(
      `[YnAMP age-Transition] setPlayerParameterValue player=${playerId} parameter=${parameterId} previous=${previousValue ?? 'unset'} next=${value} found=${!!setupParam}`
    );
    let didAttemptWrite = false;
    if (typeof setupParam?.setValue === 'function') {
      didAttemptWrite = true;
      setupParam.setValue(value);
      const readbackValue = GameSetup.findPlayerParameter(playerId, parameterId)?.value?.value ?? null;
      Automation.log(
        `[YnAMP age-Transition] setPlayerParameterValue method=setValue player=${playerId} parameter=${parameterId} readback=${readbackValue ?? 'unset'} confirmed=${readbackValue == value}`
      );
      if (readbackValue == value) {
        return true;
      }
    }
    if (typeof GameSetup.setPlayerParameterValue === 'function') {
      didAttemptWrite = true;
      GameSetup.setPlayerParameterValue(playerId, parameterId, value);
      const readbackValue = GameSetup.findPlayerParameter(playerId, parameterId)?.value?.value ?? null;
      Automation.log(
        `[YnAMP age-Transition] setPlayerParameterValue method=GameSetup.setPlayerParameterValue player=${playerId} parameter=${parameterId} readback=${readbackValue ?? 'unset'} confirmed=${readbackValue == value}`
      );
      return true;
    }
    if (didAttemptWrite) {
      return true;
    }
    console.warn(`[YnAMP] Unable to set player parameter ${parameterId} for player ${playerId}.`);
    Automation.log(
      `[YnAMP age-Transition] setPlayerParameterValue failed player=${playerId} parameter=${parameterId} next=${value}`
    );
    return false;
  }

  render() {
    Automation.log('[YnAMP age-Transition] render() invoked.');
    const container = document.createElement('div');
    container.classList.add('relative', 'w-full', 'h-full', 'flow-column');

    const filigreeLeft = document.createElement('div');
    filigreeLeft.classList.add(
      'age-transition-filigree',
      'img-frame-filigree',
      'w-187',
      'h-187',
      'top-4',
      'left-4',
      'pointer-events-none',
      'absolute'
    );
    container.appendChild(filigreeLeft);

    const filigreeRight = document.createElement('div');
    filigreeRight.classList.add(
      'age-transition-filigree',
      'img-frame-filigree',
      'w-187',
      'h-187',
      '-scale-x-100',
      'top-4',
      'right-4',
      'pointer-events-none',
      'absolute'
    );
    container.appendChild(filigreeRight);

    this.renderHeader(container);
    this.renderYnAMPLayout(container);
    this.Root.appendChild(container);
  }

  renderHeader(container) {
    const header = document.createElement('div');
    header.classList.add('flex', 'flex-row', 'relative', 'items-center', 'justify-center');

    const ageHeader = document.createElement('div');
    ageHeader.classList.add('flex', 'flex-col', 'justify-center', 'items-center');
    ageHeader.classList.toggle('mt-8', this.isMobileViewExperience);
    ageHeader.classList.toggle('mt-5', !this.isMobileViewExperience);
    header.appendChild(ageHeader);

    const ageType = GameSetup.findGameParameter('Age')?.value.value?.toString() ?? '';
    const ageTitle = document.createElement('fxs-header');
    ageTitle.classList.add('font-title-2xl', 'uppercase');
    ageTitle.setAttribute('filigree-style', 'none');
    ageTitle.setAttribute(
      'title',
      Locale.compose('LOC_CREATE_GAME_AGE_TITLE', this.ageMap.get(ageType)?.name ?? '')
    );
    ageHeader.appendChild(ageTitle);

    const ageDesc = document.createElement('fxs-header');
    ageDesc.classList.add('font-title-lg', 'uppercase');
    ageDesc.setAttribute('filigree-style', 'h3');
    ageDesc.setAttribute('title', 'LOC_AGE_TRANSITION_SCREEN_TITLE');
    ageHeader.appendChild(ageDesc);

    if (Network.supportsSSO() && Network.isMetagamingAvailable()) {
      const playerInfo = getPlayerCardInfo();
      this.isProgressionShown = true;
      const progressionBadgeBg = document.createElement('fxs-activatable');
      progressionBadgeBg.classList.add('absolute', 'right-12', 'top-12', 'w-22', 'h-22');
      progressionBadgeBg.addEventListener('action-activate', this.showProgression.bind(this));
      header.appendChild(progressionBadgeBg);
      progressionBadgeBg.innerHTML = `
				<div class="w-22 h-22 img-prof-btn-bg pointer-events-auto relative transition-transform hover\\:scale-110 focus\\:scale-110" data-tooltip-content="${playerInfo.twoKName}">
					<div class="absolute inset-0 opacity-30" style="background-color: ${playerInfo.BackgroundColor}"></div>
					<progression-badge class="absolute inset-y-0 -inset-x-0\\.5" badge-size="base" data-badge-url="${playerInfo.BadgeURL}" data-badge-progression-level="${playerInfo.FoundationLevel}"></progression-badge>
				</div>
			`;
      const progressionBadgeNavHelp = document.createElement('fxs-nav-help');
      progressionBadgeNavHelp.classList.add('absolute', '-bottom-3', '-right-6');
      progressionBadgeNavHelp.setAttribute('action-key', 'inline-sys-menu');
      progressionBadgeBg.appendChild(progressionBadgeNavHelp);
    }

    container.appendChild(header);
  }

  renderYnAMPLayout(container) {
    Automation.log('[YnAMP age-Transition] renderYnAMPLayout start.');
    this.customBackgroundContainer = container;
    const bridgePayload = YnAMPCustomAgeTransitionSelectionScreen.getAgeTransitionBridgePayload();
    this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    YnAMPCustomAgeTransitionSelectionScreen.clearCivilizationAvailabilityCache();
    Automation.log(
      '[YnAMP age-Transition] renderYnAMPLayout players='
        + this.customPlayerSelectionStates.length
        + ' bridgeSource='
        + (bridgePayload?.source ?? 'none')
        + ' bridgeStatus='
        + (bridgePayload?.payload?.status ?? 'missing')
    );
    this.hydrateCustomPlayerCivilizations();
    this.captureCustomHistoricalSnapshots();
    this.customBackgroundContainer.style.backgroundRepeat = 'no-repeat';
    this.customBackgroundContainer.style.backgroundPosition = 'center';
    this.customBackgroundContainer.style.backgroundSize = 'cover';
    this.customPanel.className = '';
    this.customPanel.innerHTML = '';
    this.customPanel.classList.add(
      'flex',
      'flex-row',
      'items-stretch',
      'flex-auto',
      'mx-13',
      'mb-4',
      'gap-4'
    );
    container.appendChild(this.customPanel);
    this.renderYnAMPPlayerList();
    this.renderYnAMPPlayerDetails();
    this.customPanel.appendChild(this.customPlayerListPanel);
    this.customPanel.appendChild(this.customPlayerDetailsPanel);
    this.renderYnAMPBottomBar(container);
    if (this.customPlayerSelectionStates.length > 0) {
      this.selectCustomPlayer(0);
    } else {
      this.updateCustomPlayerDetails();
    }
  }

  ensureValidCustomPlayerCivilization(playerId) {
    if (playerId == null || !this.canEditCustomPlayer(playerId)) {
      return false;
    }
    const civilizationSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
    );
    if (YnAMPCustomAgeTransitionSelectionScreen.isPlayerCivilizationSelectionValid(playerId)) {
      return false;
    }
    const currentCivilizationId = civilizationSelection?.valueId ?? null;
    const preferredCivilization = YnAMPCustomAgeTransitionSelectionScreen.getPreferredUnlockedCivilizationForPlayer(playerId);
    if (!preferredCivilization || preferredCivilization == currentCivilizationId) {
      return false;
    }
    Automation.log(
      `[YnAMP age-Transition] ensureValidCustomPlayerCivilization repair player=${playerId} current=${currentCivilizationId ?? 'unset'} replacement=${preferredCivilization}`
    );
    const didSet = this.setPlayerParameterValue(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter,
      preferredCivilization
    );
    if (didSet) {
      YnAMPCustomAgeTransitionSelectionScreen.clearCivilizationAvailabilityCache(playerId);
    }
    return didSet;
  }

  applyInitialCustomPlayerCivilizationDefault(playerId) {
    if (playerId == null || !this.canEditCustomPlayer(playerId)) {
      return false;
    }
    const defaultCivilization = YnAMPCustomAgeTransitionSelectionScreen.getDefaultWeightedCivilizationForPlayer(playerId);
    if (!defaultCivilization) {
      return false;
    }
    const civilizationSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
    );
    if (civilizationSelection?.valueId == defaultCivilization) {
      return false;
    }
    const didSet = this.setPlayerParameterValue(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter,
      defaultCivilization
    );
    if (didSet) {
      YnAMPCustomAgeTransitionSelectionScreen.clearCivilizationAvailabilityCache(playerId);
    }
    return didSet;
  }

  hydrateCustomPlayerCivilizations() {
    let hasChanges = false;
    for (const playerState of this.customPlayerSelectionStates) {
      if (this.hydratedCustomPlayerIds.has(playerState.playerId)) {
        continue;
      }
      this.hydratedCustomPlayerIds.add(playerState.playerId);
      hasChanges = this.applyInitialCustomPlayerCivilizationDefault(playerState.playerId) || hasChanges;
      hasChanges = this.ensureValidCustomPlayerCivilization(playerState.playerId) || hasChanges;
    }
    if (hasChanges) {
      this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    }
  }

  renderYnAMPPlayerList() {
    this.customPlayerRows = [];
    this.customPlayerListPanel.className = '';
    this.customPlayerListPanel.innerHTML = '';
    this.customPlayerListPanel.classList.add(
      'img-unit-panelbox',
      'bg-cover',
      'flex',
      'flex-col',
      'flex-2',
      'shrink-0',
      'pointer-events-auto',
      'px-4',
      'py-3'
    );
    this.customPlayerListPanel.style.minHeight = '0';

    const columns = document.createElement('div');
    columns.classList.add('flex', 'mt-3', 'ml-18', 'mr-10', 'gap-6');

    const leaderColumn = document.createElement('div');
    leaderColumn.setAttribute('data-l10n-id', 'LOC_GENERIC_LEADER');
    leaderColumn.classList.add('font-title', 'uppercase', 'tracking-150', 'pointer-events-auto');
    leaderColumn.style.width = '25vw';
    leaderColumn.setAttribute('role', 'columnheader');
    columns.appendChild(leaderColumn);

    const civColumn = document.createElement('div');
    civColumn.setAttribute('data-l10n-id', 'LOC_GENERIC_CIVILIZATION');
    civColumn.classList.add('font-title', 'uppercase', 'tracking-150', 'pointer-events-auto');
    civColumn.style.width = '25vw';
    civColumn.setAttribute('role', 'columnheader');
    columns.appendChild(civColumn);

    this.customPlayerListPanel.appendChild(columns);

    this.customPlayerListScrollable.className = '';
    this.customPlayerListScrollable.innerHTML = '';
    this.customPlayerListScrollable.classList.add('flex-auto');
    this.customPlayerListScrollable.style.minHeight = '0';
    this.customPlayerListScrollable.setAttribute('attached-scrollbar', 'true');
    this.customPlayerListScrollable.setAttribute('handle-gamepad-pan', 'true');

    this.customPlayerList.className = '';
    this.customPlayerList.innerHTML = '';
    this.customPlayerList.classList.add('pointer-events-auto');

    this.customPlayerSelectionStates.forEach((playerState, index) => {
      const leaderSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
        playerState.playerId,
        YnAMPCustomAgeTransitionSelectionScreen.playerLeaderParameter
      );
      const civilizationSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
        playerState.playerId,
        YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
      );
      const row = document.createElement('div');
      row.setAttribute('ignore-prior-focus', 'true');
      row.setAttribute('tabindex', '-1');
      row.classList.add(
        'items-center',
        'my-1',
        'py-2',
        'bg-primary-5',
        'flex',
        'relative',
        'flex-nowrap',
        'pointer-events-auto',
        'items-center'
      );
      row.addEventListener('click', () => this.selectCustomPlayer(index));
      row.addEventListener('focusin', () => this.selectCustomPlayer(index));

      const playerLabel = document.createElement('div');
      playerLabel.classList.add('w-12', 'm-2', 'text-center', 'text-base', 'font-title');
      playerLabel.innerHTML = Locale.toNumber(index + 1);
      row.appendChild(playerLabel);

      const selections = document.createElement('div');
      selections.classList.add('flex', 'flex-row', 'flex-auto');
      row.appendChild(selections);

      const leaderDropdown = this.createCustomRowDropdown(
        leaderSelection,
        playerState.playerId,
        () => this.selectCustomPlayer(index),
        undefined,
        true
      );
      const civilizationDropdown = this.createCustomRowDropdown(
        civilizationSelection,
        playerState.playerId,
        () => this.selectCustomPlayer(index),
        (event) => this.handleCustomCivilizationSelection(event, playerState.playerId),
        false
      );
      selections.appendChild(leaderDropdown);
      selections.appendChild(civilizationDropdown);

      const deleteIconSpacer = document.createElement('fxs-activatable');
      deleteIconSpacer.setAttribute('tabindex', '-1');
      deleteIconSpacer.classList.add('close-button__bg', 'group', 'relative', 'm-2', 'w-8', 'h-8', 'invisible');
      row.appendChild(deleteIconSpacer);

      this.customPlayerRows.push(row);
      this.customPlayerList.appendChild(row);
    });

    this.customPlayerListScrollable.appendChild(this.customPlayerList);
    this.customPlayerListPanel.appendChild(this.customPlayerListScrollable);
  }

  renderYnAMPPlayerDetails() {
    this.customPlayerDetailsPanel.className = '';
    this.customPlayerDetailsPanel.innerHTML = '';
    this.customPlayerDetailsPanel.classList.add(
      'img-unit-panelbox',
      'bg-cover',
      'flex',
      'flex-col',
      'flex-1',
      'shrink-0',
      'pointer-events-auto',
      'px-6',
      'py-4'
    );

    this.customPlayerLeader.className = '';
    this.customPlayerLeader.classList.add('font-body-base', 'mb-2', 'uppercase');
    this.customPlayerLeader.textContent = 'Previous Era Leader';
    this.customPlayerDetailsPanel.appendChild(this.customPlayerLeader);

    this.customPreviousLeaderValue.className = '';
    this.customPreviousLeaderValue.classList.add('font-title-base', 'text-accent-2', 'mb-4');
    this.customPlayerDetailsPanel.appendChild(this.customPreviousLeaderValue);

    this.customPlayerCivilization.className = '';
    this.customPlayerCivilization.classList.add('font-body-base', 'mb-2', 'uppercase');
    this.customPlayerCivilization.textContent = 'Previous Era Civilization';
    this.customPlayerDetailsPanel.appendChild(this.customPlayerCivilization);

    this.customPreviousCivilizationValue.className = '';
    this.customPreviousCivilizationValue.classList.add('font-title-base', 'text-accent-2', 'mb-4');
    this.customPlayerDetailsPanel.appendChild(this.customPreviousCivilizationValue);

    this.customPlayerHint.className = '';
    this.customPlayerHint.classList.add('font-body-base', 'mt-2', 'uppercase');
    this.customPlayerHint.textContent = 'Unlocked Next Era Civilizations';
    this.customPlayerDetailsPanel.appendChild(this.customPlayerHint);

    this.customUnlockedCivilizations.className = '';
    this.customUnlockedCivilizations.classList.add('flex', 'flex-col', 'gap-2', 'mt-3', 'mb-4');
    this.customPlayerDetailsPanel.appendChild(this.customUnlockedCivilizations);

    this.customUnlockedEmpty.className = '';
    this.customUnlockedEmpty.classList.add('font-body-sm', 'text-secondary-2');
    this.customUnlockedEmpty.textContent = 'No unlocked civilizations available.';
    this.customPlayerDetailsPanel.appendChild(this.customUnlockedEmpty);

    this.customLockedHint.className = '';
    this.customLockedHint.classList.add('font-body-base', 'mt-2', 'uppercase');
    this.customLockedHint.textContent = 'Locked Next Era Civilizations';
    this.customPlayerDetailsPanel.appendChild(this.customLockedHint);

    this.customLockedCivilizations.className = '';
    this.customLockedCivilizations.classList.add('flex', 'flex-col', 'gap-2', 'mt-3', 'mb-4');
    this.customPlayerDetailsPanel.appendChild(this.customLockedCivilizations);

    this.customLockedEmpty.className = '';
    this.customLockedEmpty.classList.add('font-body-sm', 'text-secondary-2');
    this.customLockedEmpty.textContent = 'No locked civilizations.';
    this.customPlayerDetailsPanel.appendChild(this.customLockedEmpty);
  }

  renderYnAMPBottomBar(container) {
    this.customBottomBar.className = '';
    this.customBottomBar.innerHTML = '';
    this.customBottomBar.classList.add('flow-row', 'justify-center', 'items-center', 'mb-6', 'mt-2');
    this.customConfirmButton.className = '';
    this.customConfirmButton.classList.add('min-w-80');
    this.customConfirmButton.setAttribute('caption', 'LOC_END_GAME_TRANSITION');
    this.customConfirmButton.setAttribute('data-audio-group-ref', 'new-civ-select');
    this.customConfirmButton.setAttribute('data-audio-activate-ref', 'data-audio-choose-civ-activate');
    this.customConfirmButton.addEventListener('action-activate', this.startCustomGame.bind(this));
    this.customBottomBar.appendChild(this.customConfirmButton);
    container.appendChild(this.customBottomBar);
  }

  createCustomRowDropdown(selectionData, playerId, onFocus, onSelection, forceDisabled = false) {
    const dropdown = document.createElement('icon-dropdown');
    dropdown.classList.add('advanced-options__player-select', 'mx-2');
    dropdown.style.width = '25vw';
    dropdown.style.flexShrink = '0';
    dropdown.setAttribute('show-label-on-selected-item', 'true');
    dropdown.setAttribute('show-icon-on-list-item', 'true');
    const possibleValues = selectionData?.possibleValues ?? [];
    dropdown.whenComponentCreated((component) => component.updateDropdownItems(possibleValues));
    const selectedIndex = possibleValues.findIndex((value) => value.id == selectionData?.valueId);
    const defaultWeightedCivilizationId = selectionData?.parameterId === YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
      ? YnAMPCustomAgeTransitionSelectionScreen.getDefaultWeightedCivilizationForPlayer(playerId)
      : null;
    const defaultWeightedIndex = defaultWeightedCivilizationId
      ? possibleValues.findIndex((value) => value.id == defaultWeightedCivilizationId)
      : -1;
    const fallbackCivilizationId = selectionData?.parameterId === YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
      ? YnAMPCustomAgeTransitionSelectionScreen.getBridgeFallbackCivilizationId(playerId)
      : null;
    const fallbackIndex = fallbackCivilizationId
      ? possibleValues.findIndex((value) => value.id == fallbackCivilizationId)
      : -1;
    const resolvedIndex = selectedIndex >= 0
      ? selectedIndex
      : defaultWeightedIndex >= 0
        ? defaultWeightedIndex
        : fallbackIndex >= 0
          ? fallbackIndex
          : 0;
    dropdown.setAttribute('selected-item-index', resolvedIndex.toString());
    if (!selectionData || selectionData.readOnly || forceDisabled) {
      dropdown.setAttribute('disabled', 'true');
    }
    if (!forceDisabled) {
      dropdown.addEventListener('focusin', onFocus);
      dropdown.addEventListener('click', onFocus);
      if (onSelection) {
        dropdown.addEventListener('dropdown-selection-change', onSelection);
      }
    }
    dropdown.setAttribute('data-player-id', playerId.toString());
    return dropdown;
  }

  clearCustomCivilizationEntries() {
    this.customUnlockedCivilizations.innerHTML = '';
    this.customLockedCivilizations.innerHTML = '';
    this.customUnlockedListRenderKey = '';
    this.customLockedListRenderKey = '';
  }

  buildCustomCivilizationListKey(civilizations) {
    return civilizations
      .map((civilization) => `${civilization.civilizationId}:${civilization.isLocked ? 1 : 0}:${civilization.label}`)
      .join('|');
  }

  renderCustomCivilizationEntries(container, civilizations, emptyElement, cacheProperty) {
    const listKey = this.buildCustomCivilizationListKey(civilizations);
    emptyElement.classList.toggle('hidden', civilizations.length > 0);
    if (this[cacheProperty] === listKey) {
      return;
    }
    this[cacheProperty] = listKey;
    container.innerHTML = '';
    for (const civilization of civilizations) {
      const civilizationEntry = document.createElement('div');
      civilizationEntry.classList.add('flex', 'flex-row', 'items-center', 'justify-between', 'gap-3');
      const civilizationLabel = document.createElement('div');
      civilizationLabel.classList.add('min-w-0', 'grow');
      civilizationLabel.classList.add('font-body-base', civilization.isUnlocked ? 'text-secondary-1' : 'text-accent-2');
      civilizationLabel.textContent = civilization.label;
      civilizationEntry.appendChild(civilizationLabel);
      container.appendChild(civilizationEntry);
    }
  }

  formatHistoricalTransitionValue(sourceLabel, preferredCivilizationLabel) {
    const primaryLabel = this.formatCustomSelectionValue(sourceLabel);
    if (!preferredCivilizationLabel) {
      return primaryLabel;
    }
    return `${primaryLabel} [ICON_Action_Move] ${preferredCivilizationLabel}`;
  }

  updateCustomBackground() {
    if (!this.customBackgroundContainer) {
      return;
    }
    const civilizationId = this.selectedCustomPlayerState?.civilizationId ?? null;
    if (!civilizationId || civilizationId === 'RANDOM') {
      this.customBackgroundContainer.style.backgroundImage = '';
      return;
    }
    const civNameOnly = civilizationId.replace('CIVILIZATION_', '').toLowerCase();
    this.customBackgroundContainer.style.backgroundImage =
      `linear-gradient(rgba(5, 7, 13, 0.7), rgba(5, 7, 13, 0.82)), url('fs://game/bg-card-${civNameOnly}.png')`;
  }

  formatCustomSelectionValue(value) {
    return value ?? 'Unassigned';
  }

  captureCustomHistoricalSnapshots() {
    const activePlayerIds = new Set(this.customPlayerSelectionStates.map((playerState) => playerState.playerId));
    for (const playerState of this.customPlayerSelectionStates) {
      if (!this.customHistoricalSnapshots.has(playerState.playerId)) {
        this.customHistoricalSnapshots.set(
          playerState.playerId,
          YnAMPCustomAgeTransitionSelectionScreen.getHistoricalSnapshot(playerState.playerId)
        );
      }
    }
    for (const playerId of Array.from(this.customHistoricalSnapshots.keys())) {
      if (!activePlayerIds.has(playerId)) {
        this.customHistoricalSnapshots.delete(playerId);
      }
    }
  }

  selectCustomPlayer(index) {
    const playerState = this.customPlayerSelectionStates[index];
    if (!playerState) {
      return;
    }
    this.selectedCustomPlayerState = playerState;
    this.selectedCustomPlayerRow = this.customPlayerRows[index];
    this.customPlayerRows.forEach((row, rowIndex) => {
      row.classList.toggle('selected', rowIndex === index);
      row.classList.toggle('img-dropdown-box-focus', rowIndex === index);
    });
    this.updateCustomBackground();
    this.updateCustomPlayerDetails();
  }

  refreshCustomPlayerSelectionStates(selectedPlayerId = this.selectedCustomPlayerState?.playerId) {
    let hasSelectionChanges = false;
    const changedPlayerId = arguments.length > 1 ? arguments[1] : null;
    if (changedPlayerId == null) {
      YnAMPCustomAgeTransitionSelectionScreen.clearCivilizationAvailabilityCache();
    } else {
      YnAMPCustomAgeTransitionSelectionScreen.clearCivilizationAvailabilityCache(changedPlayerId);
    }
    Automation.log(
      `[YnAMP age-Transition] refreshCustomPlayerSelectionStates start selected=${selectedPlayerId ?? 'none'} changed=${changedPlayerId ?? 'all'}`
    );
    for (const playerState of this.customPlayerSelectionStates) {
      hasSelectionChanges = this.ensureValidCustomPlayerCivilization(playerState.playerId) || hasSelectionChanges;
    }
    this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    this.customPlayerSelectionStates.forEach((playerState, index) => {
      const row = this.customPlayerRows[index];
      if (!row) {
        return;
      }
      const dropdowns = row.querySelectorAll('icon-dropdown');
      const civDropdown = dropdowns[1];
      if (civDropdown) {
        const civSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
          playerState.playerId,
          YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
        );
        if (civSelection) {
          civDropdown.whenComponentCreated((component) => component.updateDropdownItems(civSelection.possibleValues));
          const newIndex = civSelection.possibleValues.findIndex((value) => value.id === civSelection.valueId);
          const defaultWeightedCivilizationId = YnAMPCustomAgeTransitionSelectionScreen.getDefaultWeightedCivilizationForPlayer(playerState.playerId);
          const defaultWeightedIndex = defaultWeightedCivilizationId
            ? civSelection.possibleValues.findIndex((value) => value.id === defaultWeightedCivilizationId)
            : -1;
          const fallbackCivilizationId = YnAMPCustomAgeTransitionSelectionScreen.getBridgeFallbackCivilizationId(playerState.playerId);
          const fallbackIndex = fallbackCivilizationId
            ? civSelection.possibleValues.findIndex((value) => value.id === fallbackCivilizationId)
            : -1;
          const resolvedIndex = newIndex >= 0
            ? newIndex
            : defaultWeightedIndex >= 0
              ? defaultWeightedIndex
              : fallbackIndex >= 0
                ? fallbackIndex
                : 0;
          civDropdown.setAttribute('selected-item-index', resolvedIndex.toString());
        }
      }
    });
    if (hasSelectionChanges) {
      this.captureCustomHistoricalSnapshots();
    }
    Automation.log(
      `[YnAMP age-Transition] refreshCustomPlayerSelectionStates end selected=${selectedPlayerId ?? 'none'} changed=${changedPlayerId ?? 'all'} activePlayers=${this.customPlayerSelectionStates.length} repaired=${hasSelectionChanges}`
    );
    if (selectedPlayerId == null) {
      this.selectedCustomPlayerState = undefined;
      this.selectedCustomPlayerRow = undefined;
      this.updateCustomPlayerDetails();
      return;
    }
    const selectedIndex = this.customPlayerSelectionStates.findIndex((playerState) => playerState.playerId === selectedPlayerId);
    if (selectedIndex >= 0) {
      this.selectCustomPlayer(selectedIndex);
    } else {
      this.selectedCustomPlayerState = undefined;
      this.selectedCustomPlayerRow = undefined;
      this.updateCustomPlayerDetails();
    }
  }

  updateCustomPlayerDetails() {
    if (!this.selectedCustomPlayerState) {
      this.customPreviousLeaderValue.textContent = 'Unavailable';
      this.customPreviousCivilizationValue.textContent = 'Unavailable';
      this.clearCustomCivilizationEntries();
      this.customUnlockedEmpty.classList.remove('hidden');
      this.customLockedEmpty.classList.remove('hidden');
      this.customConfirmButton.removeAttribute('disabled');
      this.updateCustomBackground();
      return;
    }
    const historicalSnapshot = this.customHistoricalSnapshots.get(this.selectedCustomPlayerState.playerId);
    const civilizationEntries = YnAMPCustomAgeTransitionSelectionScreen.getCivilizationEntriesForPlayer(
      this.selectedCustomPlayerState.playerId
    );
    const unlockedCivilizations = [];
    const lockedCivilizations = [];
    for (const civilization of civilizationEntries) {
      if (civilization.isLocked) {
        lockedCivilizations.push(civilization);
      } else {
        unlockedCivilizations.push(civilization);
      }
    }
    this.customPreviousLeaderValue.textContent = this.formatHistoricalTransitionValue(
      historicalSnapshot?.previousLeaderLabel,
      historicalSnapshot?.preferredCivilizationLabel
    );
    this.customPreviousCivilizationValue.textContent = this.formatHistoricalTransitionValue(
      historicalSnapshot?.previousCivilizationLabel,
      historicalSnapshot?.preferredCivilizationLabel
    );
    this.renderCustomCivilizationEntries(
      this.customUnlockedCivilizations,
      unlockedCivilizations,
      this.customUnlockedEmpty,
      'customUnlockedListRenderKey'
    );
    this.renderCustomCivilizationEntries(
      this.customLockedCivilizations,
      lockedCivilizations,
      this.customLockedEmpty,
      'customLockedListRenderKey'
    );
    this.customConfirmButton.removeAttribute('disabled');
  }

  canEditCustomPlayer(playerId) {
    const gameConfig = Configuration.editGame?.();
    const playerConfig = Configuration.editPlayer?.(playerId);
    if (!gameConfig || !playerConfig) {
      console.warn(`[YnAMP] Unable to edit game or player config for player ${playerId}`);
      return false;
    }
    return true;
  }

  handleCustomCivilizationSelection(event, playerId = this.selectedCustomPlayerState?.playerId) {
    if (playerId == null) {
      return;
    }
    const selectionData = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
    );
    const nextValue = selectionData?.possibleValues[event.detail.selectedIndex];
    const previousValue = selectionData?.valueId ?? null;
    Automation.log(
      `[YnAMP age-Transition] handleCustomCivilizationSelection player=${playerId} selectedIndex=${event.detail.selectedIndex} previous=${previousValue ?? 'unset'} next=${nextValue?.id ?? 'missing'}`
    );
    if (!nextValue || nextValue.disabled || !this.canEditCustomPlayer(playerId)) {
      Automation.log(
        `[YnAMP age-Transition] handleCustomCivilizationSelection skipped player=${playerId} next=${nextValue?.id ?? 'missing'} canEdit=${this.canEditCustomPlayer(playerId)}`
      );
      return;
    }
    if (nextValue.id == previousValue) {
      Automation.log(
        `[YnAMP age-Transition] handleCustomCivilizationSelection noop player=${playerId} value=${nextValue.id}`
      );
      return;
    }
    const didSet = this.setPlayerParameterValue(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter,
      nextValue.id
    );
    const readbackValue = GameSetup.findPlayerParameter(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
    )?.value?.value ?? null;
    Automation.log(
      `[YnAMP age-Transition] handleCustomCivilizationSelection result player=${playerId} didSet=${didSet} readback=${readbackValue ?? 'unset'}`
    );
    if (!didSet) {
      return;
    }
    this.refreshCustomPlayerSelectionStates(playerId, playerId);
  }

  getCustomAgeTransitionSelectionValue(playerId) {
    return GameSetup.findPlayerParameter(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
    )?.value?.value ?? null;
  }

  getCustomAgeTransitionSubmitPlayerIds() {
    const orderedPlayerIds = [];
    const seenPlayerIds = new Set();
    let hasLocalPlayer = false;
    for (const playerState of this.customPlayerSelectionStates) {
      const playerId = playerState?.playerId;
      if (playerId == null || seenPlayerIds.has(playerId)) {
        continue;
      }
      seenPlayerIds.add(playerId);
      if (playerId === GameContext.localPlayerID) {
        hasLocalPlayer = true;
        continue;
      }
      orderedPlayerIds.push(playerId);
    }
    if (hasLocalPlayer || !seenPlayerIds.has(GameContext.localPlayerID)) {
      orderedPlayerIds.push(GameContext.localPlayerID);
    }
    return orderedPlayerIds;
  }

  tryCompleteAgeTransitionForPlayer(playerId) {
    const args = { Finished: true };
    const civilizationId = this.getCustomAgeTransitionSelectionValue(playerId);
    const isLocalPlayer = playerId === GameContext.localPlayerID;
    Automation.log(
      `[YnAMP age-Transition] tryCompleteAgeTransition player=${playerId} local=${isLocalPlayer} civilization=${civilizationId ?? 'unset'}`
    );
    const result = Game.PlayerOperations.canStart(
      playerId,
      PlayerOperationTypes.SET_AGE_TRANSITION_DATA,
      args,
      false
    );
    Automation.log(
      `[YnAMP age-Transition] tryCompleteAgeTransition canStart player=${playerId} local=${isLocalPlayer} success=${result?.Success === true} failure=${result?.FailureReason ?? 'none'}`
    );
    if (!result?.Success) {
      console.warn(`[YnAMP] Age transition completion request failed for player ${playerId}.`, result);
      return false;
    }
    Game.PlayerOperations.sendRequest(
      playerId,
      PlayerOperationTypes.SET_AGE_TRANSITION_DATA,
      args
    );
    Automation.log(
      `[YnAMP age-Transition] tryCompleteAgeTransition sendRequest player=${playerId} local=${isLocalPlayer}`
    );
    return true;
  }

  tryCompleteAgeTransition(playerIds = this.getCustomAgeTransitionSubmitPlayerIds()) {
    let didCompleteLocalPlayer = false;
    Automation.log(
      `[YnAMP age-Transition] tryCompleteAgeTransition submitOrder=${playerIds.join(',')}`
    );
    for (const playerId of playerIds) {
      const didCompletePlayer = this.tryCompleteAgeTransitionForPlayer(playerId);
      if (playerId === GameContext.localPlayerID) {
        didCompleteLocalPlayer = didCompletePlayer;
      }
    }
    if (didCompleteLocalPlayer) {
      InterfaceMode.switchToDefault();
    }
    return didCompleteLocalPlayer;
  }

  startCustomGame() {
    this.refreshCustomPlayerSelectionStates();
    this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    Telemetry.sendAgeTransitionCivSelectionComplete();
    const submitPlayerIds = this.getCustomAgeTransitionSubmitPlayerIds();
    const playerCivilizations = submitPlayerIds
      .map((playerId) => `${playerId}:${this.getCustomAgeTransitionSelectionValue(playerId) ?? 'unset'}`)
      .join(',');
    const localCivilization = this.getCustomAgeTransitionSelectionValue(GameContext.localPlayerID);
    Automation.log(
      `[YnAMP age-Transition] startCustomGame submitOrder=${submitPlayerIds.join(',')} civilizations=${playerCivilizations}`
    );
    if (localCivilization?.startsWith('CIVILIZATION_')) {
      const civName = localCivilization.slice(13).toLowerCase();
      UI.sendAudioEvent('age-end-civ-select' + civName);
      Sound.onNextCivSelect(civName);
    }
    const didComplete = this.tryCompleteAgeTransition(submitPlayerIds);
    Automation.log(`[YnAMP age-Transition] startCustomGame completed=${didComplete}`);
  }
}

Controls.define('ynamp-age-transition-screen', {
  createInstance: YnAMPAgeTransitionScreen,
  description: 'YnAMP in-game age transition screen.',
  styles: [styles],
  tabIndex: -1
});

export { YnAMPAgeTransitionScreen as default };