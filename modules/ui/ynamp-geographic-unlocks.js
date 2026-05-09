console.warn("[YnAMP GeographicUnlock] Loading ynamp-geographic-unlocks.js");

const AGE_TRANSITION_AUTOMATION_SET = "YnAMP";
const AGE_TRANSITION_AUTOMATION_KEY = "AgeTransitionContext";
const GEOGRAPHIC_UNLOCK_MAP_CONTEXT_AUTOMATION_KEY = "GeographicUnlockMapContext";
const AGE_TRANSITION_TUTORIAL_PROPERTY_KEY = "YnAMP_AgeTransitionContext";
const GEOGRAPHIC_UNLOCK_MAP_CONTEXT_TUTORIAL_PROPERTY_KEY = "YnAMP_GeographicUnlockMapContext";
const GEOGRAPHIC_UNLOCK_MODE_KEY = "GeographicUnlockMode";
const GEOGRAPHIC_UNLOCK_MODE_SHARED = "YNAMP_GEOGRAPHIC_UNLOCK_SHARED";
const GEOGRAPHIC_UNLOCK_MODE_STRICT = "YNAMP_GEOGRAPHIC_UNLOCK_STRICT";
const GEOGRAPHIC_UNLOCK_MAP_CONTEXT_SCHEMA_VERSION = 1;
const GEOGRAPHIC_UNLOCK_NOTIFICATION_FLUSH_DELAY_MS = 25;
const GEOGRAPHIC_UNLOCK_LENS_STATE_EVENT = "YnAMPGeographicUnlockLensStateChanged";
const UNLOCK_ZONE_RADIUS = 4;
const AGE_SEQUENCE = {
  AGE_ANTIQUITY: "AGE_EXPLORATION",
  AGE_EXPLORATION: "AGE_MODERN"
};

let civilizationUnlockRows = null;
let leaderUnlockRows = null;
let civilizationTypeByHash = null;
let leaderTypeByHash = null;
let civilizationLabelByType = null;
let geographicUnlockState = null;
let geographicUnlockNotificationSnapshotByPlayer = new Map();
let geographicUnlockPendingNotificationBurstByPlayer = new Map();

function logGeographicUnlock(message) {
  if (typeof Automation !== "undefined" && typeof Automation.log === "function") {
    Automation.log(`[YnAMP GeographicUnlock] ${message}`);
    return;
  }
  console.warn(`[YnAMP GeographicUnlock] ${message}`);
}

function normalizeComparableConfigurationValue(rawValue) {
  if (rawValue == null) {
    return null;
  }
  if (typeof rawValue === "string") {
    const numericValue = Number(rawValue);
    if (!Number.isNaN(numericValue)) {
      rawValue = numericValue;
    } else {
      return rawValue;
    }
  }
  if (typeof rawValue === "number") {
    return Number(BigInt.asIntN(32, BigInt(rawValue)));
  }
  if (typeof rawValue === "bigint") {
    return Number(BigInt.asIntN(32, rawValue));
  }
  return rawValue;
}

function normalizeHashValue(rawValue) {
  const comparableValue = normalizeComparableConfigurationValue(rawValue);
  if (typeof comparableValue !== "number" || Number.isNaN(comparableValue)) {
    return null;
  }
  return comparableValue;
}

function buildTypeHashMap(query, columnName) {
  const typeByHash = new Map();
  const rows = Database.query("config", query) ?? [];
  for (const row of rows) {
    const typeName = row?.[columnName]?.toString();
    if (!typeName) {
      continue;
    }
    const typeHash = Number(BigInt.asIntN(32, BigInt(Database.makeHash(typeName))));
    typeByHash.set(typeHash, typeName);
  }
  return typeByHash;
}

function getCivilizationTypeByHash() {
  if (!civilizationTypeByHash) {
    civilizationTypeByHash = buildTypeHashMap("select CivilizationType from Civilizations", "CivilizationType");
  }
  return civilizationTypeByHash;
}

function getCivilizationLabelByType() {
  if (!civilizationLabelByType) {
    civilizationLabelByType = new Map();
    const rows = Database.query("config", "select CivilizationType, CivilizationName from Civilizations") ?? [];
    for (const row of rows) {
      const civilizationType = row?.CivilizationType?.toString();
      if (!civilizationType) {
        continue;
      }
      civilizationLabelByType.set(civilizationType, Locale.compose(row.CivilizationName ?? civilizationType));
    }
  }
  return civilizationLabelByType;
}

function getCivilizationLabel(civilizationType) {
  if (!civilizationType) {
    return null;
  }
  return getCivilizationLabelByType().get(civilizationType) ?? civilizationType;
}

function getLeaderTypeByHash() {
  if (!leaderTypeByHash) {
    leaderTypeByHash = buildTypeHashMap("select LeaderType from Leaders", "LeaderType");
  }
  return leaderTypeByHash;
}

function resolveTypeIdentifier(rawValue, hashMap) {
  if (rawValue == null) {
    return null;
  }
  if (typeof rawValue === "string") {
    const numericValue = Number(rawValue);
    if (Number.isNaN(numericValue)) {
      return rawValue;
    }
    rawValue = numericValue;
  }
  const hashValue = normalizeHashValue(rawValue);
  if (hashValue == null) {
    return rawValue?.toString?.() ?? null;
  }
  return hashMap.get(hashValue) ?? rawValue?.toString?.() ?? null;
}

function configurationValueMatches(rawValue, value) {
  if (rawValue === value) {
    return true;
  }
  const comparableValue = normalizeComparableConfigurationValue(rawValue);
  if (comparableValue === value) {
    return true;
  }
  const hashedValue = Number(BigInt.asIntN(32, BigInt(Database.makeHash(value))));
  return comparableValue === hashedValue;
}

function getGeographicUnlockMode() {
  const gameConfig = Configuration.getGame?.();
  if (!gameConfig || typeof gameConfig.getValue !== "function") {
    return "none";
  }
  const rawValue = gameConfig.getValue(GEOGRAPHIC_UNLOCK_MODE_KEY);
  if (configurationValueMatches(rawValue, GEOGRAPHIC_UNLOCK_MODE_SHARED)) {
    return "shared";
  }
  return configurationValueMatches(rawValue, GEOGRAPHIC_UNLOCK_MODE_STRICT)
    ? "strict"
    : "none";
}

function isGeographicUnlockActiveMode() {
  return getGeographicUnlockMode() !== "none";
}

function isStrictMode() {
  return getGeographicUnlockMode() === "strict";
}

function isSharedMode() {
  return getGeographicUnlockMode() === "shared";
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

function getPlayerLibrary(playerId) {
  return Players.getEverAlive()?.find?.((player) => player?.id === playerId) ?? null;
}

function getPlayerLeaderType(playerId) {
  return resolveTypeIdentifier(getPlayerLibrary(playerId)?.leaderType, getLeaderTypeByHash());
}

function getPlayerCivilizationType(playerId) {
  return resolveTypeIdentifier(getPlayerLibrary(playerId)?.civilizationType, getCivilizationTypeByHash());
}

function getConfiguredMapTextValue(configKey) {
  const rawValue = Configuration.getMapValue?.(configKey);
  return rawValue == null || rawValue === "" ? null : String(rawValue);
}

function getConfiguredMapIntValue(configKey) {
  const rawValue = Configuration.getMapValue?.(configKey);
  if (rawValue == null || rawValue === "") {
    return null;
  }
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeBridgePayload(rawValue) {
  if (rawValue == null) {
    return null;
  }
  if (typeof rawValue === "string") {
    try {
      return JSON.parse(rawValue);
    } catch {
      return null;
    }
  }
  return typeof rawValue === "object" ? rawValue : null;
}

function getTutorialPropertyPayload(propertyKey) {
  if (typeof GameTutorial === "undefined" || typeof GameTutorial.getProperty !== "function") {
    return null;
  }
  const propertyHash = Database.makeHash(propertyKey);
  return normalizeBridgePayload(GameTutorial.getProperty(propertyHash));
}

function getAutomationParameterPayload(key) {
  if (typeof Automation === "undefined" || typeof Automation.getParameter !== "function") {
    return null;
  }
  return normalizeBridgePayload(Automation.getParameter(AGE_TRANSITION_AUTOMATION_SET, key, null));
}

function writeTutorialPropertyPayload(propertyKey, payload) {
  if (typeof GameTutorial === "undefined" || typeof GameTutorial.setProperty !== "function") {
    return false;
  }
  const propertyHash = Database.makeHash(propertyKey);
  GameTutorial.setProperty(propertyHash, payload);
  return true;
}

function writeAutomationParameterPayload(key, payload) {
  if (typeof Automation === "undefined" || typeof Automation.setParameter !== "function") {
    return false;
  }
  Automation.setParameter(AGE_TRANSITION_AUTOMATION_SET, key, payload);
  return true;
}

function createEmptyPayloadContext() {
  return {
    sourceMapName: null,
    currentAgeType: getCurrentAgeType(),
    nextAgeType: getNextAgeType(),
    runtimeMapContext: null,
    coordMap: new Map(),
    regionRows: [],
    regionToSuperRegion: new Map(),
    regionToCultureGroup: new Map()
  };
}

function getGeographicUnlockMapContextPayload() {
  return getTutorialPropertyPayload(GEOGRAPHIC_UNLOCK_MAP_CONTEXT_TUTORIAL_PROPERTY_KEY);
}

function getGeographicUnlockMapContextAutomationPayload() {
  return getAutomationParameterPayload(GEOGRAPHIC_UNLOCK_MAP_CONTEXT_AUTOMATION_KEY);
}

function validateGeographicUnlockMapContextPayload(payload) {
  if (!payload) {
    return { errorCode: "missing-map-context" };
  }
  if (payload.schemaVersion !== GEOGRAPHIC_UNLOCK_MAP_CONTEXT_SCHEMA_VERSION) {
    return { errorCode: "unsupported-map-context-schema" };
  }
  if (payload.status !== "ready") {
    return { errorCode: `map-context-status-${payload.status ?? "unknown"}` };
  }
  const requiredKeys = [
    "mapName",
    "sourceMapName",
    "sourceWidth",
    "sourceHeight",
    "sourceStartX",
    "sourceEndX",
    "sourceStartY",
    "sourceEndY",
    "liveWidth",
    "liveHeight",
    "livePlayableStartX",
    "livePlayableEndX",
    "livePlayableWidth"
  ];
  for (const key of requiredKeys) {
    if (payload[key] == null || payload[key] === "") {
      return { errorCode: `missing-map-context-${key}` };
    }
  }
  return { errorCode: null };
}

function normalizeGeographicUnlockMapContextPayload(payload) {
  const validation = validateGeographicUnlockMapContextPayload(payload);
  if (validation.errorCode) {
    return {
      errorCode: validation.errorCode,
      payload: null
    };
  }
  return {
    errorCode: null,
    payload: {
      schemaVersion: GEOGRAPHIC_UNLOCK_MAP_CONTEXT_SCHEMA_VERSION,
      status: "ready",
      mapName: payload.mapName?.toString() ?? null,
      sourceMapName: payload.sourceMapName?.toString() ?? null,
      sectionId: payload.sectionId?.toString?.() ?? null,
      sourceWidth: Number(payload.sourceWidth),
      sourceHeight: Number(payload.sourceHeight),
      sourceStartX: Number(payload.sourceStartX),
      sourceEndX: Number(payload.sourceEndX),
      sourceStartY: Number(payload.sourceStartY),
      sourceEndY: Number(payload.sourceEndY),
      liveWidth: Number(payload.liveWidth),
      liveHeight: Number(payload.liveHeight),
      livePlayableStartX: Number(payload.livePlayableStartX),
      livePlayableEndX: Number(payload.livePlayableEndX),
      livePlayableWidth: Number(payload.livePlayableWidth),
      noWrapX: payload.noWrapX === true
    }
  };
}

function cacheGeographicUnlockMapContextToAutomation(reason) {
  const normalizedMapContext = normalizeGeographicUnlockMapContextPayload(getGeographicUnlockMapContextPayload());
  if (normalizedMapContext.errorCode) {
    return false;
  }
  const didWrite = writeAutomationParameterPayload(
    GEOGRAPHIC_UNLOCK_MAP_CONTEXT_AUTOMATION_KEY,
    JSON.stringify(normalizedMapContext.payload)
  );
  if (didWrite) {
    logGeographicUnlock(
      `Map context cached to Automation reason=${reason} map=${normalizedMapContext.payload.mapName ?? "unknown"} sourceMap=${normalizedMapContext.payload.sourceMapName ?? "unknown"}`
    );
  }
  return didWrite;
}

function restoreGeographicUnlockMapContextFromAutomation(reason) {
  const normalizedMapContext = normalizeGeographicUnlockMapContextPayload(getGeographicUnlockMapContextAutomationPayload());
  if (normalizedMapContext.errorCode) {
    return normalizedMapContext;
  }
  const didWrite = writeTutorialPropertyPayload(
    GEOGRAPHIC_UNLOCK_MAP_CONTEXT_TUTORIAL_PROPERTY_KEY,
    JSON.stringify(normalizedMapContext.payload)
  );
  if (!didWrite) {
    return {
      errorCode: "map-context-restore-unavailable",
      payload: null
    };
  }
  logGeographicUnlock(
    `Map context restored to GameTutorial from Automation reason=${reason} map=${normalizedMapContext.payload.mapName ?? "unknown"} sourceMap=${normalizedMapContext.payload.sourceMapName ?? "unknown"}`
  );
  return normalizedMapContext;
}

function getAuthoritativeMapContext() {
  const normalizedTutorialPayload = normalizeGeographicUnlockMapContextPayload(getGeographicUnlockMapContextPayload());
  if (!normalizedTutorialPayload.errorCode) {
    return normalizedTutorialPayload;
  }
  if (normalizedTutorialPayload.errorCode === "missing-map-context") {
    const restoredAutomationPayload = restoreGeographicUnlockMapContextFromAutomation("getAuthoritativeMapContext");
    if (!restoredAutomationPayload.errorCode) {
      return restoredAutomationPayload;
    }
  }
  return normalizedTutorialPayload;
}

function getCurrentAgeType() {
  const ageInfo = GameInfo.Ages?.lookup?.(Game.age);
  return ageInfo?.AgeType ?? null;
}

function getNextAgeType(ageType = getCurrentAgeType()) {
  return ageType ? AGE_SEQUENCE[ageType] ?? null : null;
}

function getCivilizationUnlockRows() {
  if (!civilizationUnlockRows) {
    civilizationUnlockRows = Database.query("config", "select * from CivilizationUnlocks order by SortIndex") ?? [];
  }
  return civilizationUnlockRows;
}

function getLeaderUnlockRows() {
  if (!leaderUnlockRows) {
    leaderUnlockRows = Database.query("config", "select * from LeaderUnlocks order by SortIndex") ?? [];
  }
  return leaderUnlockRows;
}

function buildTSLCoordMap(sourceMapName) {
  const coordMap = new Map();
  if (!sourceMapName) {
    return coordMap;
  }
  for (const row of GameInfo.StartPosition ?? []) {
    if (row.MapName !== sourceMapName || coordMap.has(row.Civilization)) {
      continue;
    }
    coordMap.set(row.Civilization, {
      civilizationId: row.Civilization,
      x: Number(row.X ?? 0),
      y: Number(row.Y ?? 0)
    });
  }
  return coordMap;
}

function normalizeX(sourceX, sourceWidth) {
  const normalizedX = Number(sourceX) % Number(sourceWidth);
  return normalizedX < 0 ? normalizedX + Number(sourceWidth) : normalizedX;
}

function getSourceCropOffsetX(sourceX, runtimeMapContext) {
  const normalizedX = normalizeX(sourceX, runtimeMapContext.sourceWidth);
  if (runtimeMapContext.sourceStartX <= runtimeMapContext.sourceEndX) {
    if (normalizedX < runtimeMapContext.sourceStartX || normalizedX > runtimeMapContext.sourceEndX) {
      return null;
    }
    return normalizedX - runtimeMapContext.sourceStartX;
  }
  if (normalizedX >= runtimeMapContext.sourceStartX) {
    return normalizedX - runtimeMapContext.sourceStartX;
  }
  if (normalizedX <= runtimeMapContext.sourceEndX) {
    return runtimeMapContext.sourceWidth - runtimeMapContext.sourceStartX + normalizedX;
  }
  return null;
}

function getSourceCropOffsetY(sourceY, runtimeMapContext) {
  if (sourceY < runtimeMapContext.sourceStartY || sourceY > runtimeMapContext.sourceEndY) {
    return null;
  }
  return Number(sourceY) - runtimeMapContext.sourceStartY;
}

function mapSourceToLocalCoordinate(sourceX, sourceY, runtimeMapContext) {
  if (!runtimeMapContext) {
    return null;
  }
  const localX = getSourceCropOffsetX(sourceX, runtimeMapContext);
  const localY = getSourceCropOffsetY(sourceY, runtimeMapContext);
  if (localX == null || localY == null) {
    return null;
  }
  if (localX < 0 || localX >= runtimeMapContext.liveWidth) {
    return null;
  }
  if (localY < 0 || localY >= runtimeMapContext.liveHeight) {
    return null;
  }
  if (localX < runtimeMapContext.livePlayableStartX || localX > runtimeMapContext.livePlayableEndX) {
    return null;
  }
  return {
    x: localX,
    y: localY,
    sourceX: Number(sourceX),
    sourceY: Number(sourceY)
  };
}

function buildRegionPositionRows(sourceMapName) {
  return (GameInfo.RegionPosition ?? []).filter((row) => row.MapName === sourceMapName);
}

function buildRegionToSuperRegionMap() {
  const map = new Map();
  for (const row of GameInfo.ContinentsRegion ?? []) {
    map.set(row.Region, row.SuperRegion);
  }
  return map;
}

function buildRegionToCultureGroupMap() {
  const map = new Map();
  for (const row of GameInfo.CulturalRegion ?? []) {
    map.set(row.Region, row.CultureGroup);
  }
  return map;
}

function getTSLRegion(coord, regionRows) {
  if (!coord) {
    return null;
  }
  for (const row of regionRows) {
    const minX = Number(row.X ?? 0);
    const minY = Number(row.Y ?? 0);
    const maxX = minX + Number(row.Width ?? 0);
    const maxY = minY + Number(row.Height ?? 0);
    if (coord.x >= minX && coord.x < maxX && coord.y >= minY && coord.y < maxY) {
      return row.Region?.toString() ?? null;
    }
  }
  return null;
}

function getCivilizationGeoProfile(civilizationId, coordMap, regionRows, regionToSuperRegion, regionToCultureGroup) {
  const coord = coordMap.get(civilizationId) ?? null;
  const region = getTSLRegion(coord, regionRows);
  return {
    civilizationId,
    coord,
    region,
    superRegion: region ? regionToSuperRegion.get(region) ?? null : null,
    cultureGroup: region ? regionToCultureGroup.get(region) ?? null : null
  };
}

function getWrappedSourceDelta(leftX, rightX, runtimeMapContext) {
  const rawDelta = Math.abs(Number(leftX) - Number(rightX));
  const sourceWidth = Number(runtimeMapContext?.sourceWidth ?? 0);
  if (runtimeMapContext?.noWrapX === true || !Number.isFinite(sourceWidth) || sourceWidth <= 0) {
    return rawDelta;
  }
  return Math.min(rawDelta, sourceWidth - rawDelta);
}

function getDistanceScore(leftCoord, rightCoord, runtimeMapContext) {
  if (!leftCoord || !rightCoord) {
    return Number.MAX_SAFE_INTEGER;
  }
  const dx = getWrappedSourceDelta(leftCoord.x, rightCoord.x, runtimeMapContext);
  const dy = leftCoord.y - rightCoord.y;
  return dx * dx + dy * dy;
}

function getCandidateTier(currentProfile, candidateProfile) {
  if (!currentProfile || !candidateProfile) {
    return 3;
  }
  if (currentProfile.region && candidateProfile.region && currentProfile.region === candidateProfile.region) {
    return 0;
  }
  if (currentProfile.cultureGroup && candidateProfile.cultureGroup && currentProfile.cultureGroup === candidateProfile.cultureGroup) {
    return 1;
  }
  if (currentProfile.superRegion && candidateProfile.superRegion && currentProfile.superRegion === candidateProfile.superRegion) {
    return 2;
  }
  return 3;
}

function collectAllNextAgeCandidateIds(nextAgeType) {
  if (!nextAgeType) {
    return [];
  }
  const candidateIds = new Set();
  for (const row of getCivilizationUnlockRows()) {
    if (row.AgeType === nextAgeType && row.Type) {
      candidateIds.add(row.Type.toString());
    }
  }
  for (const row of getLeaderUnlockRows()) {
    if (row.AgeType === nextAgeType && row.Type) {
      candidateIds.add(row.Type.toString());
    }
  }
  return Array.from(candidateIds);
}

function getNoPlayerId() {
  return PlayerIds?.NO_PLAYER ?? -1;
}

function getPlotIndex(x, y) {
  if (typeof GameplayMap?.getIndexFromXY === "function") {
    return GameplayMap.getIndexFromXY(x, y);
  }
  if (typeof GameplayMap?.getIndexFromLocation === "function") {
    return GameplayMap.getIndexFromLocation({ x, y });
  }
  return null;
}

function getPlotLocation(plotIndex) {
  if (plotIndex == null || typeof GameplayMap?.getLocationFromIndex !== "function") {
    return null;
  }
  return GameplayMap.getLocationFromIndex(plotIndex);
}

function getPlotOwnerId(x, y) {
  if (typeof GameplayMap?.getOwner !== "function") {
    return getNoPlayerId();
  }
  return GameplayMap.getOwner(x, y);
}

function getPlotsInRadius(centerX, centerY, radius) {
  if (typeof GameplayMap?.getPlotIndicesInRadius === "function") {
    return GameplayMap.getPlotIndicesInRadius(centerX, centerY, radius) ?? [];
  }
  const plotIndices = [];
  for (let y = centerY - radius; y <= centerY + radius; ++y) {
    for (let x = centerX - radius; x <= centerX + radius; ++x) {
      const plotIndex = getPlotIndex(x, y);
      if (plotIndex != null) {
        plotIndices.push(plotIndex);
      }
    }
  }
  return plotIndices;
}

function getHexDistance(left, right) {
  if (!left || !right) {
    return Number.MAX_SAFE_INTEGER;
  }
  if (typeof GameplayMap?.getPlotDistance === "function") {
    return GameplayMap.getPlotDistance(left.x, left.y, right.x, right.y);
  }
  return Math.max(Math.abs(left.x - right.x), Math.abs(left.y - right.y));
}

function isValidLandPlot(location) {
  if (!location) {
    return false;
  }
  if (typeof GameplayMap?.isValidLocation === "function" && !GameplayMap.isValidLocation(location)) {
    return false;
  }
  return typeof GameplayMap?.isWater !== "function" || !GameplayMap.isWater(location.x, location.y);
}

function findAnchorLandLocation(localCoord) {
  if (!localCoord) {
    return null;
  }
  const anchorLocation = { x: localCoord.x, y: localCoord.y };
  if (isValidLandPlot(anchorLocation)) {
    return anchorLocation;
  }
  const candidateLocations = getPlotsInRadius(localCoord.x, localCoord.y, UNLOCK_ZONE_RADIUS)
    .map((plotIndex) => getPlotLocation(plotIndex))
    .filter((location) => isValidLandPlot(location));
  candidateLocations.sort((left, right) => getHexDistance(localCoord, left) - getHexDistance(localCoord, right));
  return candidateLocations[0] ?? null;
}

function buildUnlockZone(candidateId, context) {
  const sourceCoord = context.coordMap.get(candidateId) ?? null;
  if (!sourceCoord) {
    logGeographicUnlock(`Zone skipped civ=${candidateId} reason=missing-source-coord`);
    return null;
  }
  const localCoord = mapSourceToLocalCoordinate(sourceCoord.x, sourceCoord.y, context.runtimeMapContext);
  if (!localCoord) {
    logGeographicUnlock(`Zone skipped civ=${candidateId} reason=source-outside-live-crop source=(${sourceCoord.x},${sourceCoord.y})`);
    return null;
  }
  const anchorLocation = findAnchorLandLocation(localCoord);
  if (!anchorLocation) {
    logGeographicUnlock(`Zone skipped civ=${candidateId} reason=no-local-anchor source=(${sourceCoord.x},${sourceCoord.y})`);
    return null;
  }
  const anchorRegionId = typeof GameplayMap?.getLandmassRegionId === "function"
    ? GameplayMap.getLandmassRegionId(anchorLocation.x, anchorLocation.y)
    : null;
  const plotIndices = new Set();
  for (const plotIndex of getPlotsInRadius(anchorLocation.x, anchorLocation.y, UNLOCK_ZONE_RADIUS)) {
    const location = getPlotLocation(plotIndex);
    if (!isValidLandPlot(location)) {
      continue;
    }
    if (anchorRegionId != null && typeof GameplayMap?.getLandmassRegionId === "function") {
      if (GameplayMap.getLandmassRegionId(location.x, location.y) !== anchorRegionId) {
        continue;
      }
    }
    if (getHexDistance(anchorLocation, location) > UNLOCK_ZONE_RADIUS) {
      continue;
    }
    plotIndices.add(plotIndex);
  }
  logGeographicUnlock(
    `Zone built civ=${candidateId} anchor=(${anchorLocation.x},${anchorLocation.y}) source=(${sourceCoord.x},${sourceCoord.y}) region=${anchorRegionId ?? "NONE"} plots=${plotIndices.size}`
  );
  return {
    candidateId,
    sourceCoord: { x: sourceCoord.x, y: sourceCoord.y },
    anchorLocation,
    anchorRegionId,
    plotIndices: Array.from(plotIndices)
  };
}

function refreshAllowedCivilizationIds(playerState) {
  const dynamicUnlocked = playerState.candidateIds.filter((candidateId) => (playerState.liveUnlockCounts.get(candidateId) ?? 0) > 0);
  const allowedCivilizationIds = [];
  if (playerState.permanentFallbackCivilizationId) {
    allowedCivilizationIds.push(playerState.permanentFallbackCivilizationId);
  }
  for (const candidateId of dynamicUnlocked) {
    if (!allowedCivilizationIds.includes(candidateId)) {
      allowedCivilizationIds.push(candidateId);
    }
  }
  playerState.dynamicUnlockedCivilizationIds = dynamicUnlocked;
  playerState.allowedCivilizationIds = allowedCivilizationIds;
  playerState.lockedCivilizationIds = playerState.candidateIds.filter((candidateId) => !allowedCivilizationIds.includes(candidateId));
}

function applyUnlockDelta(playerState, candidateId, delta, reason) {
  if (!playerState || !playerState.candidateIdSet.has(candidateId) || delta === 0) {
    return false;
  }
  const previousCount = playerState.liveUnlockCounts.get(candidateId) ?? 0;
  const nextCount = Math.max(0, previousCount + delta);
  if (nextCount === previousCount) {
    return false;
  }
  playerState.liveUnlockCounts.set(candidateId, nextCount);
  const previouslyAllowed = previousCount > 0 || playerState.permanentFallbackCivilizationId === candidateId;
  refreshAllowedCivilizationIds(playerState);
  const nowAllowed = playerState.allowedCivilizationIds.includes(candidateId);
  if (previousCount === 0 && nextCount > 0) {
    logGeographicUnlock(`Live unlock gained player=${playerState.playerId} civ=${candidateId} reason=${reason} tiles=${nextCount}`);
  } else if (previousCount > 0 && nextCount === 0) {
    logGeographicUnlock(`Live unlock lost player=${playerState.playerId} civ=${candidateId} reason=${reason}`);
  }
  return previouslyAllowed !== nowAllowed || (previousCount === 0) !== (nextCount === 0);
}

function initializeLiveUnlockState(state) {
  for (const plotIndex of state.trackedPlotIndices) {
    const location = getPlotLocation(plotIndex);
    if (!location) {
      continue;
    }
    const ownerId = getPlotOwnerId(location.x, location.y);
    state.plotOwnerByIndex.set(plotIndex, ownerId);
    if (!state.playerStates.has(ownerId)) {
      continue;
    }
    const playerState = state.playerStates.get(ownerId);
    for (const candidateId of state.plotZoneIdsByIndex.get(plotIndex) ?? []) {
      applyUnlockDelta(playerState, candidateId, 1, `Init@${location.x},${location.y}`);
    }
  }
}

function buildGeographicUnlockState(reason) {
  const payloadContext = buildPayloadContext();
  if (payloadContext.errorCode) {
    logGeographicUnlock(`Strict initialization failed reason=${payloadContext.errorCode}`);
    return {
      reason,
      status: "map-context-error",
      errorCode: payloadContext.errorCode,
      context: payloadContext,
      playerStates: new Map(),
      zonesByCandidateId: new Map(),
      trackedPlotIndices: new Set(),
      plotZoneIdsByIndex: new Map(),
      plotOwnerByIndex: new Map(),
      liveUnlockTrackingImplemented: false
    };
  }
  const context = payloadContext;
  const allNextAgeCandidateIds = collectAllNextAgeCandidateIds(context.nextAgeType);
  const playerStates = new Map();
  for (const playerId of getActivePlayerIds()) {
    const playerState = buildPlayerState(playerId, context, allNextAgeCandidateIds);
    playerStates.set(playerId, {
      ...playerState,
      candidateIds: [...playerState.candidateCivilizationIds],
      candidateIdSet: new Set(playerState.candidateCivilizationIds),
      liveUnlockCounts: new Map(),
      dynamicUnlockedCivilizationIds: []
    });
    refreshAllowedCivilizationIds(playerStates.get(playerId));
  }

  const trackedPlotIndices = new Set();
  const plotZoneIdsByIndex = new Map();
  const zonesByCandidateId = new Map();
  for (const candidateId of allNextAgeCandidateIds) {
    const zone = buildUnlockZone(candidateId, context);
    if (!zone || zone.plotIndices.length === 0) {
      continue;
    }
    zonesByCandidateId.set(candidateId, zone);
    for (const plotIndex of zone.plotIndices) {
      trackedPlotIndices.add(plotIndex);
      if (!plotZoneIdsByIndex.has(plotIndex)) {
        plotZoneIdsByIndex.set(plotIndex, []);
      }
      plotZoneIdsByIndex.get(plotIndex).push(candidateId);
    }
  }

  const state = {
    reason,
    context,
    playerStates,
    zonesByCandidateId,
    trackedPlotIndices,
    plotZoneIdsByIndex,
    plotOwnerByIndex: new Map(),
    liveUnlockTrackingImplemented: true
  };
  initializeLiveUnlockState(state);
  logGeographicUnlock(`Live tracking initialized players=${playerStates.size} zones=${zonesByCandidateId.size} trackedPlots=${trackedPlotIndices.size}`);
  return state;
}

function getCandidateOwnedPercent(ownedTileCount, totalZoneTiles) {
  if (!Number.isFinite(totalZoneTiles) || totalZoneTiles <= 0) {
    return 0;
  }
  return Math.round((Number(ownedTileCount) / Number(totalZoneTiles)) * 100);
}

function doesPlayerOwnCandidateTSL(playerId, candidateId, state) {
  const sourceCoord = state?.context?.coordMap?.get(candidateId) ?? null;
  if (!sourceCoord) {
    return false;
  }
  const localCoord = mapSourceToLocalCoordinate(sourceCoord.x, sourceCoord.y, state.context.runtimeMapContext);
  if (!localCoord) {
    return false;
  }
  return getPlotOwnerId(localCoord.x, localCoord.y) === playerId;
}

function buildCandidateDetail(playerState, candidateId, state) {
  const zone = state?.zonesByCandidateId?.get(candidateId) ?? null;
  const ownedTileCount = playerState.liveUnlockCounts.get(candidateId) ?? 0;
  const totalZoneTiles = zone?.plotIndices?.length ?? 0;
  const ownedPercent = getCandidateOwnedPercent(ownedTileCount, totalZoneTiles);
  const ownsCapitalPlot = doesPlayerOwnCandidateTSL(playerState.playerId, candidateId, state);
  return {
    civilizationId: candidateId,
    weight: ownedPercent + (ownsCapitalPlot ? 100 : 0),
    ownedTileCount,
    totalZoneTiles,
    ownedPercent,
    ownsCapitalPlot,
    isAllowed: playerState.allowedCivilizationIds.includes(candidateId),
    isPermanentFallback: playerState.permanentFallbackCivilizationId === candidateId,
    isLiveUnlocked: playerState.dynamicUnlockedCivilizationIds.includes(candidateId)
  };
}

function buildCandidateDetails(playerState, state) {
  return [...playerState.candidateIds]
    .map((candidateId) => buildCandidateDetail(playerState, candidateId, state))
    .sort((left, right) => {
      if (left.weight !== right.weight) {
        return right.weight - left.weight;
      }
      return Locale.compare(left.civilizationId ?? "", right.civilizationId ?? "");
    });
}

function buildNotificationCandidateEntries(candidateDetails) {
  return candidateDetails.map((candidateDetail) => ({
    ...candidateDetail,
    baseLabel: getCivilizationLabel(candidateDetail.civilizationId)
  }));
}

function buildGeographicUnlockLensEntries(state) {
  if (!state?.zonesByCandidateId) {
    return [];
  }
  return [...state.zonesByCandidateId.values()]
    .filter((zone) => zone?.candidateId && Array.isArray(zone.plotIndices) && zone.plotIndices.length > 0)
    .map((zone) => ({
      civilizationId: zone.candidateId,
      baseLabel: getCivilizationLabel(zone.candidateId),
      plotIndices: [...zone.plotIndices],
      anchorLocation: zone.anchorLocation ? { x: zone.anchorLocation.x, y: zone.anchorLocation.y } : null,
      sourceCoord: zone.sourceCoord ? { x: zone.sourceCoord.x, y: zone.sourceCoord.y } : null
    }))
    .sort((left, right) => Locale.compare(left.baseLabel ?? left.civilizationId ?? "", right.baseLabel ?? right.civilizationId ?? ""));
}

function getGeographicUnlockLensSnapshot() {
  if (!isGeographicUnlockActiveMode() || !geographicUnlockState) {
    return null;
  }
  return {
    mode: getGeographicUnlockMode(),
    status: geographicUnlockState.status ?? "ok",
    entries: buildGeographicUnlockLensEntries(geographicUnlockState)
  };
}

function notifyGeographicUnlockLensStateChanged(reason) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return;
  }
  window.dispatchEvent(new CustomEvent(GEOGRAPHIC_UNLOCK_LENS_STATE_EVENT, {
    detail: { reason }
  }));
}

globalThis.YnAMPGetGeographicUnlockLensSnapshot = getGeographicUnlockLensSnapshot;

function isCandidateActivelyCompeting(candidateDetail) {
  return Number(candidateDetail?.ownedTileCount ?? 0) > 0;
}

function buildNotificationSnapshot(playerState, state) {
  const candidateEntries = buildNotificationCandidateEntries(buildCandidateDetails(playerState, state));
  const competingEntries = candidateEntries.filter((candidateDetail) => isCandidateActivelyCompeting(candidateDetail));
  return {
    playerId: playerState.playerId,
    currentCivilizationId: playerState.currentCivilizationId ?? null,
    currentCivilizationLabel: getCivilizationLabel(playerState.currentCivilizationId),
    candidateEntries,
    competingEntries,
    topCivilizationId: competingEntries[0]?.civilizationId ?? null
  };
}

function buildNotificationWorldSnapshot(state) {
  const playerSnapshots = new Map();
  if (!state?.playerStates) {
    return { playerSnapshots };
  }
  for (const playerState of state.playerStates.values()) {
    playerSnapshots.set(playerState.playerId, buildNotificationSnapshot(playerState, state));
  }
  return { playerSnapshots };
}

function getNotificationSnapshotEntry(snapshot, civilizationId) {
  if (!snapshot || !civilizationId) {
    return null;
  }
  return snapshot.candidateEntries.find((candidateDetail) => candidateDetail.civilizationId === civilizationId) ?? null;
}

function getLocalHumanPlayerId() {
  if (typeof GameContext === "undefined") {
    return null;
  }
  const localPlayerId = GameContext.localPlayerID;
  return Number.isFinite(Number(localPlayerId)) ? Number(localPlayerId) : null;
}

function createNotificationChangeBatch() {
  return {
    touchedIds: new Set(),
    gainedIds: new Set(),
    lostIds: new Set(),
    reasons: []
  };
}

function recordNotificationChangeBatchTouch(changeBatch, candidateId, reason) {
  if (!changeBatch) {
    return;
  }
  if (candidateId) {
    changeBatch.touchedIds.add(candidateId);
  }
  if (reason && !changeBatch.reasons.includes(reason)) {
    changeBatch.reasons.push(reason);
  }
}

function mergeNotificationChangeBatch(targetBatch, sourceBatch) {
  if (!targetBatch || !sourceBatch) {
    return;
  }
  for (const candidateId of sourceBatch.touchedIds ?? []) {
    targetBatch.touchedIds.add(candidateId);
  }
  for (const reason of sourceBatch.reasons ?? []) {
    if (!targetBatch.reasons.includes(reason)) {
      targetBatch.reasons.push(reason);
    }
  }
}

function deriveNotificationChangeBatch(previousSnapshot, currentSnapshot, changeBatch) {
  changeBatch.gainedIds.clear();
  changeBatch.lostIds.clear();
  for (const civilizationId of changeBatch.touchedIds) {
    const previousEntry = getNotificationSnapshotEntry(previousSnapshot, civilizationId);
    const currentEntry = getNotificationSnapshotEntry(currentSnapshot, civilizationId);
    const wasActive = isCandidateActivelyCompeting(previousEntry);
    const isActive = isCandidateActivelyCompeting(currentEntry);
    if (!wasActive && isActive) {
      changeBatch.gainedIds.add(civilizationId);
    } else if (wasActive && !isActive) {
      changeBatch.lostIds.add(civilizationId);
    }
  }
  return changeBatch;
}

function getNotificationBatchReason(changeBatch, fallbackReason) {
  if (!changeBatch?.reasons?.length) {
    return fallbackReason;
  }
  return changeBatch.reasons.join("|");
}

function clearNotificationBurstTimer(burst) {
  if (!burst || burst.timeoutHandle == null || typeof globalThis.clearTimeout !== "function") {
    return;
  }
  globalThis.clearTimeout(burst.timeoutHandle);
  burst.timeoutHandle = null;
}

function clearPendingNotificationBursts() {
  for (const burst of geographicUnlockPendingNotificationBurstByPlayer.values()) {
    clearNotificationBurstTimer(burst);
  }
  geographicUnlockPendingNotificationBurstByPlayer = new Map();
}

function getOrCreatePendingNotificationBurst(playerId, state) {
  if (playerId == null || !state?.playerStates?.has(playerId)) {
    return null;
  }
  let burst = geographicUnlockPendingNotificationBurstByPlayer.get(playerId) ?? null;
  if (burst) {
    return burst;
  }
  burst = {
    playerId,
    previousSnapshot: geographicUnlockNotificationSnapshotByPlayer.get(playerId) ?? buildNotificationSnapshot(state.playerStates.get(playerId), state),
    previousWorldSnapshot: buildNotificationWorldSnapshot(state),
    changeBatch: createNotificationChangeBatch(),
    timeoutHandle: null
  };
  geographicUnlockPendingNotificationBurstByPlayer.set(playerId, burst);
  return burst;
}

function getOrderedNotificationEntries(snapshot, civilizationIds) {
  if (!snapshot || !civilizationIds || civilizationIds.size === 0) {
    return [];
  }
  return snapshot.candidateEntries.filter((candidateDetail) => civilizationIds.has(candidateDetail.civilizationId));
}

function buildHeroContributorEntries(worldSnapshot, heroCivilizationId) {
  if (!worldSnapshot?.playerSnapshots || !heroCivilizationId) {
    return [];
  }
  const contributorEntries = [];
  for (const playerSnapshot of worldSnapshot.playerSnapshots.values()) {
    const candidateDetail = getNotificationSnapshotEntry(playerSnapshot, heroCivilizationId);
    if (!isCandidateActivelyCompeting(candidateDetail) || !playerSnapshot.currentCivilizationId) {
      continue;
    }
    contributorEntries.push({
      ...candidateDetail,
      civilizationId: playerSnapshot.currentCivilizationId,
      baseLabel: playerSnapshot.currentCivilizationLabel ?? getCivilizationLabel(playerSnapshot.currentCivilizationId),
      unlockedCivilizationId: heroCivilizationId,
      contributorPlayerId: playerSnapshot.playerId
    });
  }
  contributorEntries.sort((left, right) => {
    if (left.weight !== right.weight) {
      return right.weight - left.weight;
    }
    return Locale.compare(left.baseLabel ?? left.civilizationId ?? "", right.baseLabel ?? right.civilizationId ?? "");
  });
  return contributorEntries;
}

function flattenContextSectionsEntries(contextSections) {
  if (!Array.isArray(contextSections)) {
    return [];
  }
  return contextSections.flatMap((section) => Array.isArray(section?.entries) ? section.entries : []);
}

function buildGeographicUnlockContextSections(worldSnapshot, heroCivilizationId) {
  const contributorEntries = buildHeroContributorEntries(worldSnapshot, heroCivilizationId);
  if (contributorEntries.length === 0) {
    return [];
  }
  if (isSharedMode()) {
    return [{
      titleKey: "LOC_YNAMP_GEOGRAPHIC_UNLOCK_SECTION_UNLOCKED_BY",
      entries: contributorEntries
    }];
  }
  const sections = [{
    titleKey: "LOC_YNAMP_GEOGRAPHIC_UNLOCK_SECTION_UNLOCKED_BY",
    entries: contributorEntries.slice(0, 1)
  }];
  if (contributorEntries.length > 1) {
    sections.push({
      titleKey: "LOC_YNAMP_GEOGRAPHIC_UNLOCK_SECTION_COMPETING_WITH",
      entries: contributorEntries.slice(1)
    });
  }
  return sections;
}

function captureNotificationSnapshotForPlayer(playerId, state) {
  if (!state?.playerStates?.has(playerId)) {
    geographicUnlockNotificationSnapshotByPlayer.delete(playerId);
    geographicUnlockPendingNotificationBurstByPlayer.delete(playerId);
    return null;
  }
  const snapshot = buildNotificationSnapshot(state.playerStates.get(playerId), state);
  geographicUnlockNotificationSnapshotByPlayer.set(playerId, snapshot);
  return snapshot;
}

function resetNotificationSnapshots(state) {
  clearPendingNotificationBursts();
  geographicUnlockNotificationSnapshotByPlayer = new Map();
  const localPlayerId = getLocalHumanPlayerId();
  if (localPlayerId == null || !state?.playerStates?.has(localPlayerId)) {
    return;
  }
  captureNotificationSnapshotForPlayer(localPlayerId, state);
}

function buildNotificationSummary(candidateEntries) {
  return candidateEntries.map((candidateDetail) => `${candidateDetail.civilizationId}:${candidateDetail.weight}`).join(",");
}

function queueGeographicUnlockPopup(popupData) {
  if (!popupData || typeof globalThis.YnAMPQueueGeographicUnlockPopup !== "function") {
    return;
  }
  globalThis.YnAMPQueueGeographicUnlockPopup(popupData);
}

function buildGeographicUnlockPopupPayload(notificationType, heroEntry, contextSections, previousSnapshot, currentSnapshot) {
  if (!heroEntry) {
    return null;
  }
  const titleKey = notificationType === "gain"
    ? "LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_GAIN_TITLE"
    : notificationType === "loss"
      ? "LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_LOSS_TITLE"
      : "LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_RANK_TITLE";
  const descriptionKey = notificationType === "gain"
    ? "LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_GAIN_DESC"
    : notificationType === "loss"
      ? "LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_LOSS_DESC"
      : "LOC_YNAMP_GEOGRAPHIC_UNLOCK_POPUP_RANK_DESC";
  return {
    category: "YnAMPGeographicUnlockPopup",
    notificationType,
    titleKey,
    descriptionKey,
    heroCivilizationId: heroEntry.civilizationId ?? null,
    heroEntry: { ...heroEntry },
    contextSections: contextSections.map((section) => ({
      titleKey: section.titleKey,
      entries: (section.entries ?? []).map((candidateDetail) => ({ ...candidateDetail }))
    })),
    contextEntries: flattenContextSectionsEntries(contextSections).map((candidateDetail) => ({ ...candidateDetail })),
    previousTopCivilizationId: previousSnapshot?.topCivilizationId ?? null,
    currentTopCivilizationId: currentSnapshot?.topCivilizationId ?? null
  };
}

function buildGeographicUnlockPopupPayloads(previousSnapshot, currentSnapshot, previousWorldSnapshot, currentWorldSnapshot, changeBatch) {
  deriveNotificationChangeBatch(previousSnapshot, currentSnapshot, changeBatch);
  const popupPayloads = [];
  const gainedEntries = getOrderedNotificationEntries(currentSnapshot, changeBatch.gainedIds);
  const lostEntries = getOrderedNotificationEntries(previousSnapshot, changeBatch.lostIds);
  for (const heroEntry of gainedEntries) {
    const popupData = buildGeographicUnlockPopupPayload(
      "gain",
      heroEntry,
      buildGeographicUnlockContextSections(currentWorldSnapshot, heroEntry.civilizationId),
      previousSnapshot,
      currentSnapshot
    );
    if (popupData) {
      popupPayloads.push(popupData);
    }
  }
  for (const heroEntry of lostEntries) {
    const popupData = buildGeographicUnlockPopupPayload(
      "loss",
      heroEntry,
      buildGeographicUnlockContextSections(previousWorldSnapshot, heroEntry.civilizationId),
      previousSnapshot,
      currentSnapshot
    );
    if (popupData) {
      popupPayloads.push(popupData);
    }
  }
  const topRankChanged = isStrictMode()
    && previousSnapshot?.topCivilizationId != null
    && currentSnapshot?.topCivilizationId != null
    && previousSnapshot.topCivilizationId !== currentSnapshot.topCivilizationId;
  if (topRankChanged
    && !changeBatch.gainedIds.has(currentSnapshot.topCivilizationId)
    && !changeBatch.lostIds.has(currentSnapshot.topCivilizationId)) {
    const heroEntry = getNotificationSnapshotEntry(currentSnapshot, currentSnapshot.topCivilizationId);
    const popupData = buildGeographicUnlockPopupPayload(
      "top-rank-change",
      heroEntry,
      buildGeographicUnlockContextSections(currentWorldSnapshot, currentSnapshot.topCivilizationId),
      previousSnapshot,
      currentSnapshot
    );
    if (popupData) {
      popupPayloads.push(popupData);
    }
  }
  return popupPayloads;
}

function publishGeographicUnlockNotification(playerId, state, changeBatch, reason, previousSnapshotOverride = null, previousWorldSnapshotOverride = null) {
  if (playerId == null || playerId !== getLocalHumanPlayerId() || !state?.playerStates?.has(playerId)) {
    return;
  }
  const previousSnapshot = previousSnapshotOverride ?? geographicUnlockNotificationSnapshotByPlayer.get(playerId) ?? buildNotificationSnapshot(state.playerStates.get(playerId), state);
  const currentSnapshot = buildNotificationSnapshot(state.playerStates.get(playerId), state);
  const previousWorldSnapshot = previousWorldSnapshotOverride ?? buildNotificationWorldSnapshot(state);
  const currentWorldSnapshot = buildNotificationWorldSnapshot(state);
  geographicUnlockNotificationSnapshotByPlayer.set(playerId, currentSnapshot);
  const popupPayloads = buildGeographicUnlockPopupPayloads(previousSnapshot, currentSnapshot, previousWorldSnapshot, currentWorldSnapshot, changeBatch);
  if (popupPayloads.length === 0) {
    return;
  }
  for (const popupData of popupPayloads) {
    queueGeographicUnlockPopup(popupData);
    logGeographicUnlock(
      `Notification player=${playerId} type=${popupData.notificationType} reason=${reason} prevTop=${previousSnapshot.topCivilizationId ?? "NONE"} currentTop=${currentSnapshot.topCivilizationId ?? "NONE"} hero=${popupData.heroCivilizationId ?? "NONE"} entries=${buildNotificationSummary(popupData.contextEntries)}`
    );
  }
}

function flushPendingGeographicUnlockNotificationBurst(playerId) {
  const burst = geographicUnlockPendingNotificationBurstByPlayer.get(playerId) ?? null;
  if (!burst) {
    return;
  }
  clearNotificationBurstTimer(burst);
  geographicUnlockPendingNotificationBurstByPlayer.delete(playerId);
  if (!geographicUnlockState?.playerStates?.has(playerId) || burst.changeBatch.touchedIds.size === 0) {
    return;
  }
  publishGeographicUnlockNotification(
    playerId,
    geographicUnlockState,
    burst.changeBatch,
    getNotificationBatchReason(burst.changeBatch, "PlotOwnershipChangedBurst"),
    burst.previousSnapshot,
    burst.previousWorldSnapshot
  );
}

function queuePendingGeographicUnlockNotification(playerId, state, changeBatch, reason) {
  if (playerId == null || playerId !== getLocalHumanPlayerId() || !state?.playerStates?.has(playerId) || changeBatch.touchedIds.size === 0) {
    return;
  }
  const burst = getOrCreatePendingNotificationBurst(playerId, state);
  if (!burst) {
    return;
  }
  mergeNotificationChangeBatch(burst.changeBatch, changeBatch);
  if (reason && !burst.changeBatch.reasons.includes(reason)) {
    burst.changeBatch.reasons.push(reason);
  }
  clearNotificationBurstTimer(burst);
  if (typeof globalThis.setTimeout !== "function") {
    flushPendingGeographicUnlockNotificationBurst(playerId);
    return;
  }
  burst.timeoutHandle = globalThis.setTimeout(
    () => flushPendingGeographicUnlockNotificationBurst(playerId),
    GEOGRAPHIC_UNLOCK_NOTIFICATION_FLUSH_DELAY_MS
  );
}

function applyUnlockDeltaAndCollect(playerState, candidateId, delta, reason, changeBatch) {
  const previousCount = playerState.liveUnlockCounts.get(candidateId) ?? 0;
  const hasSelectionChange = applyUnlockDelta(playerState, candidateId, delta, reason);
  if (changeBatch) {
    const currentCount = playerState.liveUnlockCounts.get(candidateId) ?? 0;
    if (currentCount !== previousCount) {
      recordNotificationChangeBatchTouch(changeBatch, candidateId, reason);
    }
  }
  return hasSelectionChange;
}

function buildPlayerPayload(playerState, state) {
  return {
    playerId: playerState.playerId,
    currentCivilizationId: playerState.currentCivilizationId,
    currentLeaderType: playerState.currentLeaderType,
    currentRegion: playerState.currentRegion,
    currentCultureGroup: playerState.currentCultureGroup,
    currentSuperRegion: playerState.currentSuperRegion,
    allowedCivilizationIds: [...playerState.allowedCivilizationIds],
    lockedCivilizationIds: [...playerState.lockedCivilizationIds],
    permanentFallbackCivilizationId: playerState.permanentFallbackCivilizationId,
    liveUnlockedCivilizationIds: [...playerState.dynamicUnlockedCivilizationIds],
    candidateDetails: buildCandidateDetails(playerState, state),
    liveUnlockTrackingImplemented: true
  };
}

function resolvePlotOwnershipLocation(eventData) {
  if (!eventData) {
    return null;
  }
  const candidateLocation = eventData.location ?? eventData.plot ?? eventData.Location ?? null;
  if (candidateLocation && Number.isFinite(Number(candidateLocation.x)) && Number.isFinite(Number(candidateLocation.y))) {
    return { x: Number(candidateLocation.x), y: Number(candidateLocation.y) };
  }
  if (Number.isFinite(Number(eventData.x)) && Number.isFinite(Number(eventData.y))) {
    return { x: Number(eventData.x), y: Number(eventData.y) };
  }
  if (Number.isFinite(Number(eventData.iX)) && Number.isFinite(Number(eventData.iY))) {
    return { x: Number(eventData.iX), y: Number(eventData.iY) };
  }
  if (Number.isFinite(Number(eventData.plotIndex))) {
    return getPlotLocation(Number(eventData.plotIndex));
  }
  return null;
}

function chooseFallbackCivilization(candidateProfiles, currentProfile, runtimeMapContext) {
  if (candidateProfiles.length === 0) {
    return null;
  }
  const rankedProfiles = [...candidateProfiles].sort((left, right) => {
    const leftTier = getCandidateTier(currentProfile, left);
    const rightTier = getCandidateTier(currentProfile, right);
    if (leftTier !== rightTier) {
      return leftTier - rightTier;
    }
    const leftDistance = getDistanceScore(currentProfile?.coord, left.coord, runtimeMapContext);
    const rightDistance = getDistanceScore(currentProfile?.coord, right.coord, runtimeMapContext);
    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }
    return Locale.compare(left.civilizationId ?? "", right.civilizationId ?? "");
  });
  return rankedProfiles[0] ?? null;
}

function buildPlayerState(playerId, context, allCandidateIds = null) {
  const currentCivilizationId = getPlayerCivilizationType(playerId);
  const currentLeaderType = getPlayerLeaderType(playerId);
  const candidateIds = Array.isArray(allCandidateIds)
    ? [...allCandidateIds]
    : collectAllNextAgeCandidateIds(context.nextAgeType);
  const currentProfile = currentCivilizationId
    ? getCivilizationGeoProfile(
        currentCivilizationId,
        context.coordMap,
        context.regionRows,
        context.regionToSuperRegion,
        context.regionToCultureGroup
      )
    : null;
  const candidateProfiles = candidateIds.map((candidateId) => {
    return getCivilizationGeoProfile(
      candidateId,
      context.coordMap,
      context.regionRows,
      context.regionToSuperRegion,
      context.regionToCultureGroup
    );
  });
  const fallbackProfile = chooseFallbackCivilization(candidateProfiles, currentProfile, context.runtimeMapContext);
  const allowedCivilizationIds = fallbackProfile ? [fallbackProfile.civilizationId] : [];
  const lockedCivilizationIds = candidateIds.filter((candidateId) => candidateId !== fallbackProfile?.civilizationId);

  if (fallbackProfile) {
    logGeographicUnlock(
      `Fallback player=${playerId} leader=${currentLeaderType ?? "NONE"} current=${currentCivilizationId ?? "NONE"} next=${fallbackProfile.civilizationId} tier=${getCandidateTier(currentProfile, fallbackProfile)}`
    );
  } else {
    logGeographicUnlock(
      `Fallback player=${playerId} leader=${currentLeaderType ?? "NONE"} current=${currentCivilizationId ?? "NONE"} next=NONE candidates=${candidateIds.length}`
    );
  }

  return {
    playerId,
    currentCivilizationId,
    currentLeaderType,
    currentRegion: currentProfile?.region ?? null,
    currentCultureGroup: currentProfile?.cultureGroup ?? null,
    currentSuperRegion: currentProfile?.superRegion ?? null,
    allowedCivilizationIds,
    lockedCivilizationIds,
    candidateCivilizationIds: candidateIds,
    permanentFallbackCivilizationId: fallbackProfile?.civilizationId ?? null,
    liveUnlockTrackingImplemented: false
  };
}

function buildPayloadContext() {
  const mapContext = getAuthoritativeMapContext();
  if (mapContext.errorCode) {
    return {
      ...createEmptyPayloadContext(),
      errorCode: mapContext.errorCode
    };
  }
  const sourceMapName = mapContext.payload.sourceMapName;
  const coordMap = buildTSLCoordMap(sourceMapName);
  if (coordMap.size === 0) {
    return {
      ...createEmptyPayloadContext(),
      sourceMapName,
      currentAgeType: getCurrentAgeType(),
      nextAgeType: getNextAgeType(),
      runtimeMapContext: mapContext.payload,
      errorCode: "missing-tsl-data"
    };
  }
  return {
    sourceMapName,
    currentAgeType: getCurrentAgeType(),
    nextAgeType: getNextAgeType(),
    runtimeMapContext: mapContext.payload,
    coordMap,
    regionRows: buildRegionPositionRows(sourceMapName),
    regionToSuperRegion: buildRegionToSuperRegionMap(),
    regionToCultureGroup: buildRegionToCultureGroupMap()
  };
}

function buildAgeTransitionPayload(reason) {
  const mode = getGeographicUnlockMode();
  const state = geographicUnlockState;
  const context = state?.context ?? buildPayloadContext();
  const playerStates = state
    ? Array.from(state.playerStates.values()).map((playerState) => buildPlayerPayload(playerState, state))
    : getActivePlayerIds().map((playerId) => buildPlayerState(playerId, context));
  return JSON.stringify({
    schemaVersion: 1,
    source: "ynamp-geographic-unlocks",
    status: isGeographicUnlockActiveMode()
      ? state?.status ?? (state?.liveUnlockTrackingImplemented ? "live-tracking" : "fallback-seeded")
      : "inactive",
    reason,
    mode,
    sourceMapName: context.sourceMapName,
    currentAgeType: context.currentAgeType,
    nextAgeType: context.nextAgeType,
    localPlayerId: typeof GameContext !== "undefined" ? GameContext.localPlayerID ?? null : null,
    turn: typeof Game !== "undefined" && typeof Game.getCurrentGameTurn === "function"
      ? Game.getCurrentGameTurn()
      : null,
    unlockReadSupported: typeof Game?.Unlocks?.isUnlockedForPlayer === "function",
    liveUnlockTrackingImplemented: state?.liveUnlockTrackingImplemented ?? false,
    errorCode: state?.errorCode ?? context.errorCode ?? null,
    playerStates
  });
}

function writeAutomationPayload(payload) {
  writeAutomationParameterPayload(AGE_TRANSITION_AUTOMATION_KEY, payload);
}

function writeTutorialPayload(payload) {
  writeTutorialPropertyPayload(AGE_TRANSITION_TUTORIAL_PROPERTY_KEY, payload);
}

function publishAgeTransitionPayload(reason) {
  const payload = buildAgeTransitionPayload(reason);
  writeAutomationPayload(payload);
  writeTutorialPayload(payload);
  logGeographicUnlock(`Published bridge payload reason=${reason} mode=${getGeographicUnlockMode()} players=${getActivePlayerIds().length} status=${geographicUnlockState?.status ?? "ok"}`);
}

function onGameStarted() {
  logGeographicUnlock("GameStarted received");
  cacheGeographicUnlockMapContextToAutomation("GameStarted");
  geographicUnlockState = isGeographicUnlockActiveMode() ? buildGeographicUnlockState("GameStarted") : null;
  resetNotificationSnapshots(geographicUnlockState);
  publishAgeTransitionPayload("GameStarted");
  notifyGeographicUnlockLensStateChanged("GameStarted");
}

function onPlotOwnershipChanged(eventData) {
  if (!isGeographicUnlockActiveMode() || !geographicUnlockState?.liveUnlockTrackingImplemented) {
    return;
  }
  const location = resolvePlotOwnershipLocation(eventData);
  if (!location) {
    return;
  }
  const plotIndex = getPlotIndex(location.x, location.y);
  if (plotIndex == null || !geographicUnlockState.trackedPlotIndices.has(plotIndex)) {
    return;
  }
  const previousOwnerId = geographicUnlockState.plotOwnerByIndex.get(plotIndex) ?? getNoPlayerId();
  const currentOwnerId = getPlotOwnerId(location.x, location.y);
  if (previousOwnerId === currentOwnerId) {
    return;
  }
  const localPlayerId = getLocalHumanPlayerId();
  const localChangeBatch = createNotificationChangeBatch();
  geographicUnlockState.plotOwnerByIndex.set(plotIndex, currentOwnerId);
  const zoneCandidateIds = geographicUnlockState.plotZoneIdsByIndex.get(plotIndex) ?? [];
  let hasPlayerSelectionChange = false;
  for (const candidateId of zoneCandidateIds) {
    if (geographicUnlockState.playerStates.has(previousOwnerId)) {
      hasPlayerSelectionChange = applyUnlockDeltaAndCollect(
        geographicUnlockState.playerStates.get(previousOwnerId),
        candidateId,
        -1,
        `PlotOwnershipChanged@${location.x},${location.y}`,
        previousOwnerId === localPlayerId ? localChangeBatch : null
      ) || hasPlayerSelectionChange;
    }
    if (geographicUnlockState.playerStates.has(currentOwnerId)) {
      hasPlayerSelectionChange = applyUnlockDeltaAndCollect(
        geographicUnlockState.playerStates.get(currentOwnerId),
        candidateId,
        1,
        `PlotOwnershipChanged@${location.x},${location.y}`,
        currentOwnerId === localPlayerId ? localChangeBatch : null
      ) || hasPlayerSelectionChange;
    }
  }
  if (hasPlayerSelectionChange) {
    publishAgeTransitionPayload(`PlotOwnershipChanged@${location.x},${location.y}`);
    notifyGeographicUnlockLensStateChanged(`PlotOwnershipChanged@${location.x},${location.y}`);
  }
  if (localChangeBatch.touchedIds.size > 0) {
    queuePendingGeographicUnlockNotification(
      localPlayerId,
      geographicUnlockState,
      localChangeBatch,
      `PlotOwnershipChanged@${location.x},${location.y}`
    );
  }
}

engine.on("GameStarted", onGameStarted);
engine.on("PlotOwnershipChanged", onPlotOwnershipChanged);