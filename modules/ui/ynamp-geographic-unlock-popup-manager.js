import ContextManager from '/core/ui/context-manager/context-manager.js';
import { DisplayQueueManager } from '/core/ui/context-manager/display-queue-manager.js';
import { DisplayHandlerBase } from '/core/ui/context-manager/display-handler.js';
import '/core/ui/framework.js';
import '/core/ui/input/cursor.js';
import '/core/ui/audio-base/audio-support.js';
import '/core/ui/panel-support.js';

class YnAMPGeographicUnlockPopupManagerClass extends DisplayHandlerBase {
  static instance = new YnAMPGeographicUnlockPopupManagerClass();
  currentPopupData = null;

  constructor() {
    super('YnAMPGeographicUnlockPopup', 7900);
  }

  show(request) {
    this.currentPopupData = request;
    ContextManager.push('screen-ynamp-geographic-unlock', { createMouseGuard: true, singleton: true });
  }

  hide(_request) {
    this.currentPopupData = null;
    ContextManager.pop('screen-ynamp-geographic-unlock');
  }

  closePopup = () => {
    if (this.currentPopupData) {
      DisplayQueueManager.close(this.currentPopupData);
    }
  };

  queuePopup = (popupData) => {
    if (!popupData) {
      return;
    }
    this.addDisplayRequest({
      category: this.getCategory(),
      ...popupData
    });
  };
}

const YnAMPGeographicUnlockPopupManager = YnAMPGeographicUnlockPopupManagerClass.instance;
DisplayQueueManager.registerHandler(YnAMPGeographicUnlockPopupManager);
globalThis.YnAMPQueueGeographicUnlockPopup = (popupData) => YnAMPGeographicUnlockPopupManager.queuePopup(popupData);

export { YnAMPGeographicUnlockPopupManager };