import { A as Audio } from '../../audio-base/audio-support.chunk.js';
import ContextManager from '../../context-manager/context-manager.js';
import ActionHandler, { ActiveDeviceTypeChangedEventName } from '../../input/action-handler.js';
import FocusManager from '../../input/focus-manager.js';
import { N as NavTray } from '../../navigation-tray/model-navigation-tray.chunk.js';
import { P as Panel } from '../../panel-support.chunk.js';
import { ScreenProfilePageExternalStatus } from '../../profile-page/screen-profile-page.js';
import { AgeTransitionCivSelectEventName } from './age-transition-civ-card.js';
import { CivilizationInfoTooltipModel } from './civilization-info-tooltip.js';
import { YnAMPCustomAgeTransitionSelectionScreen } from './ynamp-age-transition-civ-select.js';
import { a as GetAgeMap, G as GetCivilizationData } from '../create-panels/age-civ-select-model.chunk.js';
import { getPlayerCardInfo } from '../../utilities/utilities-liveops.js';
import '../../context-manager/display-queue-manager.js';
import '../../dialog-box/manager-dialog-box.chunk.js';
import '../../framework.chunk.js';
import '../../input/cursor.js';
import '../../views/view-manager.chunk.js';
import '../../input/input-support.chunk.js';
import '../../utilities/utilities-update-gate.chunk.js';
import '../../utilities/utilities-image.chunk.js';
import '../../utilities/utilities-component-id.chunk.js';
import '../../input/focus-support.chunk.js';
import '../../spatial/spatial-manager.js';
import '../../save-load/model-save-load.chunk.js';
import '../leader-select/leader-button/leader-button.js';
import '../shell-components/icon-dropdown.js';
import '../../components/fxs-activatable.chunk.js';
import '../../utilities/utilities-dom.chunk.js';
import '../../utilities/utilities-layout.chunk.js';
import '../../utilities/utilities-metaprogression.chunk.js';
import '../../tooltips/tooltip-manager.js';
import '../../input/plot-cursor.js';
import '../live-event-logic/live-event-logic.chunk.js';
import '../../utilities/utilities-data.chunk.js';

const styles = "fs://game/core/ui/shell/age-transition/age-transition-civ-select.css";

class AgeTransitionCivSelect extends Panel {
  isMobileViewExperience = UI.getViewExperience() == UIViewExperience.Mobile;
  useCustomSelectionScreen = YnAMPCustomAgeTransitionSelectionScreen.featureEnabled();
  civData;
  ageMap = GetAgeMap();
  customPlayerListScrollable = document.createElement("fxs-scrollable");
  customBackgroundContainer;
  customPanel = document.createElement("div");
  customPlayerListPanel = document.createElement("div");
  customPlayerList = document.createElement("div");
  customPlayerDetailsPanel = document.createElement("div");
  customPlayerHeader = document.createElement("div");
  customPlayerLeader = document.createElement("div");
  customPlayerCivilization = document.createElement("div");
  customPlayerHint = document.createElement("div");
  customPreviousLeaderValue = document.createElement("div");
  customPreviousCivilizationValue = document.createElement("div");
  customUnlockedCivilizations = document.createElement("div");
  customUnlockedEmpty = document.createElement("div");
  customLockedHint = document.createElement("div");
  customLockedCivilizations = document.createElement("div");
  customLockedEmpty = document.createElement("div");
  customBottomBar = document.createElement("div");
  customConfirmButton = document.createElement("fxs-hero-button");
  customPlayerSelectionStates = [];
  customPlayerRows = [];
  selectedCustomPlayerState;
  selectedCustomPlayerRow;
  customHistoricalSnapshots = new Map();
  hydratedCustomPlayerIds = new Set();
  cardsPanel = document.createElement("div");
  civCardsEle = document.createElement("fxs-spatial-slot");
  civCards = [];
  civBonuses = [];
  detailsPanel = document.createElement("div");
  detailsPanelContainer = document.createElement("div");
  detailsPanelBg = document.createElement("div");
  civIcon = document.createElement("div");
  civName = document.createElement("fxs-header");
  civTraits = document.createElement("p");
  civHistoricalChoice = document.createElement("div");
  historicalChoiceText = document.createElement("p");
  civLeaderIcon = document.createElement("fxs-icon");
  civAbilityTitle = document.createElement("p");
  civAbilityText = document.createElement("div");
  civBonusesScroll = document.createElement("fxs-scrollable");
  civBonusesContainer = document.createElement("div");
  civLockIcon = document.createElement("div");
  unlockByInfo = document.createElement("div");
  chooseCivButton = document.createElement("fxs-hero-button");
  ageUnlockPanel = document.createElement("div");
  ageUnlockItems = document.createElement("div");
  civStepper = document.createElement("div");
  leftStepperArrow = document.createElement("fxs-activatable");
  rightStepperArrow = document.createElement("fxs-activatable");
  civStepperButtons = [];
  selectedCard;
  selectedCivInfo;
  isInDetails = false;
  isProgressionShown = false;
  engineInputEventListener = this.onEngineInput.bind(this);
  navigateInputListener = this.onNavigateInput.bind(this);
  activeDeviceTypeListener = this.onActiveDeviceTypeChanged.bind(this);
  ageTransitionCivSelectListener = this.onAgeTransitionCivSelect.bind(this);
  constructor(root) {
    super(root);
    const unsortedCivData = GetCivilizationData();
    this.civData = unsortedCivData.filter((civ) => civ.civID !== "RANDOM").sort((a, b) => {
      return a.isLocked != b.isLocked ? Number(a.isLocked) - Number(b.isLocked) : Locale.compare(a.name, b.name);
    });
    this.render();
  }
  onInitialize() {
    super.onInitialize();
    this.Root.classList.add("fullscreen", "age-transition-civ-select", "trigger-nav-help");
    if (this.useCustomSelectionScreen) {
      this.Root.classList.add("ynamp-custom-age-transition");
    } else {
      this.Root.classList.remove("ynamp-custom-age-transition");
    }
  }
  onReceiveFocus() {
    super.onReceiveFocus();
    NavTray.clear();
    if (this.useCustomSelectionScreen) {
      NavTray.addOrUpdateShellAction1("LOC_END_GAME_TRANSITION");
      FocusManager.setFocus(this.selectedCustomPlayerRow ?? this.customPlayerRows[0] ?? this.Root);
    } else if (this.isInDetails) {
      FocusManager.setFocus(this.Root);
    } else {
      FocusManager.setFocus(this.civCardsEle);
    }
  }
  onAttach() {
    super.onAttach();
    CivilizationInfoTooltipModel.civData = this.civData;
    this.Root.addEventListener("engine-input", this.engineInputEventListener);
    this.Root.addEventListener("navigate-input", this.navigateInputListener);
    window.addEventListener(ActiveDeviceTypeChangedEventName, this.activeDeviceTypeListener, true);
    this.handleActiveDeviceTypeChanged();
  }
  onDetach() {
    super.onDetach();
    CivilizationInfoTooltipModel.clear();
    NavTray.clear();
    this.Root.removeEventListener("engine-input", this.engineInputEventListener);
    this.Root.removeEventListener("navigate-input", this.navigateInputListener);
    window.removeEventListener(ActiveDeviceTypeChangedEventName, this.activeDeviceTypeListener, true);
  }
  //handle input
  onEngineInput(inputEvent) {
    if (inputEvent.detail.status != InputActionStatuses.FINISH) {
      return;
    }
    switch (inputEvent.detail.name) {
      case "cancel":
      case "keyboard-escape":
      case "mousebutton-right":
        if (this.isInDetails) {
          this.closeAdditionalInfoPanel();
          inputEvent.stopPropagation();
          inputEvent.preventDefault();
        }
        break;
      case "sys-menu":
        this.showProgression();
        inputEvent.stopPropagation();
        inputEvent.preventDefault();
        break;
      case "shell-action-1":
        if (this.useCustomSelectionScreen) {
          this.startCustomGame();
          inputEvent.stopPropagation();
          inputEvent.preventDefault();
        } else if (this.isInDetails) {
          this.startGame();
          Audio.playSound("data-audio-choose-civ-activate", "new-civ-select");
          inputEvent.stopPropagation();
          inputEvent.preventDefault();
        }
        break;
      case "shell-action-2":
        if (!this.isInDetails) {
          this.openMementoEditor();
          Audio.playSound("data-audio-popup-open");
          inputEvent.stopPropagation();
          inputEvent.preventDefault();
        }
        break;
    }
  }
  //handle navigation
  onNavigateInput(navigationEvent) {
    if (navigationEvent.detail.status != InputActionStatuses.FINISH) {
      return;
    }
    if (this.isInDetails) {
      switch (navigationEvent.detail.name) {
        case "nav-next":
          this.handleNavNext();
          navigationEvent.stopPropagation();
          navigationEvent.preventDefault();
          break;
        case "nav-previous":
          this.handleNavPrev();
          navigationEvent.stopPropagation();
          navigationEvent.preventDefault();
          break;
      }
    }
  }
  //handle swapping between gamepad and kbm
  onActiveDeviceTypeChanged(_event) {
    this.handleActiveDeviceTypeChanged();
  }
  handleActiveDeviceTypeChanged() {
    this.leftStepperArrow.classList.toggle("hidden", ActionHandler.isGamepadActive);
    this.rightStepperArrow.classList.toggle("hidden", ActionHandler.isGamepadActive);
  }
  showProgression() {
    if (this.isProgressionShown && Network.isMetagamingAvailable()) {
      ScreenProfilePageExternalStatus.isGameCreationDomainInitialized = true;
      ContextManager.push("screen-profile-page", {
        singleton: true,
        createMouseGuard: true,
        panelOptions: { onlyChallenges: false, onlyLeaderboards: false }
      });
    }
  }
  render() {
    const container = document.createElement("div");
    container.classList.add("relative", "w-full", "h-full", "flow-column");
    const filigreeLeft = document.createElement("div");
    filigreeLeft.classList.add(
      "age-transition-filigree",
      "img-frame-filigree",
      "w-187",
      "h-187",
      "top-4",
      "left-4",
      "pointer-events-none",
      "absolute"
    );
    container.appendChild(filigreeLeft);
    const filigreeRight = document.createElement("div");
    filigreeRight.classList.add(
      "age-transition-filigree",
      "img-frame-filigree",
      "w-187",
      "h-187",
      "-scale-x-100",
      "top-4",
      "right-4",
      "pointer-events-none",
      "absolute"
    );
    container.appendChild(filigreeRight);
    this.renderHeader(container);
    if (this.useCustomSelectionScreen) {
      this.renderYnAMPLayout(container);
    } else {
      this.renderCards(container);
      this.renderDetails(container);
      this.renderStepper();
    }
    this.Root.appendChild(container);
  }
  renderYnAMPLayout(container) {
    this.customBackgroundContainer = container;
    this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    this.hydrateCustomPlayerCivilizations();
    this.captureCustomHistoricalSnapshots();
    this.customBackgroundContainer.style.backgroundRepeat = "no-repeat";
    this.customBackgroundContainer.style.backgroundPosition = "center";
    this.customBackgroundContainer.style.backgroundSize = "cover";
    this.customPanel.className = "";
    this.customPanel.innerHTML = "";
    this.customPanel.classList.add(
      "flex",
      "flex-row",
      "items-stretch",
      "flex-auto",
      "mx-13",
      "mb-4",
      "gap-4"
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
  hydrateCustomPlayerCivilizations() {
    let hasChanges = false;
    for (const playerState of this.customPlayerSelectionStates) {
      if (this.hydratedCustomPlayerIds.has(playerState.playerId)) {
        continue;
      }
      this.hydratedCustomPlayerIds.add(playerState.playerId);
      if (!this.canEditCustomPlayer(playerState.playerId)) {
        continue;
      }
      const preferredCivilization = YnAMPCustomAgeTransitionSelectionScreen.getPreferredUnlockedCivilizationForPlayer(
        playerState.playerId
      );
      if (!preferredCivilization) {
        continue;
      }
      GameSetup.setPlayerParameterValue(
        playerState.playerId,
        YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter,
        preferredCivilization
      );
      hasChanges = true;
    }
    if (hasChanges) {
      this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    }
  }
  renderYnAMPPlayerList() {
    this.customPlayerRows = [];
    this.customPlayerListPanel.className = "";
    this.customPlayerListPanel.innerHTML = "";
    this.customPlayerListPanel.classList.add(
      "img-unit-panelbox",
      "bg-cover",
      "flex",
      "flex-col",
      "flex-2",
      "shrink-0",
      "pointer-events-auto",
      "px-4",
      "py-3"
    );
    this.customPlayerListPanel.style.minHeight = "0";
    const columns = document.createElement("div");
    columns.classList.add("flex", "mt-3", "ml-18", "mr-10", "gap-6");
    const leaderColumn = document.createElement("div");
    leaderColumn.setAttribute("data-l10n-id", "LOC_GENERIC_LEADER");
    leaderColumn.classList.add("font-title", "uppercase", "tracking-150", "pointer-events-auto");
    leaderColumn.style.width = "25vw";
    leaderColumn.setAttribute("role", "columnheader");
    columns.appendChild(leaderColumn);
    const civColumn = document.createElement("div");
    civColumn.setAttribute("data-l10n-id", "LOC_GENERIC_CIVILIZATION");
    civColumn.classList.add("font-title", "uppercase", "tracking-150", "pointer-events-auto");
    civColumn.style.width = "25vw";
    civColumn.setAttribute("role", "columnheader");
    columns.appendChild(civColumn);
    this.customPlayerListPanel.appendChild(columns);
    this.customPlayerListScrollable.className = "";
    this.customPlayerListScrollable.innerHTML = "";
    this.customPlayerListScrollable.classList.add("flex-auto");
    this.customPlayerListScrollable.style.minHeight = "0";
    this.customPlayerListScrollable.setAttribute("attached-scrollbar", "true");
    this.customPlayerListScrollable.setAttribute("handle-gamepad-pan", "true");
    this.customPlayerList.className = "";
    this.customPlayerList.innerHTML = "";
    this.customPlayerList.classList.add("pointer-events-auto");
    this.customPlayerSelectionStates.forEach((playerState, index) => {
      const leaderSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
        playerState.playerId,
        YnAMPCustomAgeTransitionSelectionScreen.playerLeaderParameter
      );
      const civilizationSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
        playerState.playerId,
        YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
      );
      const row = document.createElement("div");
      row.setAttribute("ignore-prior-focus", "true");
      row.setAttribute("tabindex", "-1");
      row.classList.add(
        "items-center",
        "my-1",
        "py-2",
        "bg-primary-5",
        "flex",
        "relative",
        "flex-nowrap",
        "pointer-events-auto",
        "items-center"
      );
      row.addEventListener("click", () => this.selectCustomPlayer(index));
      row.addEventListener("focusin", () => this.selectCustomPlayer(index));
      const playerLabel = document.createElement("div");
      playerLabel.classList.add("w-12", "m-2", "text-center", "text-base", "font-title");
      playerLabel.innerHTML = Locale.toNumber(index + 1);
      row.appendChild(playerLabel);
      const selections = document.createElement("div");
      selections.classList.add("flex", "flex-row", "flex-auto");
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
      const deleteIconSpacer = document.createElement("fxs-activatable");
      deleteIconSpacer.setAttribute("tabindex", "-1");
      deleteIconSpacer.classList.add("close-button__bg", "group", "relative", "m-2", "w-8", "h-8", "invisible");
      row.appendChild(deleteIconSpacer);
      this.customPlayerRows.push(row);
      this.customPlayerList.appendChild(row);
    });
    this.customPlayerListScrollable.appendChild(this.customPlayerList);
    this.customPlayerListPanel.appendChild(this.customPlayerListScrollable);
  }
  renderYnAMPPlayerDetails() {
    this.customPlayerDetailsPanel.className = "";
    this.customPlayerDetailsPanel.innerHTML = "";
    this.customPlayerDetailsPanel.classList.add(
      "img-unit-panelbox",
      "bg-cover",
      "flex",
      "flex-col",
      "flex-1",
      "shrink-0",
      "pointer-events-auto",
      "px-6",
      "py-4"
    );
    this.customPlayerHeader.className = "";
    this.customPlayerHeader.classList.add("font-title-xl", "uppercase", "mb-3");
    this.customPlayerLeader.className = "";
    this.customPlayerLeader.classList.add("font-body-base", "mb-2", "uppercase");
    this.customPlayerLeader.textContent = "Previous Era Leader";
    this.customPlayerDetailsPanel.appendChild(this.customPlayerLeader);
    this.customPreviousLeaderValue.className = "";
    this.customPreviousLeaderValue.classList.add("font-title-base", "text-accent-2", "mb-4");
    this.customPlayerDetailsPanel.appendChild(this.customPreviousLeaderValue);
    this.customPlayerCivilization.className = "";
    this.customPlayerCivilization.classList.add("font-body-base", "mb-2", "uppercase");
    this.customPlayerCivilization.textContent = "Previous Era Civilization";
    this.customPlayerDetailsPanel.appendChild(this.customPlayerCivilization);
    this.customPreviousCivilizationValue.className = "";
    this.customPreviousCivilizationValue.classList.add("font-title-base", "text-accent-2", "mb-4");
    this.customPlayerDetailsPanel.appendChild(this.customPreviousCivilizationValue);
    this.customPlayerHint.className = "";
    this.customPlayerHint.classList.add("font-body-base", "mt-2", "uppercase");
    this.customPlayerHint.textContent = "Unlocked Next Era Civilizations";
    this.customPlayerDetailsPanel.appendChild(this.customPlayerHint);
    this.customUnlockedCivilizations.className = "";
    this.customUnlockedCivilizations.classList.add("flex", "flex-col", "gap-2", "mt-3", "mb-4");
    this.customPlayerDetailsPanel.appendChild(this.customUnlockedCivilizations);
    this.customUnlockedEmpty.className = "";
    this.customUnlockedEmpty.classList.add("font-body-sm", "text-secondary-2");
    this.customUnlockedEmpty.textContent = "No unlocked civilizations available.";
    this.customPlayerDetailsPanel.appendChild(this.customUnlockedEmpty);
    this.customLockedHint.className = "";
    this.customLockedHint.classList.add("font-body-base", "mt-2", "uppercase");
    this.customLockedHint.textContent = "Locked Next Era Civilizations";
    this.customPlayerDetailsPanel.appendChild(this.customLockedHint);
    this.customLockedCivilizations.className = "";
    this.customLockedCivilizations.classList.add("flex", "flex-col", "gap-2", "mt-3", "mb-4");
    this.customPlayerDetailsPanel.appendChild(this.customLockedCivilizations);
    this.customLockedEmpty.className = "";
    this.customLockedEmpty.classList.add("font-body-sm", "text-secondary-2");
    this.customLockedEmpty.textContent = "No locked civilizations.";
    this.customPlayerDetailsPanel.appendChild(this.customLockedEmpty);
  }
  renderYnAMPBottomBar(container) {
    this.customBottomBar.className = "";
    this.customBottomBar.innerHTML = "";
    this.customBottomBar.classList.add("flow-row", "justify-center", "items-center", "mb-6", "mt-2");
    this.customConfirmButton.className = "";
    this.customConfirmButton.classList.add("min-w-80");
    this.customConfirmButton.setAttribute("caption", "LOC_END_GAME_TRANSITION");
    this.customConfirmButton.setAttribute("data-audio-group-ref", "new-civ-select");
    this.customConfirmButton.setAttribute("data-audio-activate-ref", "data-audio-choose-civ-activate");
    this.customConfirmButton.addEventListener("action-activate", this.startCustomGame.bind(this));
    this.customBottomBar.appendChild(this.customConfirmButton);
    container.appendChild(this.customBottomBar);
  }
  createCustomRowDropdown(selectionData, playerId, onFocus, onSelection, forceDisabled = false) {
    const dropdown = document.createElement("icon-dropdown");
    dropdown.classList.add("advanced-options__player-select", "mx-2");
    dropdown.style.width = "25vw";
    dropdown.style.flexShrink = "0";
    dropdown.setAttribute("show-label-on-selected-item", "true");
    dropdown.setAttribute("show-icon-on-list-item", "true");
    const possibleValues = selectionData?.possibleValues ?? [];
    dropdown.whenComponentCreated((component) => component.updateDropdownItems(possibleValues));
    const selectedIndex = possibleValues.findIndex((value) => value.id == selectionData?.valueId);
    const fallbackIndex = selectionData?.parameterId === YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
      ? possibleValues.findIndex((value) => value.id == "RANDOM")
      : -1;
    const resolvedIndex = selectedIndex >= 0 ? selectedIndex : fallbackIndex >= 0 ? fallbackIndex : 0;
    dropdown.setAttribute("selected-item-index", resolvedIndex.toString());
    if (!selectionData || selectionData.readOnly || forceDisabled) {
      dropdown.setAttribute("disabled", "true");
    }
    if (!forceDisabled) {
      dropdown.addEventListener("focusin", onFocus);
      dropdown.addEventListener("click", onFocus);
      if (onSelection) {
        dropdown.addEventListener("dropdown-selection-change", onSelection);
      }
    }
    dropdown.setAttribute("data-player-id", playerId.toString());
    return dropdown;
  }
  renderCustomCivilizationEntries(container, civilizations) {
    container.innerHTML = "";
    for (const civilization of civilizations) {
      const civilizationEntry = document.createElement("div");
      civilizationEntry.classList.add("flex", "flex-row", "items-center", "justify-between", "gap-3");
      const civilizationLabel = document.createElement("div");
      civilizationLabel.classList.add("min-w-0", "grow");
      civilizationLabel.classList.add("font-body-base", civilization.isUnlocked ? "text-secondary-1" : "text-accent-2");
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
    const hasBackground = civilizationId != null && civilizationId !== "RANDOM" && this.civData.some((civ) => civ.civID === civilizationId);
    if (!hasBackground) {
      this.customBackgroundContainer.style.backgroundImage = "";
      return;
    }
    const civNameOnly = civilizationId.replace("CIVILIZATION_", "").toLowerCase();
    this.customBackgroundContainer.style.backgroundImage =
      `linear-gradient(rgba(5, 7, 13, 0.7), rgba(5, 7, 13, 0.82)), url('fs://game/bg-card-${civNameOnly}.png')`;
  }
  formatCustomSelectionValue(value) {
    return value ?? "Unassigned";
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
  selectCustomPlayerById(playerId) {
    const index = this.customPlayerSelectionStates.findIndex((playerState) => playerState.playerId === playerId);
    if (index >= 0) {
      this.selectCustomPlayer(index);
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
      row.classList.toggle("selected", rowIndex === index);
      row.classList.toggle("img-dropdown-box-focus", rowIndex === index);
    });
    this.updateCustomBackground();
    this.updateCustomPlayerDetails();
  }
  refreshCustomPlayerSelectionStates(selectedPlayerId = this.selectedCustomPlayerState?.playerId) {
    this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    this.customPlayerSelectionStates.forEach((playerState, index) => {
      const row = this.customPlayerRows[index];
      if (!row) {
        return;
      }
      const dropdowns = row.querySelectorAll("icon-dropdown");
      const civDropdown = dropdowns[1];
      if (civDropdown) {
        const civSelection = YnAMPCustomAgeTransitionSelectionScreen.getPlayerParameterSelectionData(
          playerState.playerId,
          YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter
        );
        if (civSelection) {
          const newIndex = civSelection.possibleValues.findIndex((v) => v.id === civSelection.valueId);
          if (newIndex >= 0) {
            civDropdown.setAttribute("selected-item-index", newIndex.toString());
          }
        }
      }
    });
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
      this.customPreviousLeaderValue.textContent = "Unavailable";
      this.customPreviousCivilizationValue.textContent = "Unavailable";
      this.customUnlockedCivilizations.innerHTML = "";
      this.customLockedCivilizations.innerHTML = "";
      this.customUnlockedEmpty.classList.remove("hidden");
      this.customLockedEmpty.classList.remove("hidden");
      this.customConfirmButton.setAttribute("disabled", "true");
      this.updateCustomBackground();
      return;
    }
    const historicalSnapshot = this.customHistoricalSnapshots.get(this.selectedCustomPlayerState.playerId);
    const civilizationAvailability = YnAMPCustomAgeTransitionSelectionScreen.getCivilizationAvailabilityForPlayer(
      this.selectedCustomPlayerState.playerId
    );
    this.customPreviousLeaderValue.textContent = this.formatHistoricalTransitionValue(
      historicalSnapshot?.previousLeaderLabel,
      historicalSnapshot?.preferredCivilizationLabel
    );
    this.customPreviousCivilizationValue.textContent = this.formatHistoricalTransitionValue(
      historicalSnapshot?.previousCivilizationLabel,
      historicalSnapshot?.preferredCivilizationLabel
    );
    this.renderCustomCivilizationEntries(this.customUnlockedCivilizations, civilizationAvailability.unlockedCivilizations);
    this.renderCustomCivilizationEntries(this.customLockedCivilizations, civilizationAvailability.lockedCivilizations);
    this.customUnlockedEmpty.classList.toggle("hidden", civilizationAvailability.unlockedCivilizations.length > 0);
    this.customLockedEmpty.classList.toggle("hidden", civilizationAvailability.lockedCivilizations.length > 0);
    this.customConfirmButton.removeAttribute("disabled");
  }
  canEditCustomPlayer(playerId) {
    const gameConfig = Configuration.editGame();
    const playerConfig = Configuration.editPlayer(playerId);
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
    if (!nextValue || nextValue.disabled || !this.canEditCustomPlayer(playerId)) {
      return;
    }
    GameSetup.setPlayerParameterValue(
      playerId,
      YnAMPCustomAgeTransitionSelectionScreen.playerCivilizationParameter,
      nextValue.id
    );
    this.refreshCustomPlayerSelectionStates(playerId);
  }
  startCustomGame() {
    this.customPlayerSelectionStates = YnAMPCustomAgeTransitionSelectionScreen.getActivePlayerSelectionStates();
    const invalidPlayers = this.customPlayerSelectionStates.filter(
      (playerState) => !playerState.leaderId || !playerState.civilizationId
    );
    if (invalidPlayers.length > 0) {
      console.warn(
        `[YnAMP] Custom age transition start blocked. Invalid players=` +
          invalidPlayers.map((playerState) => playerState.playerId).join(",")
      );
      return;
    }
    Telemetry.sendAgeTransitionCivSelectionComplete();
    const localCivilization = GameSetup.findPlayerParameter(GameContext.localPlayerID, "PlayerCivilization")?.value?.value;
    if (localCivilization?.startsWith("CIVILIZATION_")) {
      const civName = localCivilization.slice(13).toLowerCase();
      UI.sendAudioEvent("age-end-civ-select" + civName);
      Sound.onNextCivSelect(civName);
    }
    engine.call("startGame");
  }
  renderHeader(container) {
    const header = document.createElement("div");
    header.classList.add("flex", "flex-row", "relative", "items-center", "justify-center");
    const ageHeader = document.createElement("div");
    ageHeader.classList.add("flex", "flex-col", "justify-center", "items-center");
    ageHeader.classList.toggle("mt-8", this.isMobileViewExperience);
    ageHeader.classList.toggle("mt-5", !this.isMobileViewExperience);
    header.appendChild(ageHeader);
    const ageType = GameSetup.findGameParameter("Age")?.value.value?.toString() ?? "";
    const ageTitle = document.createElement("fxs-header");
    ageTitle.classList.add("font-title-2xl", "uppercase");
    ageTitle.setAttribute("filigree-style", "none");
    ageTitle.setAttribute(
      "title",
      Locale.compose("LOC_CREATE_GAME_AGE_TITLE", this.ageMap.get(ageType)?.name ?? "")
    );
    ageHeader.appendChild(ageTitle);
    const ageDesc = document.createElement("fxs-header");
    ageDesc.classList.add("font-title-lg", "uppercase");
    ageDesc.setAttribute("filigree-style", "h3");
    ageDesc.setAttribute("title", "LOC_AGE_TRANSITION_SCREEN_TITLE");
    ageHeader.appendChild(ageDesc);
    if (Network.supportsSSO() && Network.isMetagamingAvailable()) {
      const playerInfo = getPlayerCardInfo();
      this.isProgressionShown = true;
      const progressionBadgeBg = document.createElement("fxs-activatable");
      progressionBadgeBg.classList.add("absolute", "right-12", "top-12", "w-22", "h-22");
      progressionBadgeBg.addEventListener("action-activate", this.showProgression.bind(this));
      header.appendChild(progressionBadgeBg);
      progressionBadgeBg.innerHTML = `
				<div class="w-22 h-22 img-prof-btn-bg pointer-events-auto relative transition-transform hover\\:scale-110 focus\\:scale-110" data-tooltip-content="${playerInfo.twoKName}">
					<div class="absolute inset-0 opacity-30" style="background-color: ${playerInfo.BackgroundColor}"></div>
					<progression-badge class="absolute inset-y-0 -inset-x-0\\.5" badge-size="base" data-badge-url="${playerInfo.BadgeURL}" data-badge-progression-level="${playerInfo.FoundationLevel}"></progression-badge>
				</div>
			`;
      const progressionBadgeNavHelp = document.createElement("fxs-nav-help");
      progressionBadgeNavHelp.classList.add("absolute", "-bottom-3", "-right-6");
      progressionBadgeNavHelp.setAttribute("action-key", "inline-sys-menu");
      progressionBadgeBg.appendChild(progressionBadgeNavHelp);
    }
    container.appendChild(header);
  }
  renderCards(container) {
    this.cardsPanel.classList.add(
      "age-transition-civ-select-cards",
      "relative",
      "top-0",
      "justify-center",
      "flex-auto",
      "flow-column",
      "mx-13"
    );
    container.appendChild(this.cardsPanel);
    const cardContent = document.createElement("fxs-scrollable");
    cardContent.classList.add("age-transition-civ-select-scrollable", "relative", "left-12", "mb-20");
    cardContent.setAttribute("attached-scrollbar", "true");
    this.cardsPanel.appendChild(cardContent);
    this.civCardsEle.classList.add(
      "inset-0",
      "m-2",
      "flex",
      "flex-row",
      "flex-wrap",
      "items-start",
      "justify-center"
    );
    cardContent.appendChild(this.civCardsEle);
    for (const civData of this.civData) {
      const civCard = document.createElement("age-transition-civ-card");
      civCard.whenComponentCreated((card) => card.setCivData(civData));
      civCard.addEventListener("action-activate", this.handleCardSelected.bind(this));
      civCard.addEventListener(AgeTransitionCivSelectEventName, this.ageTransitionCivSelectListener);
      this.civCardsEle.appendChild(civCard);
      this.civCards.push(civCard);
    }
    const mementosButton = document.createElement("fxs-button");
    mementosButton.classList.add("absolute", "bottom-4", "left-7");
    mementosButton.setAttribute("caption", "LOC_AGE_TRANSITION_EDIT_MEMENTOS");
    mementosButton.setAttribute("action-key", "inline-shell-action-2");
    mementosButton.setAttribute("data-audio-activate-ref", "data-audio-popup-open");
    mementosButton.addEventListener("action-activate", this.openMementoEditor);
    this.cardsPanel.appendChild(mementosButton);
  }
  renderDetails(container) {
    this.detailsPanel.classList.add(
      "img-unit-panelbox",
      "bg-cover",
      "flex-auto",
      "flex",
      "items-stretch",
      "justify-stretch",
      "hidden"
    );
    this.detailsPanel.classList.toggle("mb-10", this.isMobileViewExperience);
    this.detailsPanel.classList.toggle("mb-4", !this.isMobileViewExperience);
    this.detailsPanel.classList.toggle("mx-20", this.isMobileViewExperience);
    this.detailsPanel.classList.toggle("mx-13", !this.isMobileViewExperience);
    container.appendChild(this.detailsPanel);
    this.detailsPanelContainer.classList.add(
      "flow-column",
      "flex-auto",
      "relative",
      "items-center",
      "justify-center"
    );
    this.detailsPanelContainer.classList.toggle("-mb-6", this.isMobileViewExperience);
    this.detailsPanelContainer.classList.toggle("pb-6", this.isMobileViewExperience);
    this.detailsPanel.appendChild(this.detailsPanelContainer);
    this.detailsPanelBg.classList.add(
      "bg-cover",
      "bg-bottom",
      "flex-auto",
      "my-1",
      "mx-0\\.5",
      "relative",
      "flex",
      "flex-row"
    );
    this.detailsPanelContainer.appendChild(this.detailsPanelBg);
    const closeButton = document.createElement("fxs-close-button");
    closeButton.classList.add("absolute", "top-0\\.5", "right-0\\.5");
    closeButton.addEventListener("action-activate", this.closeAdditionalInfoPanel.bind(this));
    this.detailsPanelBg.appendChild(closeButton);
    const detailsPanelContent = document.createElement("div");
    detailsPanelContent.classList.add(
      "age-transition-civ-details-section",
      "img-unit-panelbox",
      "bg-cover",
      "flex",
      "flex-col",
      "items-center",
      "-ml-1",
      "-my-1"
    );
    this.detailsPanelBg.appendChild(detailsPanelContent);
    const civTitle = document.createElement("div");
    civTitle.classList.add("flex", "flex-row", "justify-center", "items-center", "uppercase", "mt-4");
    detailsPanelContent.appendChild(civTitle);
    this.civIcon.classList.add("age-transition-civ-details-icon", "size-16", "bg-contain", "mr-2");
    civTitle.appendChild(this.civIcon);
    this.civName.setAttribute("filigree-style", "none");
    this.civName.classList.add("age-transition-civ-details-name", "font-title");
    civTitle.appendChild(this.civName);
    this.civTraits.classList.add("font-body-base", "text-accent-1", "mb-2");
    detailsPanelContent.appendChild(this.civTraits);
    this.civHistoricalChoice.classList.add(
      "flex",
      "flex-row",
      "items-center",
      "mb-2",
      "pointer-events-auto",
      "hidden"
    );
    detailsPanelContent.appendChild(this.civHistoricalChoice);
    const civHistoricalChoiceIcon = document.createElement("div");
    civHistoricalChoiceIcon.classList.add("img-historical-choice", "w-8", "h-8", "mr-1\\.5", "relative");
    this.civHistoricalChoice.appendChild(civHistoricalChoiceIcon);
    this.civLeaderIcon.classList.add("absolute", "-inset-1\\.5", "w-auto", "h-auto");
    this.civLeaderIcon.setAttribute("data-icon-context", "LEADER");
    civHistoricalChoiceIcon.appendChild(this.civLeaderIcon);
    this.historicalChoiceText.classList.add("font-body-lg", "text-accent-3");
    this.historicalChoiceText.setAttribute("data-l10n-id", "LOC_CREATE_GAME_RECOMMENDED_CHOICE");
    this.civHistoricalChoice.appendChild(this.historicalChoiceText);
    this.civBonusesScroll.setAttribute("attached-scrollbar", "true");
    this.civBonusesScroll.setAttribute("handle-gamepad-pan", "true");
    this.civBonusesScroll.classList.add("flex-auto", "mx-4", "mb-4", "self-stretch");
    this.civBonusesScroll.whenComponentCreated((component) => component.setNavigationInputProxy(this.Root));
    this.civBonusesScroll.setAttribute("handle-nav-pan", "true");
    detailsPanelContent.appendChild(this.civBonusesScroll);
    this.civBonusesContainer.classList.add("flex", "flex-col", "w-full");
    this.civBonusesScroll.appendChild(this.civBonusesContainer);
    this.civAbilityTitle.classList.add("font-body-base", "text-accent-2", "font-bold", "mt-2");
    this.civBonusesContainer.appendChild(this.civAbilityTitle);
    this.civAbilityText.classList.add("font-body-base", "text-accent-2", "mx-8");
    this.civBonusesContainer.appendChild(this.civAbilityText);
    const bonusesHeader = document.createElement("fxs-header");
    bonusesHeader.setAttribute("title", "LOC_CREATE_CIV_UNIQUE_BONUSES_SUBTITLE");
    bonusesHeader.setAttribute("filigree-style", "small");
    bonusesHeader.classList.add("mt-4", "uppercase", "font-title-base");
    this.civBonusesContainer.appendChild(bonusesHeader);
    const detailsPanelSpacer = document.createElement("div");
    detailsPanelSpacer.classList.add("age-transition-details-spacer", "flex-auto", "hidden");
    this.detailsPanelBg.appendChild(detailsPanelSpacer);
    const detailsPanelLayout = document.createElement("div");
    detailsPanelLayout.classList.add("age-transition-layout-panel", "flex-auto", "flex", "flex-row");
    this.detailsPanelBg.appendChild(detailsPanelLayout);
    const detailsPanelCenter = document.createElement("div");
    detailsPanelCenter.classList.add(
      "age-transition-civ-details-section",
      "flex",
      "flex-col",
      "items-stretch",
      "justify-end",
      "pl-12",
      "pr-4",
      "max-h-full"
    );
    detailsPanelLayout.appendChild(detailsPanelCenter);
    const unlockByScrollable = document.createElement("fxs-scrollable");
    unlockByScrollable.setAttribute("handle-gamepad-pan", "true");
    unlockByScrollable.whenComponentCreated((component) => component.setEngineInputProxy(this.Root));
    unlockByScrollable.classList.add("shrink", "age-transition-unlock-panel", "pl-2", "pr-6", "py-3");
    const unlockByPanel = document.createElement("div");
    unlockByPanel.classList.add("flex", "flex-row", "items-center", "justify-center", "p-2");
    this.civLockIcon.classList.add("img-lock", "size-12");
    unlockByPanel.appendChild(this.civLockIcon);
    this.unlockByInfo.classList.add("flex", "flex-col", "items-start", "flex-auto", "-my-3");
    unlockByPanel.appendChild(this.unlockByInfo);
    unlockByScrollable.appendChild(unlockByPanel);
    this.chooseCivButton.classList.add("my-2", "mt-8");
    this.chooseCivButton.setAttribute("data-audio-group-ref", "new-civ-select");
    this.chooseCivButton.setAttribute("data-audio-activate-ref", "data-audio-choose-civ-activate");
    this.chooseCivButton.addEventListener("action-activate", this.startGame.bind(this));
    this.civStepper.classList.add("my-2", "flex", "flex-row", "justify-center", "items-center");
    this.civStepper.classList.toggle("absolute", this.isMobileViewExperience);
    this.civStepper.classList.toggle("bottom-0", this.isMobileViewExperience);
    this.ageUnlockPanel.classList.add("flex", "flex-col", "justify-center", "items-end", "mr-4", "mt-14");
    detailsPanelCenter.appendChild(this.ageUnlockPanel);
    detailsPanelCenter.appendChild(unlockByScrollable);
    detailsPanelCenter.appendChild(this.chooseCivButton);
    if (this.isMobileViewExperience) {
      this.detailsPanelContainer.appendChild(this.civStepper);
    } else {
      detailsPanelCenter.appendChild(this.civStepper);
    }
    const ageUnlocksHeader = document.createElement("fxs-header");
    ageUnlocksHeader.setAttribute("title", "LOC_CREATE_GAME_AGE_UNLOCK_TITLE");
    ageUnlocksHeader.setAttribute("filigree-style", "none");
    ageUnlocksHeader.classList.add("age-transition-civ-select-name", "font-title-lg", "text-shadow", "uppercase");
    this.ageUnlockPanel.appendChild(ageUnlocksHeader);
    const ageUnlocksFiligree = document.createElement("div");
    ageUnlocksFiligree.classList.add("img-unit-panel-divider", "-scale-y-100", "-mt-3");
    this.ageUnlockPanel.appendChild(ageUnlocksFiligree);
    this.ageUnlockItems.classList.add("flex", "flex-col", "items-end");
    this.ageUnlockPanel.appendChild(this.ageUnlockItems);
  }
  renderStepper() {
    this.leftStepperArrow.classList.add("img-arrow", "ml-2");
    this.leftStepperArrow.classList.toggle("absolute", this.isMobileViewExperience);
    this.leftStepperArrow.classList.toggle("-left-16", this.isMobileViewExperience);
    this.leftStepperArrow.setAttribute("data-audio-group-ref", "audio-pager");
    this.leftStepperArrow.addEventListener("action-activate", this.handleNavPrev.bind(this));
    const leftNavHelp = document.createElement("fxs-nav-help");
    leftNavHelp.classList.toggle("absolute", this.isMobileViewExperience);
    leftNavHelp.classList.toggle("-left-13", this.isMobileViewExperience);
    leftNavHelp.setAttribute("action-key", "inline-cycle-previous");
    if (this.isMobileViewExperience) {
      this.detailsPanelContainer.appendChild(this.leftStepperArrow);
      this.detailsPanelContainer.appendChild(leftNavHelp);
    } else {
      this.civStepper.appendChild(this.leftStepperArrow);
      this.civStepper.appendChild(leftNavHelp);
    }
    for (let civIndex = 0; civIndex < this.civCards.length; ++civIndex) {
      const civStepperButton = document.createElement("fxs-radio-button");
      civStepperButton.classList.add("age-transition-stepper-pip");
      civStepperButton.setAttribute("group-tag", "civ-stepper");
      civStepperButton.setAttribute("selected", "false");
      civStepperButton.setAttribute("value", civIndex.toString());
      civStepperButton.setAttribute("data-civ-info-index", civIndex.toString());
      civStepperButton.setAttribute("data-tooltip-style", "civilization-info");
      civStepperButton.addEventListener("action-activate", () => this.handleNavTo(civIndex));
      this.civStepperButtons.push(civStepperButton);
      this.civStepper.appendChild(civStepperButton);
    }
    const rightNavHelp = document.createElement("fxs-nav-help");
    rightNavHelp.classList.add("ml-1");
    rightNavHelp.classList.toggle("absolute", this.isMobileViewExperience);
    rightNavHelp.classList.toggle("-right-13", this.isMobileViewExperience);
    rightNavHelp.setAttribute("action-key", "inline-cycle-next");
    this.civStepper.appendChild(rightNavHelp);
    this.rightStepperArrow.classList.add("img-arrow", "-scale-x-100", "mr-2");
    this.rightStepperArrow.classList.toggle("absolute", this.isMobileViewExperience);
    this.rightStepperArrow.classList.toggle("-right-14", this.isMobileViewExperience);
    this.rightStepperArrow.setAttribute("data-audio-group-ref", "audio-pager");
    this.rightStepperArrow.addEventListener("action-activate", this.handleNavNext.bind(this));
    this.civStepper.appendChild(this.rightStepperArrow);
    if (this.isMobileViewExperience) {
      this.detailsPanelContainer.appendChild(rightNavHelp);
      this.detailsPanelContainer.appendChild(this.rightStepperArrow);
    } else {
      this.civStepper.appendChild(rightNavHelp);
      this.civStepper.appendChild(this.rightStepperArrow);
    }
  }
  updateDetails() {
    if (!this.selectedCivInfo) {
      return;
    }
    const isLocked = this.selectedCivInfo.isLocked;
    const civNameOnly = this.selectedCivInfo.civID.replace("CIVILIZATION_", "").toLowerCase();
    this.detailsPanelBg.style.backgroundImage = `url('fs://game/bg-panel-${civNameOnly}.png')`;
    this.civIcon.style.backgroundImage = `url("${this.selectedCivInfo.icon}")`;
    this.civName.setAttribute("title", this.selectedCivInfo.name);
    this.civTraits.innerHTML = this.selectedCivInfo.tags.join(", ");
    this.civAbilityTitle.innerHTML = this.selectedCivInfo.abilityTitle;
    this.civAbilityText.innerHTML = this.selectedCivInfo.abilityText;
    this.civHistoricalChoice.classList.toggle("hidden", !this.selectedCivInfo.isHistoricalChoice);
    if (this.selectedCivInfo.isHistoricalChoice) {
      this.civHistoricalChoice.setAttribute(
        "data-tooltip-content",
        this.selectedCivInfo.historicalChoiceReason ?? ""
      );
      this.historicalChoiceText.setAttribute("data-l10n-id", this.selectedCivInfo.historicalChoiceType ?? "");
      const leaderParameter = GameSetup.findPlayerParameter(GameContext.localPlayerID, "PlayerLeader");
      const leaderIcon = leaderParameter ? GameSetup.resolveString(leaderParameter.value.icon) : "";
      this.civLeaderIcon.setAttribute("data-icon-id", leaderIcon ?? "");
    }
    for (const oldBonus of this.civBonuses) {
      oldBonus.remove();
    }
    for (const bonus of this.selectedCivInfo.bonuses) {
      const bonusEle = document.createElement("civ-select-bonus");
      bonusEle.classList.add("m-4");
      bonusEle.whenComponentCreated((ele) => ele.setBonusData(bonus));
      this.civBonuses.push(bonusEle);
      this.civBonusesContainer.appendChild(bonusEle);
    }
    this.civBonusesScroll.setAttribute("scrollpercent", "1");
    this.civBonusesScroll.setAttribute("scrollpercent", "0");
    this.civLockIcon.classList.toggle("hidden", !isLocked);
    this.unlockByInfo.innerHTML = "";
    for (const unlockByReason of this.selectedCivInfo.unlockedBy) {
      const fullReason = document.createElement("div");
      fullReason.classList.add("flex", "flex-row", "items-center", "m-0\\.5", "w-full");
      if (!isLocked) {
        const checkbox = document.createElement("div");
        checkbox.classList.add("mr-2", "size-8");
        checkbox.classList.add(unlockByReason.isUnlocked ? "img-checkbox-on" : "img-checkbox-off");
        fullReason.appendChild(checkbox);
      }
      const reason = document.createElement("div");
      reason.classList.add("font-body-base", "flex-auto");
      reason.innerHTML = Locale.stylize(unlockByReason.text);
      fullReason.appendChild(reason);
      this.unlockByInfo.appendChild(fullReason);
    }
    const buttonText = isLocked ? "LOC_AGE_TRANSITION_CIV_LOCKED" : Locale.compose("LOC_AGE_TRANSITION_CHOOSE_CIV", this.selectedCivInfo.name);
    this.chooseCivButton.setAttribute("caption", buttonText);
    this.chooseCivButton.setAttribute("disabled", isLocked.toString());
    if (!isLocked) {
      NavTray.addOrUpdateShellAction1("LOC_GENERIC_ACCEPT");
    }
    this.ageUnlockPanel.classList.toggle("hidden", this.selectedCivInfo.unlocks.length === 0);
    this.ageUnlockItems.innerHTML = "";
    for (const unlock of this.selectedCivInfo.unlocks) {
      const unlockEle = document.createElement("div");
      unlockEle.classList.add("mb-2", "font-body-base", "text-shadow", "text-right");
      unlockEle.innerHTML = Locale.stylize(unlock);
      this.ageUnlockItems.appendChild(unlockEle);
    }
    UI.sendAudioEvent("civ-details-release");
  }
  handleNavTo(index) {
    if (index >= this.civCards.length || index < 0) {
      return;
    }
    this.openAdditionalInfoPanel(this.civCards[index]);
  }
  handleNavNext() {
    if (!this.selectedCard) {
      this.openAdditionalInfoPanel(this.civCards[0]);
      return;
    }
    const nextCardIndex = this.civCards.indexOf(this.selectedCard) + 1;
    if (nextCardIndex >= this.civCards.length) {
      return;
    }
    this.openAdditionalInfoPanel(this.civCards[nextCardIndex]);
  }
  handleNavPrev() {
    if (!this.selectedCard) {
      this.openAdditionalInfoPanel(this.civCards[0]);
      return;
    }
    const prevCardIndex = this.civCards.indexOf(this.selectedCard) - 1;
    if (prevCardIndex < 0) {
      return;
    }
    this.openAdditionalInfoPanel(this.civCards[prevCardIndex]);
  }
  handleCardSelected(event) {
    if (ActionHandler.deviceType == InputDeviceType.Touch) {
      this.civCards.forEach((elem) => elem.classList.remove("selected"));
      event.target.classList.add("selected");
    } else {
      this.openAdditionalInfoPanel(event.target);
    }
  }
  onAgeTransitionCivSelect(event) {
    this.openAdditionalInfoPanel(event.target);
  }
  openAdditionalInfoPanel(selectedCard) {
    NavTray.addOrUpdateGenericBack();
    this.selectedCard = selectedCard;
    this.selectedCivInfo = selectedCard.component.getCivData();
    const cardIndex = this.civCards.indexOf(this.selectedCard);
    this.civStepperButtons[cardIndex].setAttribute("selected", "true");
    this.updateDetails();
    this.isInDetails = true;
    this.cardsPanel.classList.add("hidden");
    this.detailsPanel.classList.remove("hidden");
    FocusManager.setFocus(this.Root);
  }
  closeAdditionalInfoPanel() {
    NavTray.clear();
    this.isInDetails = false;
    this.cardsPanel.classList.remove("hidden");
    this.detailsPanel.classList.add("hidden");
    if (this.selectedCard) {
      FocusManager.setFocus(this.selectedCard);
    }
  }
  //new civ selected. Start the next age
  startGame() {
    if (!this.selectedCivInfo || this.selectedCivInfo?.isLocked) {
      return;
    }
    Telemetry.sendAgeTransitionCivSelectionComplete();
    const civName = this.selectedCivInfo.civID.slice(13).toLowerCase();
    UI.sendAudioEvent("age-end-civ-select" + civName);
    Sound.onNextCivSelect(civName);
    GameSetup.setPlayerParameterValue(GameContext.localPlayerID, "PlayerCivilization", this.selectedCivInfo.civID);
    engine.call("startGame");
  }
  //open memento editor
  openMementoEditor() {
    ContextManager.push("memento-editor", { singleton: true, createMouseGuard: true });
  }
}
Controls.define("age-transition-civ-select", {
  createInstance: AgeTransitionCivSelect,
  description: "Single-player era transition civ select screen.",
  styles: [styles],
  tabIndex: -1
});

export { AgeTransitionCivSelect as default };
//# sourceMappingURL=age-transition-civ-select.js.map
