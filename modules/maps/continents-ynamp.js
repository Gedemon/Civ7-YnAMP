// Continents.ts
/**
 * Base game map script - Produces widely varied continents.
 * @packageDocumentation
 */
console.log("Generating using script continents-ynamp.js");
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
 * @property {string|number} version
 * @property {boolean} naturalWonderEvent
 * @property {number} iWidth
 * @property {number} iHeight
 * @property {number} uiMapSize
 * @property {*} mapInfo
 * @property {{westContinent: ContinentBounds, eastContinent: ContinentBounds, westContinent2: ContinentBounds, eastContinent2: ContinentBounds, fullMap: ContinentBounds}} continents
 * @property {number} iNumPlayers1
 * @property {number} iNumPlayers2
 * @property {number} iNumNaturalWonders
 * @property {number} iTilesPerLake
 * @property {number} iStartSectorRows
 * @property {number} iStartSectorCols
 */

const DEBUG = false;

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
 */
function buildContinentBounds(iWidth, iHeight) {
    let westContinent = {
        west: (3 * globals.g_AvoidSeamOffset) + globals.g_IslandWidth,
        east: (iWidth / 2) - globals.g_AvoidSeamOffset,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let eastContinent = {
        west: westContinent.east + (4 * globals.g_AvoidSeamOffset) + globals.g_IslandWidth,
        east: iWidth - globals.g_AvoidSeamOffset,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let westContinent2 = {
        west: globals.g_AvoidSeamOffset,
        east: globals.g_AvoidSeamOffset + globals.g_IslandWidth,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let eastContinent2 = {
        west: (iWidth / 2) + globals.g_AvoidSeamOffset,
        east: (iWidth / 2) + globals.g_AvoidSeamOffset + globals.g_IslandWidth,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let fullMap = {
        west: globals.g_AvoidSeamOffset,
        east: iWidth - globals.g_AvoidSeamOffset,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };

    return { westContinent, eastContinent, westContinent2, eastContinent2, fullMap };
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

function tagWaterHemispherePlots(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2) {
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = GameplayMap.getTerrainType(iX, iY);
            if (terrain == globals.g_CoastTerrain) {
                TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WATER);
                if (iNumPlayers1 > iNumPlayers2) {
                    if (iX < westContinent.west - 2 || iX > westContinent.east + 2) {
                        //console.log("Islands on the Coast: " + iX + ", " + iY)
                        TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_WATER);
                    }
                    else {
                        //console.log("Main Coast: " + iX + ", " + iY)
                        TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_WATER);
                    }
                }
                else {
                    if (iX > eastContinent.east + 2 || iX < eastContinent.west - 2) {
                        //console.log("Islands on the Coast2: " + iX + ", " + iY)
                        TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_WATER);
                    }
                    else {
                        //console.log("Main Coast2: " + iX + ", " + iY)
                        TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_WATER);
                    }
                }
            }
        }
    }
}
function requestMapData(initParams) {
    console.log(initParams.width);
    console.log(initParams.height);
    console.log(initParams.topLatitude);
    console.log(initParams.bottomLatitude);
    console.log(initParams.wrapX);
    console.log(initParams.wrapY);
    console.log(initParams.mapSize);
    engine.call("SetMapInitData", initParams);
}
function generateMap() {
    let naturalWonderEvent = false;
    const liveEventDBRow = GameInfo.GlobalParameters.lookup("REGISTERED_RACE_TO_WONDERS_EVENT");
    if (liveEventDBRow && liveEventDBRow.Value != "0") {
        naturalWonderEvent = true;
    }
    let version = ynamp.getVersion(); //GlobalParameters.YNAMP_VERSION;
    console.log("YnAMP v" + version + " - Generating Continent++ map!");
    console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
    let iWidth = GameplayMap.getGridWidth();
    let iHeight = GameplayMap.getGridHeight();
    let uiMapSize = GameplayMap.getMapSize();
    let startPositions = [];
    let mapInfo = GameInfo.Maps.lookup(uiMapSize);
    let standardSize = (84*54);
    let fMapScale = Math.max(((iWidth * iHeight) / standardSize)*0.85, 1);
    console.log("fMapScale = " + fMapScale);
    console.log("Name = " + mapInfo.Name);
    console.log("Type = " + mapInfo.MapSizeType);
    
    let fWaterPercentFactor = 1.45;
    //if (mapInfo.MapSizeType == "MAPSIZE_MASSIVE") {
    //  fWaterPercentFactor = 1.35;
    //}
    if (fMapScale > 1.25) {
        fMapScale = fMapScale - ((fMapScale - 1.25)*0.4);
    }
    console.log("Adjusted fMapScale = " + fMapScale);
    
    if (mapInfo == null)
        return;
    // Establish continent boundaries
    let continents = buildContinentBounds(iWidth, iHeight);
    let westContinent = continents.westContinent;
    let eastContinent = continents.eastContinent;
    let westContinent2 = continents.westContinent2;
    let eastContinent2 = continents.eastContinent2;
    let fullMap = continents.fullMap;
    console.log(westContinent.west, ", ", westContinent.east, ", ", eastContinent.west, ", ", eastContinent.east, ", ", westContinent2.west, ", ", westContinent2.east, ", ", eastContinent2.west, ", ", eastContinent2.east, ", ");
    let startSectors;
    let iNumPlayers1 = mapInfo.PlayersLandmass1;
    let iNumPlayers2 = mapInfo.PlayersLandmass2;
    let iNumNaturalWonders = mapInfo.NumNaturalWonders;
    let iTilesPerLake = mapInfo.LakeGenerationFrequency;
    let iStartSectorRows = mapInfo.StartSectorRows;
    let iStartSectorCols = mapInfo.StartSectorCols;
    let ctx = buildMapContext({
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
    let iRandom = !naturalWonderEvent ? TerrainBuilder.getRandomNumber(2, "East or West") : 0; // don't want random hemisphere shuffle for live event
    console.log("Random Hemisphere: " + iRandom);
    if (iRandom == 1) {
        let iNum1 = iNumPlayers1;
        let iNum2 = iNumPlayers2;
        iNumPlayers1 = iNum2;
        iNumPlayers2 = iNum1;
    }
    let bHumanNearEquator = utilities.needHumanNearEquator();
    startSectors = chooseStartSectors(iNumPlayers1, iNumPlayers2, iStartSectorRows, iStartSectorCols, bHumanNearEquator);
    ynamp.createLandmasses(iWidth, iHeight, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors, fMapScale, fWaterPercentFactor);
    ynamp.createCloseIslands(iWidth, iHeight, westContinent, eastContinent, 4);
    //utilities.createIslands(iWidth, iHeight, eastContinent2, westContinent2, 4);
    utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 4);
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 5);
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 6);
    expandCoastsPlus(westContinent.east + globals.g_OceanWaterColumns, eastContinent.west - globals.g_OceanWaterColumns, iHeight);
    expandCoastsPlus(eastContinent.east + globals.g_OceanWaterColumns, 0, iHeight);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.stampContinents();
    addMountains(iWidth, iHeight);
    addVolcanoes(iWidth, iHeight);
    generateLakes(iWidth, iHeight, iTilesPerLake);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.buildElevation();
    addHills(iWidth, iHeight);
    buildRainfallMap(iWidth, iHeight);
    TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
    TerrainBuilder.validateAndFixTerrain();
    TerrainBuilder.defineNamedRivers();
    designateBiomes(iWidth, iHeight);
    addNaturalWonders(iWidth, iHeight, iNumNaturalWonders, naturalWonderEvent);
    TerrainBuilder.addFloodplains(4, 10);
    addFeatures(iWidth, iHeight);
    TerrainBuilder.validateAndFixTerrain();
    //utilities.adjustOceanPlotTags(iNumPlayers1 > iNumPlayers2);
    tagWaterHemispherePlots(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2);
    AreaBuilder.recalculateAreas();
    TerrainBuilder.storeWaterData();
    generateSnow(iWidth, iHeight);
    dumpStartSectors(startSectors);
    dumpContinents(iWidth, iHeight);
    dumpTerrain(iWidth, iHeight);
    dumpElevation(iWidth, iHeight);
    dumpRainfall(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);
    dumpPermanentSnow(iWidth, iHeight);
    generateResources(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2);
    startPositions = phase("assignStartPositions", () => assignStartPositions(iNumPlayers1, iNumPlayers2, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors));
    phase("generateDiscoveries", () => {
        // Limit to 10 players for discoveries (base game limitation)
        let discoveryStartPositions = getDiscoveryStartPositions(startPositions);
        generateDiscoveries(iWidth, iHeight, discoveryStartPositions);
    });
    dumpResources(iWidth, iHeight);
    FertilityBuilder.recalculate(); // Must be after features are added.
    let seed = GameplayMap.getRandomSeed(); // can use any seed you want for different noises
    let avgDistanceBetweenPoints = 3;
    let normalizedRangeSmoothing = 2;
    let poisson = TerrainBuilder.generatePoissonMap(seed, avgDistanceBetweenPoints, normalizedRangeSmoothing);
    let poissonPred = (val) => {
        return val >= 1 ? "*" : " ";
    };
    dumpNoisePredicate(iWidth, iHeight, poisson, poissonPred);
    assignAdvancedStartRegions();
    console.log("YnAMP Map generated...");
    /**
    // << Gedemon
    if ( typeof Players != 'undefined') {
        for (const id of Players.getWasEverAliveIds())
        {
            let player = Players.get(id);
            if ( player.isHuman )
            {
                Visibility.revealAllPlots(id);
            }
        }
    }
    // >> Gedemon
    //*/
    /**
    // << Gedemon
    console.log("Visibility");
    let keys = Object.keys(Visibility)
    console.log(keys);
    console.log("TerrainBuilder");
    keys = Object.keys(TerrainBuilder)
    console.log(keys);
    console.log("GameplayMap");
    keys = Object.keys(GameplayMap)
    console.log(keys);
    for (var key in GameplayMap) {
        console.log(" - " + key);
    }
    // >> Gedemon
    //*/
}

function expandCoastsPlus(iWest, iEast, iHeight) {
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = iWest; iX < iEast; iX++) {
            let terrain = GameplayMap.getTerrainType(iX, iY);
            if (terrain == globals.g_OceanTerrain) {
                if (GameplayMap.isAdjacentToShallowWater(iX, iY) && TerrainBuilder.getRandomNumber(2, "Shallow Water Scater Scatter") == 0) {
                    TerrainBuilder.setTerrainType(iX, iY, globals.g_CoastTerrain);
                }
            }
        }
    }
}


// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);
console.log("Loaded continents-ynamp.js");
//# sourceMappingURL=file:///base-standard/maps/continents-plus.js.map
