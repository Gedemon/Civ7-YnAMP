(function () {
  const automationSet = "YnAMP";
  const automationKey = "AgeTransitionContext";
  const tutorialPropertyKey = "YnAMP_AgeTransitionContext";

  function buildProbePayload() {
    return JSON.stringify({
      schemaVersion: 1,
      source: "ynamp-ingame",
      localPlayerId: typeof GameContext !== "undefined" ? GameContext.localPlayerID ?? null : null,
      turn: typeof Game !== "undefined" && typeof Game.getCurrentGameTurn === "function"
        ? Game.getCurrentGameTurn()
        : null
    });
  }

  function writeAutomationPayload(payload) {
    if (typeof Automation === "undefined" || typeof Automation.setParameter !== "function") {
      return;
    }
    Automation.setParameter(automationSet, automationKey, payload);
  }

  function writeTutorialPayload(payload) {
    if (typeof GameTutorial === "undefined" || typeof GameTutorial.setProperty !== "function") {
      return;
    }
    const tutorialHash = Database.makeHash(tutorialPropertyKey);
    GameTutorial.setProperty(tutorialHash, payload);
  }

  const payload = buildProbePayload();
  writeAutomationPayload(payload);
  writeTutorialPayload(payload);
})();
