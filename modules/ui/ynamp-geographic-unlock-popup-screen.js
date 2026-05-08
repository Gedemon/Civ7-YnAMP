import FocusManager from '/core/ui/input/focus-manager.js';
import { P as Panel } from '/core/ui/panel-support.chunk.js';
import { YnAMPGeographicUnlockPopupManager } from './ynamp-geographic-unlock-popup-manager.js';
import {
  buildGeographicUnlockCivilizationLabel,
  buildGeographicUnlockCivilizationName
} from './ynamp-geographic-unlock-text.js';
import '/core/ui/audio-base/audio-support.chunk.js';
import '/core/ui/framework.chunk.js';
import '/core/ui/context-manager/context-manager.js';
import '/core/ui/context-manager/display-queue-manager.js';
import '/core/ui/dialog-box/manager-dialog-box.chunk.js';
import '/core/ui/input/cursor.js';
import '/core/ui/views/view-manager.chunk.js';

const styles = 'fs://game/base-standard/ui/unlocks/screen-reward-unlocked.css';

class ScreenYnAMPGeographicUnlock extends Panel {
  popupData = YnAMPGeographicUnlockPopupManager.currentPopupData;
  closeButton = document.createElement('fxs-button');

  onInitialize() {
    super.onInitialize();
    this.render();
    this.enableOpenSound = true;
    this.Root.setAttribute('data-audio-group-ref', 'audio-reward-unlocked');
    this.Root.classList.add('absolute');
  }

  onAttach() {
    super.onAttach();
    this.Root.addEventListener('engine-input', this.onEngineInput);
  }

  onDetach() {
    this.Root.removeEventListener('engine-input', this.onEngineInput);
    super.onDetach();
  }

  onReceiveFocus() {
    super.onReceiveFocus();
    FocusManager.setFocus(this.closeButton);
  }

  render() {
    this.popupData = YnAMPGeographicUnlockPopupManager.currentPopupData;
    const contextSections = Array.isArray(this.popupData?.contextSections)
      ? this.popupData.contextSections
      : Array.isArray(this.popupData?.contextEntries) && this.popupData.contextEntries.length > 0
        ? [{
            titleKey: 'LOC_YNAMP_GEOGRAPHIC_UNLOCK_SECTION_UNLOCKED_BY',
            entries: this.popupData.contextEntries
          }]
        : [];
    if (!this.popupData?.heroEntry) {
      console.error('screen-ynamp-geographic-unlock: there was not data for the popup');
      YnAMPGeographicUnlockPopupManager.closePopup();
      return;
    }
    const heroEntry = this.popupData.heroEntry;
    const heroIcon = heroEntry?.civilizationId ? UI.getIconURL(heroEntry.civilizationId) : '';
    const heroBackground = heroEntry?.civilizationId ? UI.getIconCSS(heroEntry.civilizationId, 'BACKGROUND') : '';
    const heroLabel = heroEntry
      ? buildGeographicUnlockCivilizationName(heroEntry.baseLabel ?? heroEntry.civilizationId)
      : '';

    const modalFrame = document.createElement('fxs-modal-frame');
    const headerWrapper = document.createElement('div');
    headerWrapper.classList.add('relative');
    const header = document.createElement('fxs-header');
    header.setAttribute('title', this.popupData.titleKey ?? 'LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_GAIN_TITLE');
    header.setAttribute('filigree-style', 'small');
    header.classList.add('font-title', 'uppercase', 'tracking-150', 'text-lg', 'text-gradient-secondary');
    const headerGlow = document.createElement('div');
    headerGlow.classList.add('absolute', 'inset-0', 'opacity-25', 'img-popup_icon_glow');
    headerWrapper.appendChild(headerGlow);
    headerWrapper.appendChild(header);

    const descriptionContainer = document.createElement('div');
    descriptionContainer.classList.add('flex', 'justify-center', 'text-center');
    const description = document.createElement('p');
    description.classList.add('font-body', 'text-sm', 'min-w-96', 'max-w-128', 'my-5', 'text-accent-2');
    description.setAttribute('data-l10n-id', this.popupData.descriptionKey ?? 'LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_GAIN_DESC');
    descriptionContainer.appendChild(description);

    const unlockedRewardWrapper = document.createElement('div');
    unlockedRewardWrapper.classList.add('flex', 'justify-center', 'mb-8', 'opacity-75');
    const unlockIcon = document.createElement('img');
    unlockIcon.classList.add('size-24', 'mt-4');
    unlockIcon.src = heroIcon;
    const unlockedCivWrapper = document.createElement('div');
    unlockedCivWrapper.classList.add(
      'flex-auto',
      'h-52',
      'bg-cover',
      'bg-center',
      'bg-no-repeat',
      'bg-primary',
      'border-2',
      'border-secondary-2',
      'flow-column',
      'justify-between',
      'items-center'
    );
    unlockedCivWrapper.style.backgroundImage = heroBackground;
    const unlockNameContainer = document.createElement('div');
    unlockNameContainer.classList.add('reward-unlocked__bg-gradient', 'text-center', 'w-full', 'relative', 'min-h-16');
    const unlockNameFiligree = document.createElement('div');
    unlockNameFiligree.classList.add('reward-unlocked__filigree', 'filigree-divider-h3', 'absolute', '-top-5', '-mt-0\.5');
    const unlockNameText = document.createElement('div');
    unlockNameText.classList.add('text-xl', 'uppercase', 'font-title', 'text-center', 'tracking-150', 'font-bold', 'pt-5');
    unlockNameText.textContent = heroLabel;
    unlockNameContainer.appendChild(unlockNameFiligree);
    unlockNameContainer.appendChild(unlockNameText);
    unlockedCivWrapper.appendChild(unlockIcon);
    unlockedCivWrapper.appendChild(unlockNameContainer);
    unlockedRewardWrapper.appendChild(unlockedCivWrapper);

    const entriesWrapper = document.createElement('div');
    const textBox = document.createElement('div');
    textBox.classList.add('min-w-96', 'max-w-128', 'flow-column', 'items-center', 'justify-center', 'mb-8', 'relative', 'min-h-24');
    const middleDecor = document.createElement('div');
    middleDecor.classList.add('absolute', '-top-1', 'h-4', 'w-16', 'bg-center', 'bg-no-repeat', 'bg-contain');
    middleDecor.style.backgroundImage = 'url(fs://game/popup_middle_decor.png)';
    const topBorder = document.createElement('div');
    topBorder.classList.add('reward-unlocked__border-bar', 'absolute', 'top-0', 'h-6', 'w-full');
    const bottomBorder = document.createElement('div');
    bottomBorder.classList.add('reward-unlocked__border-bar', '-scale-y-100', 'absolute', 'bottom-0', 'h-6', 'w-full');
    textBox.appendChild(middleDecor);
    textBox.appendChild(topBorder);
    textBox.appendChild(bottomBorder);

    for (const section of contextSections) {
      if (!Array.isArray(section?.entries) || section.entries.length === 0) {
        continue;
      }
      const sectionTitle = document.createElement('div');
      sectionTitle.classList.add('font-title', 'text-xs', 'uppercase', 'tracking-150', 'text-secondary-2', 'mt-3', 'mb-2', 'self-start', 'px-2');
      sectionTitle.setAttribute('data-l10n-id', section.titleKey ?? 'LOC_YNAMP_GEOGRAPHIC_UNLOCK_SECTION_UNLOCKED_BY');
      textBox.appendChild(sectionTitle);
      for (const entry of section.entries) {
        const textWrapper = document.createElement('div');
        textWrapper.classList.value = 'flex items-center flex-auto px-2 py-1';
        const entryIcon = document.createElement('img');
        entryIcon.classList.add('size-8', 'mr-3');
        entryIcon.setAttribute('src', UI.getIconURL(entry.civilizationId));
        const progressText = document.createElement('div');
        progressText.classList.add('font-body', 'text-sm', 'flex-auto');
        progressText.textContent = buildGeographicUnlockCivilizationLabel(entry.baseLabel ?? entry.civilizationId, entry);
        textWrapper.appendChild(entryIcon);
        textWrapper.appendChild(progressText);
        textBox.appendChild(textWrapper);
      }
    }
    entriesWrapper.appendChild(textBox);

    this.closeButton.setAttribute('caption', 'LOC_GENERIC_CONTINUE');
    this.closeButton.setAttribute('action-key', 'inline-accept');
    this.closeButton.addEventListener('action-activate', YnAMPGeographicUnlockPopupManager.closePopup);
    modalFrame.appendChild(headerWrapper);
    modalFrame.appendChild(descriptionContainer);
    modalFrame.appendChild(unlockedRewardWrapper);
    modalFrame.appendChild(entriesWrapper);
    modalFrame.appendChild(this.closeButton);
    this.Root.appendChild(modalFrame);
  }

  onEngineInput(inputEvent) {
    if (inputEvent.detail.status != InputActionStatuses.FINISH) {
      return;
    }
    if (inputEvent.isCancelInput() || inputEvent.detail.name == 'sys-menu') {
      YnAMPGeographicUnlockPopupManager.closePopup();
      inputEvent.stopPropagation();
      inputEvent.preventDefault();
    }
  }
}

Controls.define('screen-ynamp-geographic-unlock', {
  createInstance: ScreenYnAMPGeographicUnlock,
  description: 'Screen for displaying YnAMP geographic unlock updates.',
  styles: [styles]
});