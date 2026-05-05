import { G as GetCivilizationData } from '../create-panels/age-civ-select-model.chunk.js';
import { L as LiveEventManager } from '../live-event-logic/live-event-logic.chunk.js';

const PLAYER_LEADER_PARAMETER = "PlayerLeader";
const PLAYER_CIVILIZATION_PARAMETER = "PlayerCivilization";
const AGE_TRANSITION_AUTOMATION_SET = "YnAMP";
const AGE_TRANSITION_AUTOMATION_KEY = "AgeTransitionContext";
const AGE_TRANSITION_TUTORIAL_PROPERTY_KEY = "YnAMP_AgeTransitionContext";

let civilizationNameByType = null;
let civilizationInfoByHash = null;
let leaderNameByType = null;
let civilizationTooltipByType = null;

function ensureCivilizationNameCache() {
  if (civilizationNameByType && civilizationInfoByHash) {
    return;
  }
  civilizationNameByType = new Map();
  civilizationInfoByHash = new Map();
  const civilizations = Database.query("config", "select CivilizationType, CivilizationName from Civilizations") ?? [];
  for (const row of civilizations) {
    const civilizationType = row.CivilizationType?.toString();
    if (!civilizationType) {
      continue;
    }
    const label = Locale.compose(row.CivilizationName ?? civilizationType);
    civilizationNameByType.set(civilizationType, label);
    civilizationInfoByHash.set(Database.makeHash(civilizationType), {
      civilizationId: civilizationType,
      label
    });
  }
}

function ensureLeaderNameCache() {
  if (leaderNameByType) {
    return;
  }
  leaderNameByType = new Map();
  const leaders = Database.query("config", "select LeaderType, LeaderName from Leaders") ?? [];
  for (const row of leaders) {
    const leaderType = row.LeaderType?.toString();
    if (!leaderType) {
      continue;
    }
    leaderNameByType.set(leaderType, Locale.compose(row.LeaderName ?? leaderType));
  }
}

function ensureCivilizationTooltipCache() {
  if (civilizationTooltipByType) {
    return;
  }
  civilizationTooltipByType = new Map();
  const civilizations = GetCivilizationData() ?? [];
  for (const civilization of civilizations) {
    if (!civilization?.civID || civilization.civID === "RANDOM") {
      continue;
    }
    const tooltip = `[STYLE:text-secondary][STYLE:font-title-lg]${Locale.compose(civilization.name)}[/S][/S][N]
			${civilization.tags ? `[N][B]${Locale.compose(civilization.tags.join(", "))}[/B]` : ""}
			${civilization.abilityText ? `[N]${Locale.compose(civilization.abilityText)}` : ""}
			${civilization.bonuses ? `[N][STYLE:text-secondary][STYLE:font-title-base]${Locale.compose("LOC_CREATE_CIV_UNIQUE_BONUSES_SUBTITLE")}[/S][/S]
				[N]${civilization.bonuses.map((bonus) => `[B]${Locale.compose(bonus.title)}[/B] ${Locale.compose(bonus.description)}`).join("[N]")}` : ""}`;
    civilizationTooltipByType.set(civilization.civID, tooltip);
  }
}

function getCivilizationName(civilizationId) {
  if (!civilizationId) {
    return null;
  }
  ensureCivilizationNameCache();
  return civilizationNameByType?.get(civilizationId) ?? civilizationId;
}

function getLeaderName(leaderId) {
  if (!leaderId) {
    return null;
  }
  ensureLeaderNameCache();
  return leaderNameByType?.get(leaderId) ?? leaderId;
}

function getCivilizationInfoByHash(civilizationHash) {
  ensureCivilizationNameCache();
  return civilizationInfoByHash?.get(civilizationHash) ?? null;
}

function getCivilizationTooltip(civilizationId) {
  if (!civilizationId || civilizationId === "RANDOM") {
    return "";
  }
  ensureCivilizationTooltipCache();
  return civilizationTooltipByType?.get(civilizationId) ?? "";
}

function isAliveMajorPlayerConfig(playerConfig) {
  if (!playerConfig || playerConfig.slotStatus === SlotStatus.SS_CLOSED) {
    return false;
  }
  if (playerConfig.isParticipant && !playerConfig.isAlive) {
    return false;
  }
  return true;
}

function getActivePlayerIds() {
  const mapConfig = Configuration.getMap?.();
  const maxMajorPlayers = mapConfig?.maxMajorPlayers ?? 0;
  const activePlayerIds = [];
  for (let playerId = 0; playerId < maxMajorPlayers; ++playerId) {
    const playerConfig = Configuration.getPlayer?.(playerId);
    if (!isAliveMajorPlayerConfig(playerConfig)) {
      continue;
    }
    activePlayerIds.push(playerId);
  }
  return activePlayerIds;
}

function getActivePlayerConfigs() {
  return getActivePlayerIds()
    .map((playerId) => Configuration.getPlayer?.(playerId))
    .filter((playerConfig) => !!playerConfig);
}

function restrictToPreferredCivs() {
  return typeof LiveEventManager?.restrictToPreferredCivs === "function" && LiveEventManager.restrictToPreferredCivs();
}

function normalizeBridgePayload(rawValue, source) {
  if (rawValue == null) {
    return null;
  }
  let payload = rawValue;
  if (typeof rawValue === "string") {
    try {
      payload = JSON.parse(rawValue);
    } catch {
      payload = rawValue;
    }
  }
  return {
    source,
    payload,
    rawValue
  };
}

function getAutomationParameter(key, defaultValue = null) {
  if (typeof Automation === "undefined" || typeof Automation.getParameter !== "function") {
    return defaultValue;
  }
  return Automation.getParameter(AGE_TRANSITION_AUTOMATION_SET, key, defaultValue);
}

function getAgeTransitionBridgePayload() {
  const automationPayload = normalizeBridgePayload(
    getAutomationParameter(AGE_TRANSITION_AUTOMATION_KEY, null),
    "Automation"
  );
  if (automationPayload) {
    return automationPayload;
  }
  if (typeof GameTutorial !== "undefined" && typeof GameTutorial.getProperty === "function") {
    const tutorialHash = Database.makeHash(AGE_TRANSITION_TUTORIAL_PROPERTY_KEY);
    const tutorialPayload = normalizeBridgePayload(
      GameTutorial.getProperty(tutorialHash),
      "GameTutorial"
    );
    if (tutorialPayload) {
      return tutorialPayload;
    }
  }
  return null;
}

function isSelectableCivilizationValue(domainValue) {
  return domainValue?.value === "RANDOM" || domainValue?.invalidReason === GameSetupDomainValueInvalidReason.Valid;
}

function buildPossibleValues(setupParam, parameterId) {
  const possibleValues = [];
  if (!setupParam?.domain?.possibleValues) {
    return possibleValues;
  }
  for (const pv of setupParam.domain.possibleValues) {
    if (parameterId === PLAYER_CIVILIZATION_PARAMETER && !isSelectableCivilizationValue(pv)) {
      continue;
    }
    let iconURL = "";
    if (pv.icon != GAMESETUP_INVALID_STRING) {
      const icon = GameSetup.resolveString(pv.icon);
      if (icon) {
        iconURL = UI.getIconURL(icon);
      }
    }
    if (!iconURL) {
      iconURL = UI.getIconURL(pv.value);
    }
    if (!iconURL && parameterId === PLAYER_CIVILIZATION_PARAMETER && pv.icon != GAMESETUP_INVALID_STRING) {
      const icon = GameSetup.resolveString(pv.icon);
      if (icon) {
        iconURL = icon;
      }
    }
    const label = GameSetup.resolveString(pv.name) ?? pv.value;
    possibleValues.push({
      id: pv.value,
      label,
      labelText: Locale.compose(label),
      sortIndex: pv.sortIndex ?? 0,
      iconURL,
      tooltip: parameterId === PLAYER_CIVILIZATION_PARAMETER ? getCivilizationTooltip(pv.value) : "",
      disabled: false,
      invalidReason: pv.invalidReason
    });
  }
  possibleValues.sort((left, right) => {
    return left.sortIndex === right.sortIndex
      ? Locale.compare(left.labelText, right.labelText)
      : left.sortIndex - right.sortIndex;
  });
  return possibleValues;
}

function getPlayerParameterSelectionData(playerId, parameterId) {
  const setupParam = GameSetup.findPlayerParameter(playerId, parameterId);
  if (!setupParam) {
    return null;
  }
  const possibleValues = buildPossibleValues(setupParam, parameterId);
  const valueId = setupParam.value?.value ?? null;
  const selectedValue = possibleValues.find((value) => value.id == valueId) ?? null;
  return {
    playerId,
    parameterId,
    setupParam,
    valueId,
    selectedValue,
    possibleValues,
    readOnly: setupParam.readOnly || possibleValues.length <= 1
  };
}

function getPreferredCivilizationForLeader(leaderId) {
  if (!leaderId) {
    return null;
  }
  const civLeaderPairingData = Database.query("config", "select * from LeaderCivParings") ?? [];
  const civFixed = civLeaderPairingData.find((row) => row.LeaderType == leaderId);
  return civFixed?.CivilizationType ?? null;
}

function getHistoricalSnapshot(playerId) {
  const leaderSelection = getPlayerParameterSelectionData(playerId, PLAYER_LEADER_PARAMETER);
  const playerConfig = Configuration.getPlayer?.(playerId);
  const previousCivilizationCount = playerConfig?.previousCivilizationCount ?? 0;
  const previousCivilizationHash = previousCivilizationCount > 0
    ? playerConfig.getPreviousCivilization(previousCivilizationCount - 1)
    : null;
  const previousCivilizationInfo = previousCivilizationHash != null
    ? getCivilizationInfoByHash(previousCivilizationHash)
    : null;
  const previousLeaderId = leaderSelection?.valueId ?? null;
  const preferredCivilizationId = getPreferredCivilizationForLeader(previousLeaderId);
  return {
    playerId,
    previousLeaderId,
    previousLeaderLabel: leaderSelection?.selectedValue?.labelText ?? getLeaderName(previousLeaderId),
    previousCivilizationId: previousCivilizationInfo?.civilizationId ?? null,
    previousCivilizationLabel: previousCivilizationInfo?.label ?? null,
    preferredCivilizationId,
    preferredCivilizationLabel: getCivilizationName(preferredCivilizationId)
  };
}

function getCivilizationAvailabilityForPlayer(playerId) {
  const playerCivilizations = GameSetup.findPlayerParameter(playerId, PLAYER_CIVILIZATION_PARAMETER);
  if (!playerCivilizations) {
    return {
      unlockedCivilizations: [],
      lockedCivilizations: []
    };
  }
  const leaderParameter = GameSetup.findPlayerParameter(playerId, PLAYER_LEADER_PARAMETER);
  const leaderType = leaderParameter?.value?.value ?? "";
  const civLeaderPairingData = Database.query("config", "select * from LeaderCivParings") ?? [];
  const civilizationEntries = [];
  for (const civData of playerCivilizations.domain.possibleValues ?? []) {
    const civilizationId = civData.value?.toString();
    if (!civilizationId || civilizationId === "RANDOM") {
      continue;
    }
    if (civData.invalidReason == null) {
      continue;
    }
    if (restrictToPreferredCivs()) {
      const civLeaderFixed = civLeaderPairingData.filter(
        (row) => row.CivilizationType == civilizationId && row.LeaderType == leaderType
      );
      if (civLeaderFixed.length == 0 && !UI.isMultiplayer()) {
        continue;
      }
    }
    const label = Locale.compose(GameSetup.resolveString(civData.name) ?? civilizationId);
    civilizationEntries.push({
      civilizationId,
      label,
      sortIndex: civData.sortIndex ?? 0,
      isUnlocked: civData.invalidReason == GameSetupDomainValueInvalidReason.Valid
    });
  }
  civilizationEntries.sort((left, right) => {
    return left.sortIndex === right.sortIndex
      ? Locale.compare(left.label, right.label)
      : left.sortIndex - right.sortIndex;
  });
  return {
    unlockedCivilizations: civilizationEntries.filter((civilization) => civilization.isUnlocked),
    lockedCivilizations: civilizationEntries.filter((civilization) => !civilization.isUnlocked)
  };
}

function getPreferredUnlockedCivilizationForPlayer(playerId) {
  const civilizationSelection = getPlayerParameterSelectionData(playerId, PLAYER_CIVILIZATION_PARAMETER);
  if (!civilizationSelection) {
    return null;
  }
  const currentCivilizationId = civilizationSelection.valueId;
  const currentIsSelectable = civilizationSelection.possibleValues.some((value) => value.id == currentCivilizationId);
  if (currentCivilizationId && currentCivilizationId !== "RANDOM" && currentIsSelectable) {
    return null;
  }
  const leaderSelection = getPlayerParameterSelectionData(playerId, PLAYER_LEADER_PARAMETER);
  const preferredCivilization = getPreferredCivilizationForLeader(leaderSelection?.valueId ?? null);
  if (!preferredCivilization) {
    return null;
  }
  return civilizationSelection.possibleValues.some((value) => value.id == preferredCivilization)
    ? preferredCivilization
    : null;
}

function getPlayerSelectionState(playerId) {
  const leaderSelection = getPlayerParameterSelectionData(playerId, PLAYER_LEADER_PARAMETER);
  const civilizationSelection = getPlayerParameterSelectionData(playerId, PLAYER_CIVILIZATION_PARAMETER);
  return {
    playerId,
    slotLabel: Locale.toNumber(playerId + 1),
    isLocalPlayer: playerId === GameContext.localPlayerID,
    leaderId: leaderSelection?.valueId ?? null,
    leaderLabel: leaderSelection?.selectedValue?.labelText ?? leaderSelection?.valueId ?? null,
    civilizationId: civilizationSelection?.valueId ?? null,
    civilizationLabel: civilizationSelection?.selectedValue?.labelText ?? civilizationSelection?.valueId ?? null
  };
}

const YnAMPCustomAgeTransitionSelectionScreen = {
  featureKey: "UseCustomAgeTransitionScreen",
  playerLeaderParameter: PLAYER_LEADER_PARAMETER,
  playerCivilizationParameter: PLAYER_CIVILIZATION_PARAMETER,
  featureEnabled() {
    const gameConfig = Configuration.getGame?.();
    if (!gameConfig || typeof gameConfig.getValue !== "function") {
      console.warn("[YnAMP] warning: can't get gameConfig");
      return false;
    }
    const rawValue = gameConfig.getValue(this.featureKey);
    return rawValue === true || rawValue === 1 || rawValue === "1";
  },
  getActivePlayerConfigs,
  getPlayerSelectionState,
  getPlayerParameterSelectionData,
  getPreferredCivilizationForLeader,
  getPreferredUnlockedCivilizationForPlayer,
  getHistoricalSnapshot,
  getCivilizationAvailabilityForPlayer,
  getAgeTransitionBridgePayload,
  restrictToPreferredCivs,
  getActivePlayerSelectionStates() {
    return getActivePlayerIds().map((playerId) => getPlayerSelectionState(playerId));
  }
};

export { YnAMPCustomAgeTransitionSelectionScreen };