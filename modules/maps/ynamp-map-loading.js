// Continents.ts
/**
 * ynamp-map-loading
 * 
 */
console.log("Generating using script ynamp-map-loading.js");
import { assignStartPositions, chooseStartSectors } from '/base-standard/maps/assign-starting-plots.js';
import { addMountains, addHills, buildRainfallMap, generateLakes } from '/base-standard/maps/elevation-terrain-generator.js';
import { addFeatures, designateBiomes } from '/base-standard/maps/feature-biome-generator.js';
import * as globals from '/base-standard/maps/map-globals.js';
import * as utilities from '/base-standard/maps/map-utilities.js';
import { addNaturalWonders } from '/base-standard/maps/natural-wonder-generator.js';
import { generateResources } from '/base-standard/maps/resource-generator.js';
import { addVolcanoes } from '/base-standard/maps/volcano-generator.js';
import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { generateSnow, dumpPermanentSnow } from '/base-standard/maps/snow-generator.js';
import { dumpStartSectors, dumpContinents, dumpTerrain, dumpElevation, dumpRainfall, dumpBiomes, dumpFeatures, dumpResources, dumpNoisePredicate } from '/base-standard/maps/map-debug-helpers.js';
import * as ynamp from '/ged-ynamp/maps/ynamp-utilities.js';
import { isValidPlot, isSettlablePlot, isPlotTooCloseToUsed, findFallbackStartPlot } from '/ged-ynamp/maps/ynamp-utilities.js';

/**
 * @typedef {Object} ContinentBounds
 * @property {number} west
 * @property {number} east
 * @property {number} south
 * @property {number} north
 * @property {number} continent
 */

/**
 * @typedef {Object} MapContext
 * @property {string} mapName
 * @property {*} importedMap
 * @property {*} genParameters
 * @property {string} mapType
 * @property {string|number} version
 * @property {boolean} naturalWonderEvent
 * @property {number} iWidth
 * @property {number} iHeight
 * @property {number} uiMapSize
 * @property {*} mapInfo
 * @property {{westContinent: ContinentBounds, eastContinent: ContinentBounds, westContinent2: ContinentBounds, eastContinent2: ContinentBounds}} continents
 * @property {number} iNumPlayers1
 * @property {number} iNumPlayers2
 * @property {number} iNumNaturalWonders
 * @property {number} iTilesPerLake
 * @property {number} iStartSectorRows
 * @property {number} iStartSectorCols
 */

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

/**
 * @param {number} iWidth
 * @param {number} iHeight
 * @param {*} genParameters
 */
function buildContinentBounds(iWidth, iHeight, genParameters) {
    let westContinent = {
        west: genParameters.westStart,
        east: genParameters.westEnd,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let eastContinent = {
        west: genParameters.eastStart,
        east: genParameters.eastEnd,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 1
    };
    let westContinent2 = {
        west: globals.g_AvoidSeamOffset,
        east: globals.g_AvoidSeamOffset + globals.g_IslandWidth,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 2
    };
    let eastContinent2 = {
        west: genParameters.westEnd + globals.g_AvoidSeamOffset,
        east: genParameters.westEnd + globals.g_AvoidSeamOffset + globals.g_IslandWidth,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 3
    };

    return { westContinent, eastContinent, westContinent2, eastContinent2 };
}

/**
 * @param {MapContext} ctx
 */
function buildMapContext(ctx) {
    return ctx;
}

function getDiscoveryStartPositions(startPositions) {
    return startPositions.length > 10 ? startPositions.slice(0, 10) : startPositions;
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

function buildTSLByCivilization(mapName) {
    const tsl = {};
    for (let i = 0; i < GameInfo.StartPosition.length; ++i) {
        let row = GameInfo.StartPosition[i];
        if (row.MapName == mapName) {
            tsl[row.Civilization] = { X: row.X, Y: row.Y };
        }
    }
    return tsl;
}

function enforceHumanTSLStart(mapName, iWidth) {
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

    let tslByCivilization = buildTSLByCivilization(mapName);
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

function hasValidTSLForAllAliveMajors(trueStartPositions, aliveMajorIds) {
    if (!Array.isArray(trueStartPositions) || trueStartPositions.length < aliveMajorIds.length) {
        return false;
    }

    for (let i = 0; i < aliveMajorIds.length; i++) {
        let plotIndex = trueStartPositions[i];
        if (plotIndex === undefined || plotIndex === null || isNaN(plotIndex) || plotIndex < 0) {
            return false;
        }
    }

    return true;
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

function countLandWater(iWidth, iHeight) {
    let waterPlotCount = 0;
    let landPlotCount = 0;
    for (let iX = 0; iX < iWidth; iX++) {
        for (let iY = 0; iY < iHeight; iY++) {
            if (GameplayMap.isWater(iX, iY)) {
                waterPlotCount++;
            } else {
                landPlotCount++;
            }
        }
    }
    return { landPlotCount, waterPlotCount };
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
 * Reads the RegionTaggingMode map option and returns the effective mode string.
 * Falls back gracefully: 'region' → 'east-west' if no XML data for the map.
 * @param {string} mapName
 * @returns {'landmass'|'east-west'|'region'}
 */
function getEffectiveRegionMode(mapName) {
    let rawMode = Configuration.getMapValue("RegionTaggingMode");
    if (rawMode == null) {
        console.log("RegionTaggingMode: landmass (default — no option set)");
        return "landmass";
    }
    let mode = Number(BigInt.asIntN(32, BigInt(rawMode)));
    const eastWestHash = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_REGION_MODE_EAST_WEST"))));
    const regionHash   = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_REGION_MODE_REGION"))));

    if (mode === eastWestHash) {
        console.log("RegionTaggingMode: east-west (user selected)");
        return "east-west";
    }
    if (mode === regionHash) {
        if (ynamp.hasRegionPositionData(mapName)) {
            console.log("RegionTaggingMode: region (XML data available)");
            return "region";
        }
        console.log("RegionTaggingMode: region requested but no XML data for '" + mapName + "', falling back to east-west");
        return "east-west";
    }
    // Default: landmass (covers YNAMP_REGION_MODE_LANDMASS hash and any unexpected value)
    console.log("RegionTaggingMode: landmass");
    return "landmass";
}

/**
 * Tags coast water tiles with plot tags and (in east-west mode) landmass region IDs.
 * In landmass/region modes, land tile tagging is deferred to the post-placement override
 * functions (overrideHomelandsWithLandmass / overrideHomelandsWithXMLRegions).
 * @param {string} mode - 'east-west' | 'landmass' | 'region'
 */
function tagHemispherePlots(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2, mapName, mode) {
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = GameplayMap.getTerrainType(iX, iY);
            // Tag coast water tiles for hemisphere assignment
            if (terrain == globals.g_CoastTerrain) {
                TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WATER);
                let isEastWater;
                if (iNumPlayers1 > iNumPlayers2) {
                    isEastWater = (iX < westContinent.west - 2 || iX > westContinent.east + 2);
                } else {
                    isEastWater = !(iX > eastContinent.east + 2 || iX < eastContinent.west - 2);
                }
                if (isEastWater) {
                    TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_WATER);
                    if (mode == "east-west") TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_EAST);
                } else {
                    TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_WATER);
                    if (mode == "east-west") TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_WEST);
                }
            }
            // Tag land tiles only in east-west mode; landmass/region modes handle this post-placement
            else if (!GameplayMap.isWater(iX, iY) && mode == "east-west") {
                if (iNumPlayers1 > iNumPlayers2) {
                    // West continent is homeland, East continent is distant land
                    if (iX < westContinent.west - 2 || iX > westContinent.east + 2) {
                        TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS);
                        TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_EAST);
                    } else {
                        TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_LANDMASS);
                        TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_WEST);
                    }
                } else {
                    // East continent is homeland, West continent is distant land
                    if (iX > eastContinent.east + 2 || iX < eastContinent.west - 2) {
                        TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_LANDMASS);
                        TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_EAST);
                    } else {
                        TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS);
                        TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_WEST);
                    }
                }
            }
        }
    }
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
    let uiMapSize = GameplayMap.getMapSize();
    console.log("uiMapSize = " + uiMapSize);
    let startPositions = [];
    let trueStartPositions = [];
    let mapInfo = GameInfo.Maps.lookup(uiMapSize);
    if (mapInfo == null)
        return;
    // Establish continent boundaries
    let continents = buildContinentBounds(iWidth, iHeight, genParameters);
    let westContinent = continents.westContinent;
    let eastContinent = continents.eastContinent;
    let westContinent2 = continents.westContinent2;
    let eastContinent2 = continents.eastContinent2;
    console.log("westContinent = { west:", westContinent.west, ", east:", westContinent.east, ", south:", westContinent.south, ", north:", westContinent.north, ", continent:", westContinent.continent, "}");
    console.log("eastContinent = { west:", eastContinent.west, ", east:", eastContinent.east, ", south:", eastContinent.south, ", north:", eastContinent.north, ", continent:", eastContinent.continent, "}");
    console.log("westContinent2 = { west:", westContinent2.west, ", east:", westContinent2.east, ", south:", westContinent2.south, ", north:", westContinent2.north, ", continent:", westContinent2.continent, "}");
    console.log("eastContinent2 = { west:", eastContinent2.west, ", east:", eastContinent2.east, ", south:", eastContinent2.south, ", north:", eastContinent2.north, ", continent:", eastContinent2.continent, "}");
    let startSectors;
    let iNumPlayers1 = mapInfo.PlayersLandmass1;
    let iNumPlayers2 = mapInfo.PlayersLandmass2;
    let iNumNaturalWonders = mapInfo.NumNaturalWonders;
    let iTilesPerLake = mapInfo.LakeGenerationFrequency;
    let iStartSectorRows = mapInfo.StartSectorRows;
    let iStartSectorCols = mapInfo.StartSectorCols;

    let ctx = buildMapContext({
        mapName,
        importedMap,
        genParameters,
        mapType,
        version,
        naturalWonderEvent,
        iWidth,
        iHeight,
        uiMapSize,
        mapInfo,
        continents,
        iNumPlayers1,
        iNumPlayers2,
        iNumNaturalWonders,
        iTilesPerLake,
        iStartSectorRows,
        iStartSectorCols
    });

    // Assign TSL in multiple passes to handle cases when a custom/DLC civ doesn't have a TSL
    // Check first which hemisphere should be homeland
    console.log("assignTSL...(1st pass)");
    trueStartPositions = assignTSL(mapName, startPositions);

    let aliveMajorIds = Players.getAliveMajorIds();

    let eastWestLimit = (westContinent.east + eastContinent.west) / 2; //(westContinent.west + eastContinent.east) / 2;
    console.log("East/West limit is " + eastWestLimit);

    let westTSL = 0;
    let eastTSL = 0;
    for (let aliveMajorIndex = 0; aliveMajorIndex < aliveMajorIds.length; aliveMajorIndex++) {
        if (aliveMajorIndex < aliveMajorIds.length) {
            let startPlotIndex = trueStartPositions[aliveMajorIndex];
            let iStartX = startPlotIndex % GameplayMap.getGridWidth();
            let iStartY = Math.floor(startPlotIndex / GameplayMap.getGridWidth());

            if (Players.isHuman(aliveMajorIds[aliveMajorIndex])) {
                if (!isNaN(iStartX)) {
                    if (iStartX < eastWestLimit) {
                        console.log("Player #" + aliveMajorIndex + " (ID " + aliveMajorIds[aliveMajorIndex] + ") with TSL is human (" + iStartX + " ," + iStartY + ") and will start in the WEST");
                        westTSL++;
                    }
                    else {
                        console.log("Player #" + aliveMajorIndex + " (ID " + aliveMajorIds[aliveMajorIndex] + ") with TSL is human (" + iStartX + " ," + iStartY + ") and will start in the EAST");
                        eastTSL++;
                    }
                }
            }

        }
        else {
            console.log("Player #" + aliveMajorIndex + " (ID " + aliveMajorIds[aliveMajorIndex] + ") is AI (" + iStartX + " ," + iStartY + ")");
        }
    }

    let iRandom = !naturalWonderEvent ? TerrainBuilder.getRandomNumber(2, "East or West") : 0; // don't want random hemisphere shuffle for live event

    if (eastTSL > westTSL) {
        console.log("Random = 1 (East) because " + eastTSL + " human player(s) with TSL start in the East and " + westTSL + " start in the West");
        iRandom = 1;
    }
    else if (eastTSL < westTSL) {
        console.log("Random = 0 (West) because " + westTSL + " human player(s) with TSL start in the East and " + eastTSL + " start in the Est");
        iRandom = 0;
    }

    console.log("Random Hemisphere: " + iRandom);
    if (iRandom == 1) {
        let iNum1 = iNumPlayers1;
        let iNum2 = iNumPlayers2;
        iNumPlayers1 = iNum2;
        iNumPlayers2 = iNum1;
    }
    
    console.log("Players.getAliveMajorIds().length = " + aliveMajorIds.length);
    console.log("iNumPlayers1 = " + iNumPlayers1);
    console.log("iNumPlayers2 = " + iNumPlayers2);

    // assignStartPositions can fail with very high player counts; scale assignment counts safely.
    // We still apply full TSL afterwards, so majors above this cap can keep their TSL starts.

    const maxAssignStartPlayers = 10;
    let assignableMajorCount = Math.min(aliveMajorIds.length, maxAssignStartPlayers);
    let requireBothSides = mapInfo.PlayersLandmass1 > 0 && mapInfo.PlayersLandmass2 > 0;
    let adjustedCounts = rebalanceStartPositionCounts(iNumPlayers1, iNumPlayers2, assignableMajorCount, requireBothSides);
    iNumPlayers1 = adjustedCounts.iNumPlayers1;
    iNumPlayers2 = adjustedCounts.iNumPlayers2;
    
    console.log("Adjusted iNumPlayers1 = " + iNumPlayers1);
    console.log("Adjusted iNumPlayers2 = " + iNumPlayers2);
    if (aliveMajorIds.length > maxAssignStartPlayers) {
        console.log("Players.getAliveMajorIds().length = " + aliveMajorIds.length + " (capped to " + assignableMajorCount + " for assignStartPositions)");
    }

    let bHumanNearEquator = utilities.needHumanNearEquator();
    startSectors = chooseStartSectors(iNumPlayers1, iNumPlayers2, iStartSectorRows, iStartSectorCols, bHumanNearEquator);
    ynamp.createMapTerrains(iWidth, iHeight, westContinent, eastContinent, importedMap, mapType);
    
    // May use those with an option to add random islands on custom maps
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 4);
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 5);
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 6);
    
    console.log("validateAndFixTerrain (1)...");
    TerrainBuilder.validateAndFixTerrain();
    
    console.log("recalculateAreas (1)");
    AreaBuilder.recalculateAreas();
    console.log("addMountains...");
    addMountains(iWidth, iHeight);
    let numPlaced = placeVolcanoes(mapName);
    console.log("Num Volcanoes = " + numPlaced);
    if (numPlaced == 0) {
        addVolcanoes(iWidth, iHeight);
    }
    console.log("generateLakes...");
    generateLakes(iWidth, iHeight, iTilesPerLake);
    console.log("recalculateAreas (2)");
    AreaBuilder.recalculateAreas();
    console.log("buildElevation...");
    TerrainBuilder.buildElevation();
    console.log("addHills...");
    addHills(iWidth, iHeight);
    console.log("buildRainfallMap...");
    // test high rainfall near Rome for river
    //if (mapName == 'GreatestEarthMap') {
    //    TerrainBuilder.setRainfall(50, 43, 1500);
    //}
    
    // debugging (crashes after river generation) 
    console.log("validateAndFixTerrain (debug)...")
    TerrainBuilder.validateAndFixTerrain();    

    if (mapType == 'XCIV6') { // test to guide rivers generation

        console.log("dump civ6 imported map river plots")
        ynamp.dumpciv6ImportedRivers(iWidth, iHeight, importedMap)

        // Save the current map terrain
        let tempTerrain = [];    
        for (let iY = 0; iY < iHeight; iY++) {
            for (let iX = 0; iX < iWidth; iX++) {
                if (!tempTerrain[iX]) tempTerrain[iX] = [];
                tempTerrain[iX][iY] = GameplayMap.getTerrainType(iX, iY);
                const row = importedMap[iX][iY];
                if (GameplayMap.isWater(iX, iY) == false) {
                    if (ynamp.isCiv6RowRiver(row) == false) {
                    TerrainBuilder.setTerrainType(iX, iY, globals.g_MountainTerrain);
                    } else {
                    TerrainBuilder.setTerrainType(iX, iY, globals.g_FlatTerrain);
                    TerrainBuilder.setRainfall(iX, iY, 1500);
                    }
                }
            }
        }
        dumpTerrain(iWidth, iHeight);
        
        for (let iY = 0; iY < iHeight; iY++) {
            for (let iX = 0; iX < iWidth; iX++) {
                let numNonRiverPlots = 0;
                for (let iDirection = 0; iDirection < DirectionTypes.NUM_DIRECTION_TYPES; iDirection++) {
                    let iIndex = GameplayMap.getIndexFromXY(iX, iY);
                    let iLocation = GameplayMap.getLocationFromIndex(iIndex);
                    let iAdjacentX = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).x;
                    let iAdjacentY = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).y;
                    if (GameplayMap.getTerrainType(iAdjacentX, iAdjacentY) == globals.g_MountainTerrain || GameplayMap.isWater(iAdjacentX, iAdjacentY)) {
                        numNonRiverPlots++;
                    }
                }
                if (numNonRiverPlots == 5) {
                    TerrainBuilder.setRainfall(iX, iY, 2500);
                }
            }
        }
        console.log("dumpRainfall...");
        dumpRainfall(iWidth, iHeight);

        //console.log("modelRivers...");
        //TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);

        // Restore the original terrain
        for (let iY = 0; iY < iHeight; iY++) {
            for (let iX = 0; iX < iWidth; iX++) {
                TerrainBuilder.setTerrainType(iX, iY, tempTerrain[iX][iY]);
            }
        }
        console.log("buildElevation...");
        TerrainBuilder.buildElevation();

        console.log("modelRivers...");
        TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
        
        // Reset rainfall
        for (let iY = 0; iY < iHeight; iY++) {
            for (let iX = 0; iX < iWidth; iX++) {
                TerrainBuilder.setRainfall(iX, iY, 0);
            }
        }

        console.log("(re)buildRainfallMap...");
        buildRainfallMap(iWidth, iHeight);

    } else {
        
        console.log("buildElevation...");
        TerrainBuilder.buildElevation();
        console.log("buildRainfallMap...");
        buildRainfallMap(iWidth, iHeight);
        console.log("modelRivers...");
        TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
    }
    ynamp.dumpRivers(iWidth, iHeight);
    console.log("validateAndFixTerrain (2)...");    
    TerrainBuilder.validateAndFixTerrain(); // crashes here ?
    console.log("defineNamedRivers...");
    TerrainBuilder.defineNamedRivers();
    ynamp.createBiomes(iWidth, iHeight, importedMap, mapType); //designateBiomes(iWidth, iHeight);
    
    // Assign continents after terrain and biomes are properly placed on the map
    console.log("stampContinents...");
    TerrainBuilder.stampContinents();
    
    addNaturalWonders(iWidth, iHeight, iNumNaturalWonders, naturalWonderEvent);
    console.log("addFloodplains...");
    TerrainBuilder.addFloodplains(4, 10);
    addFeatures(iWidth, iHeight);
    if (mapType == 'CIV6') {
        ynamp.extraJungle(iWidth, iHeight, importedMap);
    } else {
        ynamp.placeFeatures(iWidth, iHeight, importedMap, mapType);
    }
    console.log("validateAndFixTerrain (3)")
    //TerrainBuilder.validateAndFixTerrain();
    //console.log("adjustOceanPlotTags...");
    //utilities.adjustOceanPlotTags(iNumPlayers1 > iNumPlayers2);
    const regionMode = getEffectiveRegionMode(mapName);
    tagHemispherePlots(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2, mapName, regionMode);
    console.log("recalculateAreas (3)");
    AreaBuilder.recalculateAreas();
    TerrainBuilder.storeWaterData();
    //generateSnow(iWidth, iHeight);
    if (mapType == 'CIV6') {
        ynamp.importSnow(iWidth, iHeight, importedMap);
    }
    console.log("Debug dump...");
    dumpStartSectors(startSectors);
    dumpContinents(iWidth, iHeight);
    dumpTerrain(iWidth, iHeight);
    dumpElevation(iWidth, iHeight);
    dumpRainfall(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);
    dumpPermanentSnow(iWidth, iHeight);
    console.log("generateResources...");
    // Use base game resource generator
    generateResources(iWidth, iHeight);
    
    if (mapType == 'CIV7') {
        ynamp.placeResources(iWidth, iHeight, importedMap, mapType);
    }
    
    // Call assignStartPositions to prevent issues when a custom/DLC civ doesn't have a TSL (to do: custom assignStartPositions with distance check)
    // this code is failing with v1.2.3
    // [2025-07-22 18:03:19]	Uncaught TypeError: Cannot read properties of undefined (reading 'south')
    // D:/Steam/steamapps/common/Sid Meier's Civilization VII/Base/modules/base-standard/maps/assign-starting-plots.js:847
    // for (let iY = region.south; iY <= region.north; iY++) {
    // disable for know, let gamecore handle placement of civs without TSL
    //*
    let hasFullTSL = hasValidTSLForAllAliveMajors(trueStartPositions, aliveMajorIds);
    if (hasFullTSL) {
        console.log("Skipping assignStartPositions: valid TSL found for all alive majors.");
        startPositions = [...trueStartPositions];
        for (let i = 0; i < aliveMajorIds.length; i++) {
            let iPlayer = aliveMajorIds[i];
            let iPlot = startPositions[i];
            StartPositioner.setStartPosition(iPlot, iPlayer);
        }
    } else {
        console.log("assignStartPositions... (iNumPlayers1=" + iNumPlayers1 + " iNumPlayers2=" + iNumPlayers2 + ")");
        console.log("westContinent: " + JSON.stringify(westContinent));
        console.log("eastContinent: " + JSON.stringify(eastContinent));
        console.log("iStartSectorRows=" + iStartSectorRows + " iStartSectorCols=" + iStartSectorCols);
        console.log("startSectors.length=" + startSectors.length);
        
        // Debug: Check terrain state before assignStartPositions
        let counts = countLandWater(iWidth, iHeight);
        let landPlotCount = counts.landPlotCount;
        let waterPlotCount = counts.waterPlotCount;
        console.log("Terrain before assignStartPositions: " + landPlotCount + " land, " + waterPlotCount + " water");
        
        try {
            startPositions = phase("assignStartPositions", () => assignStartPositions(iNumPlayers1, iNumPlayers2, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors));
        } catch (err) {
            console.log("assignStartPositions failed, fallback to TSL-only start placement. Error: " + err);
            startPositions = [];
        }

        console.log("startPositions.length = " + startPositions.length);

        for (let i = 0; i < startPositions.length; i++) {
            console.log("startPositions[" + i + "] = (" + Math.floor(startPositions[i] / GameplayMap.getGridWidth()) + ", " + startPositions[i] % GameplayMap.getGridWidth() + ")");
        }
        // Now assign TSL
        console.log("assignTSL... (2nd pass)");
        trueStartPositions = assignTSL(mapName, startPositions);
        if (trueStartPositions.length == 0) {
            console.log("TSL Failed or no TSL for the current civs on that map, using positions from assignStartPositions only...");
        } else {
            // If assignStartPositions failed (startPositions is empty), use TSL positions directly
            if (startPositions.length == 0) {
                startPositions = [...trueStartPositions];
                // Register all major players' start positions
                for (let i = 0; i < aliveMajorIds.length; i++) {
                    let iPlayer = aliveMajorIds[i];
                    let iPlot = startPositions[i];
                    if (isValidPlot(iPlot)) {
                        StartPositioner.setStartPosition(iPlot, iPlayer);
                    } else {
                        let existingPlot = StartPositioner.getStartPosition(iPlayer);
                        if (isValidPlot(existingPlot)) {
                            startPositions[i] = existingPlot;
                        }
                    }
                }
            } else {
                // Update existing startPositions with TSL
                for (let i = 0; i < aliveMajorIds.length; i++) {
                    if (isValidPlot(trueStartPositions[i])) {
                        startPositions[i] = trueStartPositions[i];
                        let iPlayer = aliveMajorIds[i];
                        StartPositioner.setStartPosition(trueStartPositions[i], iPlayer);
                    } else {
                        let iPlayer = aliveMajorIds[i];
                        let existingPlot = StartPositioner.getStartPosition(iPlayer);
                        if (isValidPlot(existingPlot)) {
                            startPositions[i] = existingPlot;
                        }
                    }
                }
            }
        }
    }
    //*/

    enforceHumanTSLStart(mapName, iWidth);

    // With this method civs with no TSL are placed by gamecore, not assignStartPositions (which means no bias AFAIK)
    //console.log("assignTSL... (no backup)");
    //trueStartPositions = assignTSL(mapName);

    phase("generateDiscoveries", () => {
        // Limit to 10 players for discoveries (base game limitation)
        let discoveryStartPositions = getDiscoveryStartPositions(startPositions);
        generateDiscoveries(iWidth, iHeight, discoveryStartPositions, 2);
    });
    ynamp.validate(iWidth, iHeight, iNumPlayers1, iNumPlayers2, westContinent, eastContinent, trueStartPositions, mapName);
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
        ynamp.overrideHomelandsWithXMLRegions(iWidth, iHeight, mapName);
    } else if (regionMode == "landmass") {
        // BFS connectivity from player starts — ocean-blocked, orientation-agnostic
        console.log("Using connectivity-based landmass classification (landmass mode)");
        ynamp.overrideHomelandsWithLandmass(iWidth, iHeight);
    } else {
        // east-west: column-based tagging already applied in tagHemispherePlots
        let missingStartPlayerIds = getAlivePlayersWithoutStartPositions();
        if (missingStartPlayerIds.length == 0) {
            assignAdvancedStartRegions();
        } else {
            console.log("Skipping assignAdvancedStartRegions (east-west mode): missing start position for player IDs: " + missingStartPlayerIds.join(","));
        }
    }
}

function placeVolcanoes(mapName) {
    console.log("YNAMP - Place Volcanoes for map " + mapName);
    let numPlaced = 0;
    for (let i = 0; i < GameInfo.ExtraPlacement.length; ++i) {
        let row = GameInfo.ExtraPlacement[i];
        if (row.MapName == mapName && row.FeatureType == 'FEATURE_VOLCANO') {
            TerrainBuilder.setTerrainType(row.X, row.Y, globals.g_MountainTerrain);
            const featureParam = {
                Feature: globals.g_VolcanoFeature,
                Direction: -1,
                Elevation: 0
            };
            TerrainBuilder.setFeatureType(row.X, row.Y, featureParam);
            console.log("Volcano Placed at (x, y): " + row.X + ", " + row.Y);
            numPlaced++;
        }
    }
    console.log("   - placed : " + numPlaced);
    return numPlaced;
}

// this function requires assignStartPositions to have been called first
function assignTSL(mapName, defaultStartPositions) {
    console.log("Assigning YnAMP TSL for " + mapName);
    const startPositions = []; // Plot indices for start positions chosen
    const TSL = {};
    const iWidth = GameplayMap.getGridWidth();
    const iHeight = GameplayMap.getGridHeight();
    const usedPlots = new Set();

    for (let i = 0; i < GameInfo.StartPosition.length; ++i) {
        let row = GameInfo.StartPosition[i];
        if (row.MapName == mapName) {
            TSL[row.Civilization] = { X: row.X, Y: row.Y };
        }
    }

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
            if (defaultStartPositions.length == 0) {
                console.log("NO TSL FOR PLAYER: " + civTypeName + " " + iPlayer);
            } else {
                let iPlot = defaultStartPositions[i];
                if (isValidPlot(iPlot)) {
                    console.log("NO TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " Use default start position (" + Math.floor(iPlot / iWidth) + ", " + iPlot % iWidth + ")");
                    startPositions[i] = iPlot;
                    StartPositioner.setStartPosition(iPlot, iPlayer);
                    usedPlots.add(iPlot);
                } else {
                    console.log("NO TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " and no valid default start position");
                }
            }
        } else {
            let iPlot = startPosition.Y * iWidth + startPosition.X;
            let duplicatePlayers = civToPlayers[civTypeName];
            let hasDuplicate = duplicatePlayers && duplicatePlayers.length > 1;

            if (!hasDuplicate || iPlayer == primaryTSLOwnerByCiv[civTypeName]) {
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
                startPositions[i] = iPlot;
                console.log("TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " (" + startPosition.X + ", " + startPosition.Y + ")");
                StartPositioner.setStartPosition(iPlot, iPlayer);
                usedPlots.add(iPlot);
            }
        }
    }

    return startPositions;
}

console.log("Loaded ynamp-map-loading.js");
