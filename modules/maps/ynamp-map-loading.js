// 
/**
 * ynamp-map-loading
 * 
 */
console.log("Generating using script ynamp-map-loading.js");
import { PlayerRegion, assignStartPositionsFromTiles, chooseStartSectors } from '/base-standard/maps/assign-starting-plots.js';
import { addMountains, addHills, buildRainfallMap } from '/base-standard/maps/elevation-terrain-generator.js';
import { addFeatures } from '/base-standard/maps/feature-biome-generator.js';
import * as globals from '/base-standard/maps/map-globals.js';
import * as utilities from '/base-standard/maps/map-utilities.js';
import { addNaturalWonders } from '/base-standard/maps/natural-wonder-generator.js';
import { generateResources } from '/base-standard/maps/resource-generator.js';
import { addVolcanoes } from '/base-standard/maps/volcano-generator.js';
import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { dumpPermanentSnow } from '/base-standard/maps/snow-generator.js';
import { dumpStartSectors, dumpContinents, dumpTerrain, dumpElevation, dumpRainfall, dumpBiomes, dumpFeatures, dumpResources, dumpNoisePredicate } from '/base-standard/maps/map-debug-helpers.js';
import * as ynamp from '/ged-ynamp/maps/ynamp-utilities.js';
import { isValidPlot, isSettlablePlot, isPlotTooCloseToUsed, findFallbackStartPlot } from '/ged-ynamp/maps/ynamp-utilities.js';
import { buildEarthMapContext, getEarthMapLabel, isEarthMapSyntheticWorldEndColumn, mapSourceToLocalCoordinate, setActiveEarthMapContext } from '/ged-ynamp/maps/earth-map-context.js';
import { getNWPlacementMode, placeCustomNaturalWonders } from '/ged-ynamp/maps/ynamp-natural-wonders.js';
import { applyRegionalResourcePlacement } from '/ged-ynamp/maps/ynamp-regional-resources.js';

const DEBUG = false;
const iMinFallbackDistance = 8;

function phase(name, fn) {
    if (!DEBUG) {
        return fn();
    }
    let start = Date.now();
    try {
        let result = fn();
        console.log("[YnAMP] Phase " + name + " completed in " + (Date.now() - start) + "ms");
        return result;
    } catch (err) {
        console.log("[YnAMP] Phase " + name + " failed: " + err);
        throw err;
    }
}

function getDiscoveryStartPositions(startPositions) {
    let discoveryStartPositions = Players.getAliveMajorIds()
        .map((playerId) => startPositions[playerId])
        .filter((plotIndex) => isValidPlot(plotIndex));

    return discoveryStartPositions.length > 10 ? discoveryStartPositions.slice(0, 10) : discoveryStartPositions;
}

// isValidPlot, isSettlablePlot, isPlotTooCloseToUsed, findFallbackStartPlot
// are imported from ynamp-utilities.js

function findNearestValidPlotTo(tslX, tslY, usedPlots, iWidth, iHeight) {
    let bestPlot = -1;
    let bestDist = Infinity;
    for (let y = 0; y < iHeight; y++) {
        for (let x = 0; x < iWidth; x++) {
            if (!isSettlablePlot(x, y)) continue;
            let plot = y * iWidth + x;
            if (usedPlots.has(plot)) continue;
            let dist = GameplayMap.getPlotDistance(tslX, tslY, x, y);
            if (dist < bestDist) {
                bestDist = dist;
                bestPlot = plot;
            }
        }
    }
    return bestPlot;
}

function buildTSLByCivilization(mapContext) {
    const tsl = {};
    for (let i = 0; i < GameInfo.StartPosition.length; ++i) {
        let row = GameInfo.StartPosition[i];
        if (row.MapName == mapContext.sourceMapName) {
            let localCoord = mapSourceToLocalCoordinate(row.X, row.Y, mapContext);
            if (localCoord) {
                tsl[row.Civilization] = localCoord;
            }
        }
    }
    return tsl;
}

function enforceHumanTSLStart(mapContext, iWidth) {
    let aliveMajorIds = Players.getAliveMajorIds();
    let humanPlayerId = -1;
    for (let i = 0; i < aliveMajorIds.length; i++) {
        if (Players.isHuman(aliveMajorIds[i])) {
            humanPlayerId = aliveMajorIds[i];
            break;
        }
    }

    if (humanPlayerId < 0) {
        return;
    }

    let everAlive = Players.getEverAlive()[humanPlayerId];
    if (!everAlive) {
        return;
    }

    let civRow = GameInfo.Civilizations.lookup(everAlive.civilizationType);
    if (!civRow) {
        return;
    }

    let tslByCivilization = buildTSLByCivilization(mapContext);
    let humanTSL = tslByCivilization[civRow.CivilizationType];
    if (!humanTSL) {
        return;
    }

    let iPlot = humanTSL.Y * iWidth + humanTSL.X;
    if (!isValidPlot(iPlot)) {
        return;
    }

    let previousPlot = StartPositioner.getStartPosition(humanPlayerId);
    StartPositioner.setStartPosition(iPlot, humanPlayerId);
    console.log("enforceHumanTSLStart: player " + humanPlayerId + " civ=" + civRow.CivilizationType + " start=" + humanTSL.X + "," + humanTSL.Y + " previousPlot=" + previousPlot + " newPlot=" + iPlot);
}

function dumpFinalMajorStarts(iWidth, iHeight, minDistance) {
    let aliveMajorIds = Players.getAliveMajorIds();

    // Build the set of already-assigned plots before assigning fallbacks
    let usedPlots = new Set();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        let plot = StartPositioner.getStartPosition(aliveMajorIds[i]);
        if (isValidPlot(plot)) {
            usedPlots.add(plot);
        }
    }

    // Assign fallback start positions to any player still unassigned
    for (let i = 0; i < aliveMajorIds.length; i++) {
        let iPlayer = aliveMajorIds[i];
        let plot = StartPositioner.getStartPosition(iPlayer);
        if (isValidPlot(plot)) {
            continue;
        }
        let fallbackPlot = findFallbackStartPlot(-1, usedPlots, iWidth, iHeight, minDistance);
        if (isValidPlot(fallbackPlot)) {
            StartPositioner.setStartPosition(fallbackPlot, iPlayer);
            usedPlots.add(fallbackPlot);
            console.log("FALLBACK START: player=" + iPlayer + " assigned plot=" + fallbackPlot + " xy=(" + (fallbackPlot % iWidth) + "," + Math.floor(fallbackPlot / iWidth) + ")");
        } else {
            console.log("FALLBACK START FAILED: player=" + iPlayer + " no valid plot found");
        }
    }

    for (let i = 0; i < aliveMajorIds.length; i++) {
        let iPlayer = aliveMajorIds[i];
        let plot = StartPositioner.getStartPosition(iPlayer);
        let x = isValidPlot(plot) ? plot % iWidth : -1;
        let y = isValidPlot(plot) ? Math.floor(plot / iWidth) : -1;
        let civTypeName = "UNKNOWN";
        let everAlive = Players.getEverAlive()[iPlayer];
        if (everAlive) {
            let civRow = GameInfo.Civilizations.lookup(everAlive.civilizationType);
            if (civRow) {
                civTypeName = civRow.CivilizationType;
            }
        }
        console.log("FinalStart: player=" + iPlayer + " civ=" + civTypeName + " plot=" + plot + " xy=(" + x + "," + y + ")");
    }
}

function rebalanceStartPositionCounts(iNumPlayers1, iNumPlayers2, targetTotal, requireBothSides) {
    let total = iNumPlayers1 + iNumPlayers2;

    if (targetTotal <= 0) {
        return { iNumPlayers1: 0, iNumPlayers2: 0 };
    }

    if (total <= 0) {
        return { iNumPlayers1: targetTotal, iNumPlayers2: 0 };
    }

    if (total == targetTotal) {
        return { iNumPlayers1, iNumPlayers2 };
    }

    let scaled1 = Math.round(iNumPlayers1 * targetTotal / total);
    let scaled2 = targetTotal - scaled1;

    if (requireBothSides && targetTotal >= 2) {
        if (scaled1 == 0) {
            scaled1 = 1;
            scaled2 = targetTotal - 1;
        }
        else if (scaled2 == 0) {
            scaled2 = 1;
            scaled1 = targetTotal - 1;
        }
    }

    return { iNumPlayers1: scaled1, iNumPlayers2: scaled2 };
}

function getAlivePlayersWithoutStartPositions() {
    let missingPlayerIds = [];
    let aliveIds = Players.getAliveIds();
    for (let i = 0; i < aliveIds.length; i++) {
        let playerId = aliveIds[i];
        if (StartPositioner.getStartPosition(playerId) === -1) {
            missingPlayerIds.push(playerId);
        }
    }
    return missingPlayerIds;
}

/**
 * Reads the HomelandMode map option and returns the effective mode string.
 * Falls back: 'landmass' if no XML data for the map.
 * @param {*} mapContext
 * @returns {'landmass'|'region'}
 */
function getEffectiveRegionMode(mapContext) {
    let rawMode = Configuration.getMapValue("HomelandMode");
    if (rawMode == null) {
        console.log("HomelandMode: landmass (default if no option set)");
        return "landmass";
    }
    let mode = Number(BigInt.asIntN(32, BigInt(rawMode)));
    const regionHash   = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_HOMELAND_REGION"))));

    if (mode === regionHash) {
        if (ynamp.hasRegionPositionData(mapContext)) {
            console.log("HomelandMode: region (XML data available)");
            return "region";
        }
        console.log("HomelandMode: region requested but no XML data for '" + getEarthMapLabel(mapContext) + "', falling back to landmass");
        return "landmass";
    }
    // Default: landmass (covers YNAMP_HOMELAND_LANDMASS hash and any unexpected value)
    console.log("HomelandMode: landmass");
    return "landmass";
}

function buildPlayerRegionsFromSectors(iWidth, iHeight, iStartSectorRows, iStartSectorCols, startSectors, playerCount, mapContext) {
    const playableWest = mapContext?.livePlayableStartX ?? 0;
    const playableEast = mapContext?.livePlayableEndX ?? iWidth - 1;
    const playableWidth = Math.max(1, playableEast - playableWest + 1);
    const sectorSplit = playableWest + Math.floor(playableWidth / 2);
    const firstEastSector = iStartSectorRows * iStartSectorCols;
    const selectedSectors = [];

    for (let iSector = 0; iSector < startSectors.length; iSector++) {
        if (startSectors[iSector]) {
            selectedSectors.push(iSector);
        }
    }
    for (let iSector = 0; iSector < startSectors.length && selectedSectors.length < playerCount; iSector++) {
        if (!startSectors[iSector]) {
            selectedSectors.push(iSector);
        }
    }

    const playerRegions = [];
    for (let i = 0; i < selectedSectors.length && playerRegions.length < playerCount; i++) {
        const sectorId = selectedSectors[i];
        const sectorRegion = utilities.getSectorRegion(
            sectorId,
            iStartSectorRows,
            iStartSectorCols,
            globals.g_PolarWaterRows,
            iHeight - globals.g_PolarWaterRows,
            playableWest,
            sectorSplit,
            sectorSplit
        );
        const playerRegion = new PlayerRegion();
        playerRegion.regionId = playerRegions.length;
        playerRegion.landmassId = sectorId >= firstEastSector ? 1 : 0;

        for (let iY = Math.max(0, sectorRegion.south); iY <= Math.min(iHeight - 1, sectorRegion.north); iY++) {
            for (let iX = Math.max(0, sectorRegion.west); iX <= Math.min(iWidth - 1, sectorRegion.east); iX++) {
                if (isEarthMapSyntheticWorldEndColumn(iX, mapContext)) {
                    continue;
                }
                playerRegion.tiles.push({ x: iX, y: iY });
            }
        }

        playerRegions.push(playerRegion);
    }

    console.log("buildPlayerRegionsFromSectors: selected " + selectedSectors.length + " sectors, built " + playerRegions.length + " player regions for " + playerCount + " majors");
    return playerRegions;
}

export function generateYnAMP(mapName, importedMap, genParameters) {

    //let importedMap = GetMap();
    let mapType = ynamp.getMapType(importedMap);
    let version = ynamp.getVersion(); //GlobalParameters.YNAMP_VERSION;
    console.log("YnAMP v" + version + " - Generating map type : " + mapType);

    let naturalWonderEvent = false;
    const liveEventDBRow = GameInfo.GlobalParameters.lookup("REGISTERED_RACE_TO_WONDERS_EVENT");
    if (liveEventDBRow && liveEventDBRow.Value != "0") {
        naturalWonderEvent = true;
    }
    console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
    let iWidth = GameplayMap.getGridWidth();
    let iHeight = GameplayMap.getGridHeight();
    let mapContext = buildEarthMapContext(mapName, iWidth, iHeight, genParameters);
    setActiveEarthMapContext(mapContext);
    let uiMapSize = GameplayMap.getMapSize();
    console.log("uiMapSize = " + uiMapSize);
    let startPositions = [];
    let mapInfo = GameInfo.Maps.lookup(uiMapSize);
    if (mapInfo == null)
        return;
    let startSectors;
    let iNumPlayers1 = mapInfo.PlayersLandmass1;
    let iNumPlayers2 = mapInfo.PlayersLandmass2;
    let iNumNaturalWonders = mapInfo.NumNaturalWonders;
    let iStartSectorRows = mapInfo.StartSectorRows;
    let iStartSectorCols = mapInfo.StartSectorCols;
    let aliveMajorIds = Players.getAliveMajorIds();
    let requireBothSides = mapInfo.PlayersLandmass1 > 0 && mapInfo.PlayersLandmass2 > 0;
    let adjustedCounts = rebalanceStartPositionCounts(iNumPlayers1, iNumPlayers2, aliveMajorIds.length, requireBothSides);
    iNumPlayers1 = adjustedCounts.iNumPlayers1;
    iNumPlayers2 = adjustedCounts.iNumPlayers2;

    console.log("Adjusted iNumPlayers1 = " + iNumPlayers1);
    console.log("Adjusted iNumPlayers2 = " + iNumPlayers2);

    let bHumanNearEquator = utilities.needHumanNearEquator();
    startSectors = chooseStartSectors(iNumPlayers1, iNumPlayers2, iStartSectorRows, iStartSectorCols, bHumanNearEquator);

    // Validate importedMap dimensions match mapContext expectations before any lookup
    if (mapContext) {
        let importedWidth = importedMap?.length ?? 0;
        let importedHeight = importedWidth > 0 && importedMap[0] ? importedMap[0].length : 0;
        if (importedWidth !== mapContext.sourceWidth || importedHeight !== mapContext.sourceHeight) {
            console.log(
                "YnAMP importedMap size mismatch: importedSize=" + importedWidth + "x" + importedHeight +
                " expected=" + mapContext.sourceWidth + "x" + mapContext.sourceHeight +
                " map=" + mapContext.mapName +
                " — source lookups will miss, check SourceMapName or the source-map size resolver"
            );
        } else {
            console.log(
                "YnAMP importedMap validated: " + importedWidth + "x" + importedHeight +
                " sourceStart=(" + mapContext.sourceStartX + "," + mapContext.sourceStartY + ")" +
                " sourceEnd=(" + mapContext.sourceEndX + "," + mapContext.sourceEndY + ")" +
                " cropWidth=" + mapContext.cropWidth +
                " livePlayableStartX=" + mapContext.livePlayableStartX
            );
        }
    }

    ynamp.createMapTerrains(iWidth, iHeight,  importedMap, mapType, mapContext);
    
    
    console.log("validateAndFixTerrain (1)...");
    TerrainBuilder.validateAndFixTerrain();
    
    console.log("recalculateAreas (1)");
    AreaBuilder.recalculateAreas();

    // TODO : optional additional placement (menu check box)
    //console.log("addMountains...");
    //addMountains(iWidth, iHeight);

    if (mapType == 'CIV6') {
        let numPlaced = placeVolcanoes(mapName, mapContext);
        console.log("Num Volcanoes = " + numPlaced);
        if (numPlaced == 0) {
            addVolcanoes(iWidth, iHeight);
        }
    }
        
    console.log("buildElevation...");
    TerrainBuilder.buildElevation();
    console.log("addHills...");
    addHills(iWidth, iHeight);
    console.log("buildRainfallMap...");
    buildRainfallMap(iWidth, iHeight);
    console.log("modelRivers...");
    TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
    
    // debugging (crashes after river generation) 
    console.log("validateAndFixTerrain (debug)...")
    TerrainBuilder.validateAndFixTerrain();    

    console.log("River Dump");
    ynamp.dumpRivers(iWidth, iHeight);
    console.log("validateAndFixTerrain (2)...");    
    TerrainBuilder.validateAndFixTerrain(); // crashes here ?
    console.log("defineNamedRivers...");
    TerrainBuilder.defineNamedRivers();
    ynamp.createBiomes(iWidth, iHeight, importedMap, mapType, mapContext); //designateBiomes(iWidth, iHeight);
    
    // Assign continents after terrain and biomes are properly placed on the map
    console.log("stampContinents...");
    TerrainBuilder.stampContinents();
    
    const nwMode = getNWPlacementMode();
    console.log("NWPlacementMode: " + nwMode);
    if (nwMode === "random") {
        // Skip real-world positions entirely â€” place all wonders randomly.
        addNaturalWonders(iWidth, iHeight, iNumNaturalWonders, naturalWonderEvent);
    } else if (nwMode === "real-only") {
        // Verify the constraint-removal SQL actually took effect.
        const constraintTags = new Set(['ADJACENTMOUNTAIN','NOTADJACENTMOUNTAIN','NOTADJACENTTORIVER',
            'ADJACENTTOSAMEBIOME','NOTNEARCOAST','NEARCOAST','ADJACENTTOLAND','ADJACENTTOCOAST',
            'NOTADJACENTTOLAND','ADJACENTCLIFF','NOLANDOPPOSITECLIFF','ADJACENTTOSAMETERRAIN',
            'NOTADJACENTTOICE','SHALLOWWATER','SIMALARELEVATION']);
        const nwTypes = new Set([...GameInfo.Feature_NaturalWonders].map(nw => nw.FeatureType));
        const remaining = [...GameInfo.TypeTags].filter(tt => nwTypes.has(tt.Type) && constraintTags.has(tt.Tag));
        console.log("NW constraint TypeTags remaining after SQL: " + remaining.length
            + (remaining.length > 0 ? " [" + remaining.map(tt => tt.Type + "." + tt.Tag).join(", ") + "]" : ""));
        // Place XML real-world positions only; do not fill remaining slots randomly.
        placeCustomNaturalWonders(mapName, mapContext);
    } else {
        // "real-and-random" (default): place XML positions first, fill remainder randomly.
        const { count: customWonderCount } = placeCustomNaturalWonders(mapName, mapContext);
        const remainingWonderSlots = Math.max(0, iNumNaturalWonders - customWonderCount);
        if (remainingWonderSlots > 0) {
            addNaturalWonders(iWidth, iHeight, remainingWonderSlots, naturalWonderEvent);
        } else {
            console.log("All natural wonder slots filled by custom placement, skipping random placement.");
        }
    }
    console.log("addFloodplains...");
    TerrainBuilder.addFloodplains(4, 10);
    // TODO : optional for civ7 maps (menu check box)
    // TODO : convert features for civ6 maps
    addFeatures(iWidth, iHeight);    
    if (mapType == 'CIV6') {
        ynamp.extraJungle(iWidth, iHeight, importedMap, mapContext);
    } else {
        ynamp.placeFeatures(iWidth, iHeight, importedMap, mapType, mapContext);
    }
    console.log("validateAndFixTerrain (3)")
    //TerrainBuilder.validateAndFixTerrain();
    const regionMode = getEffectiveRegionMode(mapContext);
    console.log("recalculateAreas (3)");
    AreaBuilder.recalculateAreas();
    TerrainBuilder.storeWaterData();
    //generateSnow(iWidth, iHeight);
    if (mapType == 'CIV6') {
        ynamp.importSnow(iWidth, iHeight, importedMap, mapContext);
    }
    console.log("Debug dump...");
    dumpStartSectors(startSectors);
    dumpContinents(iWidth, iHeight);
    dumpTerrain(iWidth, iHeight);
    dumpElevation(iWidth, iHeight);
    console.log("Rainfall Dump");
    dumpRainfall(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);
    dumpPermanentSnow(iWidth, iHeight);
    console.log("generateResources...");
    // Use base game resource generator
    // TODO : optional for civ7 maps (menu check box)
    // TODO : convert resources for civ6 maps
    generateResources(iWidth, iHeight);
    
    if (mapType == 'CIV7') {
        ynamp.placeResources(iWidth, iHeight, importedMap, mapType, mapContext);
    }
    phase("applyRegionalResourcePlacement", () => applyRegionalResourcePlacement(iWidth, iHeight, mapContext));
    ynamp.enforceSyntheticWorldEndColumns(iWidth, iHeight, mapContext);

    let playerRegions = buildPlayerRegionsFromSectors(iWidth, iHeight, iStartSectorRows, iStartSectorCols, startSectors, aliveMajorIds.length, mapContext);
    startPositions = phase("assignStartPositionsFromTiles", () => assignStartPositionsFromTiles(playerRegions));
    startPositions = assignTSL(mapContext, startPositions);

    enforceHumanTSLStart(mapContext, iWidth);

    phase("generateDiscoveries", () => {
        // Limit to 10 players for discoveries (base game limitation)
        let discoveryStartPositions = getDiscoveryStartPositions(startPositions);
        generateDiscoveries(iWidth, iHeight, discoveryStartPositions, 2);
    });
    ynamp.validate(iWidth, iHeight, iNumPlayers1, iNumPlayers2, null, null, startPositions, mapName);
    console.log("dumpResources...");
    dumpResources(iWidth, iHeight);
    FertilityBuilder.recalculate(); // Must be after features are added.
    dumpFinalMajorStarts(iWidth, iHeight, iMinFallbackDistance);
    let seed = GameplayMap.getRandomSeed(); // can use any seed you want for different noises
    let avgDistanceBetweenPoints = 3;
    let normalizedRangeSmoothing = 2;
    console.log("generatePoissonMap...");
    let poisson = TerrainBuilder.generatePoissonMap(seed, avgDistanceBetweenPoints, normalizedRangeSmoothing);
    let poissonPred = (val) => {
        return val >= 1 ? "*" : " ";
    };
    dumpNoisePredicate(iWidth, iHeight, poisson, poissonPred);
    
    // Assign homeland/distant lands classification (post-placement, after all start positions are set)
    if (regionMode == "region") {
        // XML superregion classification (EurAsia/Africa/Americas/Oceania) for Earth maps
        console.log("Using XML-based superregion classification (region mode)");
        ynamp.overrideHomelandsWithXMLRegions(iWidth, iHeight, mapContext);
    } else {
        // BFS connectivity from player starts - ocean-blocked, orientation-agnostic
        console.log("Using connectivity-based landmass classification (landmass mode)");
        ynamp.overrideHomelandsWithLandmass(iWidth, iHeight);
    }

    let missingStartPlayerIds = getAlivePlayersWithoutStartPositions();
    if (missingStartPlayerIds.length == 0) {
        assignAdvancedStartRegions();
    } else {
        console.log("Skipping assignAdvancedStartRegions: missing start position for player IDs: " + missingStartPlayerIds.join(","));
    }

    // add impassable terrain to prevent East-West wrap on regional maps
    ynamp.enforceSyntheticWorldEndColumns(iWidth, iHeight, mapContext);

}


function placeVolcanoes(mapName, mapContext) {
    console.log("YNAMP - Place Volcanoes for map " + mapName);
    let numPlaced = 0;
    const sourceMapName = mapContext?.sourceMapName ?? mapName;
    for (let i = 0; i < GameInfo.ExtraPlacement.length; ++i) {
        let row = GameInfo.ExtraPlacement[i];
        if (row.MapName == sourceMapName && row.FeatureType == 'FEATURE_VOLCANO') {
            let localCoord = mapSourceToLocalCoordinate(row.X, row.Y, mapContext);
            if (!localCoord) {
                continue;
            }
            TerrainBuilder.setTerrainType(localCoord.X, localCoord.Y, globals.g_MountainTerrain);
            const featureParam = {
                Feature: globals.g_VolcanoFeature,
                Direction: -1,
                Elevation: 0
            };
            TerrainBuilder.setFeatureType(localCoord.X, localCoord.Y, featureParam);
            console.log("Volcano Placed at (x, y): " + localCoord.X + ", " + localCoord.Y + " [source: " + row.X + ", " + row.Y + "]");
            numPlaced++;
        }
    }
    console.log("   - placed : " + numPlaced);
    return numPlaced;
}

// Merge true-start positions with tile-based defaults from assignStartPositionsFromTiles.
function assignTSL(mapContext, defaultStartPositions) {
    console.log("Assigning YnAMP TSL for " + getEarthMapLabel(mapContext));
    const startPositions = []; // Plot indices for start positions chosen
    const TSL = buildTSLByCivilization(mapContext);
    const iWidth = GameplayMap.getGridWidth();
    const iHeight = GameplayMap.getGridHeight();
    const usedPlots = new Set();

    // The index values we will be dealing with in this function, correspond to the index
    // in the Alive Majors array.
    let aliveMajorIds = Players.getAliveMajorIds();
    let civToPlayers = {};
    let humanPlayerId = -1;

    for (let i = 0; i < aliveMajorIds.length; i++) {
        let iPlayer = aliveMajorIds[i];
        if (Players.isHuman(iPlayer)) {
            humanPlayerId = iPlayer;
        }
        let uiCivType = Players.getEverAlive()[iPlayer].civilizationType;
        let civTypeName = GameInfo.Civilizations.lookup(uiCivType).CivilizationType;
        if (!civToPlayers[civTypeName]) {
            civToPlayers[civTypeName] = [];
        }
        civToPlayers[civTypeName].push(iPlayer);
    }

    let primaryTSLOwnerByCiv = {};
    for (let civTypeName in civToPlayers) {
        let players = civToPlayers[civTypeName];
        let hasDuplicate = players.length > 1;
        if (!hasDuplicate) {
            continue;
        }
        if (players.indexOf(humanPlayerId) !== -1) {
            primaryTSLOwnerByCiv[civTypeName] = humanPlayerId;
        } else {
            primaryTSLOwnerByCiv[civTypeName] = players[0];
        }
        console.log("Duplicate civ detected: " + civTypeName + " players=" + players.join(",") + " primaryTSLOwner=" + primaryTSLOwnerByCiv[civTypeName]);
    }

    for (let i = 0; i < aliveMajorIds.length; i++) {

        //console.log("aliveMajorIds["+i+"] = "+ aliveMajorIds[i]);

        let iPlayer = aliveMajorIds[i];
        let uiCivType = Players.getEverAlive()[iPlayer].civilizationType;
        let civTypeName = GameInfo.Civilizations.lookup(uiCivType).CivilizationType;
        //console.log("uiCivType = "+ uiCivType);
        console.log("CivType = " + civTypeName);

        let startPosition = TSL[civTypeName];
        if (startPosition === undefined) {
            let iPlot = defaultStartPositions[iPlayer];
            if (!isValidPlot(iPlot)) {
                console.log("NO TSL FOR PLAYER: " + civTypeName + " " + iPlayer);
            } else {
                console.log("NO TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " Use default start position (" + Math.floor(iPlot / iWidth) + ", " + iPlot % iWidth + ")");
                startPositions[iPlayer] = iPlot;
                StartPositioner.setStartPosition(iPlot, iPlayer);
                usedPlots.add(iPlot);
            }
        } else {
            let iPlot = startPosition.Y * iWidth + startPosition.X;
            let duplicatePlayers = civToPlayers[civTypeName];
            let hasDuplicate = duplicatePlayers && duplicatePlayers.length > 1;

            if (hasDuplicate && iPlayer != primaryTSLOwnerByCiv[civTypeName]) {
                let defaultPlot = defaultStartPositions[iPlayer];
                if (isValidPlot(defaultPlot)) {
                    console.log("DUPLICATE TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " using tile-based default (" + Math.floor(defaultPlot / iWidth) + ", " + defaultPlot % iWidth + ")");
                    startPositions[iPlayer] = defaultPlot;
                    StartPositioner.setStartPosition(defaultPlot, iPlayer);
                    usedPlots.add(defaultPlot);
                } else {
                    console.log("DUPLICATE TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " and no valid tile-based default start position");
                }
                continue;
            }

            if (GameplayMap.isNaturalWonder(startPosition.X, startPosition.Y)) {
                let adjustedPlot = findNearestValidPlotTo(startPosition.X, startPosition.Y, usedPlots, iWidth, iHeight);
                if (isValidPlot(adjustedPlot)) {
                    let ax = adjustedPlot % iWidth;
                    let ay = Math.floor(adjustedPlot / iWidth);
                    console.log("TSL ON NATURAL WONDER: " + civTypeName + " displaced from (" + startPosition.X + ", " + startPosition.Y + ") to nearest valid plot (" + ax + ", " + ay + ")");
                    iPlot = adjustedPlot;
                } else {
                    console.log("TSL ON NATURAL WONDER: " + civTypeName + " could not find valid nearby plot, keeping original (" + startPosition.X + ", " + startPosition.Y + ")");
                }
            }
            startPositions[iPlayer] = iPlot;
            console.log("TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " (" + startPosition.X + ", " + startPosition.Y + ")");
            StartPositioner.setStartPosition(iPlot, iPlayer);
            usedPlots.add(iPlot);
        }
    }

    return startPositions;
}

console.log("Loaded ynamp-map-loading.js");
