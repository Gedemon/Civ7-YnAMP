import '/core/ui/shell/create-panels/advanced-options-panel.js';

Automation.log("[YnAMP] Loading advanced-options-panel-override.js");

const advancedOptionsDefinition = Controls.getDefinition('advanced-options-panel');

if (!advancedOptionsDefinition || typeof advancedOptionsDefinition.createInstance !== 'function') {
  console.error('[YnAMP] Failed to resolve base advanced-options-panel definition.');
} else {
  Automation.log("[YnAMP] resolved base advanced-options-panel definition.");
  const BaseAdvancedOptionsPanel = advancedOptionsDefinition.createInstance;
  const overridePriority = Math.max(advancedOptionsDefinition.priority ?? 0, 100);

  class YnAMPAdvancedOptionsPanel extends BaseAdvancedOptionsPanel {
    queuePlayerOptionsRefresh() {
      waitForLayout(() => {
        this.activePlayerParameters.clear();
        this.refreshPlayerOptions();
        this.updateFocus();
      });
    }

    refreshPlayerOptions() {
      this.activePlayerParameters.clear();
      super.refreshPlayerOptions();
    }

    removePlayer(playerId) {
      const playerConfig = Configuration.editPlayer(playerId);
      if (playerConfig) {
        playerConfig.setSlotStatus(SlotStatus.SS_CLOSED);
        this.queuePlayerOptionsRefresh();
      } else {
        waitForLayout(() => this.updateFocus());
      }
    }

    addPlayer() {
      const maxPlayers = Configuration.getMap().maxMajorPlayers;
      let unusedId = -1;

      for (let playerId = 0; playerId < maxPlayers; ++playerId) {
        const playerConfig = Configuration.getPlayer(playerId);
        if (playerConfig.slotStatus === SlotStatus.SS_CLOSED) {
          unusedId = playerId;
          break;
        }
      }

      if (unusedId !== -1) {
        const newPlayer = Configuration.editPlayer(unusedId);
        if (newPlayer) {
          newPlayer.setSlotStatus(SlotStatus.SS_COMPUTER);
          newPlayer.setAsMajorCiv();
        }
        this.queuePlayerOptionsRefresh();
      } else {
        waitForLayout(() => this.updateFocus());
      }
    }
  }

  Controls.define('advanced-options-panel', {
    ...advancedOptionsDefinition,
    createInstance: YnAMPAdvancedOptionsPanel,
    priority: overridePriority
  });
}