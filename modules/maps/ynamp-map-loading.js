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
import { generateResourcesYnAMP } from '/ged-ynamp/maps/ynamp-resource-generator.js';
import { addVolcanoes } from '/base-standard/maps/volcano-generator.js';
import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { generateSnow, dumpPermanentSnow } from '/base-standard/maps/snow-generator.js';
import { dumpStartSectors, dumpContinents, dumpTerrain, dumpElevation, dumpRainfall, dumpBiomes, dumpFeatures, dumpResources, dumpNoisePredicate } from '/base-standard/maps/map-debug-helpers.js';
import * as ynamp from '/ged-ynamp/maps/ynamp-utilities.js';

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
        west: genParameters.westEnd + globals.g_AvoidSeamOffset,
        east: genParameters.westEnd + globals.g_AvoidSeamOffset + globals.g_IslandWidth,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    console.log(westContinent.west, ", ", westContinent.east, ", ", eastContinent.west, ", ", eastContinent.east, ", ", westContinent2.west, ", ", westContinent2.east, ", ", eastContinent2.west, ", ", eastContinent2.east, ", ");
    let startSectors;
    let iNumPlayers1 = mapInfo.PlayersLandmass1;
    let iNumPlayers2 = mapInfo.PlayersLandmass2;
    let iNumNaturalWonders = mapInfo.NumNaturalWonders;
    let iTilesPerLake = mapInfo.LakeGenerationFrequency;
    let iStartSectorRows = mapInfo.StartSectorRows;
    let iStartSectorCols = mapInfo.StartSectorCols;

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

    console.log("Players.getAliveMajorIds().length = " + Players.getAliveMajorIds());
    console.log("iNumPlayers1 = " + iNumPlayers1);
    console.log("iNumPlayers2 = " + iNumPlayers2);

    // assignStartPositions will assign start positions only to iNumPlayers1 + iNumPlayers2 civs
    if (iNumPlayers1 + iNumPlayers2 < Players.getAliveMajorIds()) {
        
        let delta = Players.getAliveMajorIds() - iNumPlayers1 - iNumPlayers2;

        // Add extra to the biggest side
        if (iNumPlayers1 >= iNumPlayers2) {
            iNumPlayers1 += delta;
        } else {
            iNumPlayers2 += delta;
        }

        console.log("Adjusted iNumPlayers1 = " + iNumPlayers1);
        console.log("Adjusted iNumPlayers2 = " + iNumPlayers2);
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
    TerrainBuilder.stampContinents();
    //addMountains(iWidth, iHeight);
    let numPlaced = placeVolcanoes(mapName);
    if (numPlaced == 0) {
        addVolcanoes(iWidth, iHeight);
    }
    //generateLakes(iWidth, iHeight, iTilesPerLake);
    console.log("recalculateAreas (2)");
    AreaBuilder.recalculateAreas();
    console.log("buildElevation...");
    TerrainBuilder.buildElevation();
    console.log("addHills...");
    //addHills(iWidth, iHeight);
    console.log("buildRainfallMap...");
    buildRainfallMap(iWidth, iHeight);

    // test high rainfall near Rome for river
    if (mapName == 'GreatestEarthMap') {
        TerrainBuilder.setRainfall(50, 43, 1500);
    }

    console.log("modelRivers...");
    TerrainBuilder.modelRivers(5, 15, globals.g_NavigableRiverTerrain);
    console.log("validateAndFixTerrain (2)...");
    TerrainBuilder.validateAndFixTerrain();
    TerrainBuilder.defineNamedRivers();
    ynamp.createBiomes(iWidth, iHeight, importedMap, mapType);
    //designateBiomes(iWidth, iHeight);
    addNaturalWonders(iWidth, iHeight, iNumNaturalWonders, naturalWonderEvent);
    console.log("addFloodplains...");
    TerrainBuilder.addFloodplains(4, 10);
    addFeatures(iWidth, iHeight);
    if (mapType == 'CIV6') {
        ynamp.extraJungle(iWidth, iHeight, importedMap);
    } else {
        ynamp.placeFeatures(iWidth, iHeight, importedMap, mapType);
    }
    TerrainBuilder.validateAndFixTerrain();
    console.log("adjustOceanPlotTags...");
    utilities.adjustOceanPlotTags(iNumPlayers1 > iNumPlayers2);
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
    console.log("recalculateAreas (3)");
    AreaBuilder.recalculateAreas();
    TerrainBuilder.storeWaterData();
    //generateSnow(iWidth, iHeight);
    if (mapType == 'CIV6') {
        ynamp.importSnow(iWidth, iHeight, importedMap);
    }
    console.log("dump...");
    dumpStartSectors(startSectors);
    dumpContinents(iWidth, iHeight);
    dumpTerrain(iWidth, iHeight);
    dumpElevation(iWidth, iHeight);
    dumpRainfall(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);
    dumpPermanentSnow(iWidth, iHeight);
    console.log("generateResources...");
    generateResourcesYnAMP(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2);
    if (mapType == 'CIV7') {
        ynamp.placeResources(iWidth, iHeight, importedMap, mapType);
    }
    
    // Call assignStartPositions to prevent issues when a custom/DLC civ doesn't have a TSL (to do: custom assignStartPositions with distance check)
    console.log("assignStartPositions... (iNumPlayers1=" + iNumPlayers1 + " iNumPlayers2=" + iNumPlayers2 + ")");
    startPositions = assignStartPositions(iNumPlayers1, iNumPlayers2, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);

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
        for (let i = 0; i < aliveMajorIds.length; i++) {
            if (trueStartPositions[i]) {
                console.log("Update Starting Position list for majorPlayer #" + i + " from plot #" + startPositions[i] + " (" + Math.floor(startPositions[i] / GameplayMap.getGridWidth()) + ", " + startPositions[i] % GameplayMap.getGridWidth() + ")" + " to TSL plot #" + trueStartPositions[i] + " (" + Math.floor(trueStartPositions[i] / GameplayMap.getGridWidth()) + ", " + trueStartPositions[i] % GameplayMap.getGridWidth() + ")");
                startPositions[i] = trueStartPositions[i];
            }
        }
    }
    generateDiscoveries(iWidth, iHeight, startPositions);
    ynamp.validate(iWidth, iHeight, iNumPlayers1, iNumPlayers2);
    console.log("dumpResources...");
    dumpResources(iWidth, iHeight);
    FertilityBuilder.recalculate(); // Must be after features are added.
    let seed = GameplayMap.getRandomSeed(); // can use any seed you want for different noises
    let avgDistanceBetweenPoints = 3;
    let normalizedRangeSmoothing = 2;
    console.log("generatePoissonMap...");
    let poisson = TerrainBuilder.generatePoissonMap(seed, avgDistanceBetweenPoints, normalizedRangeSmoothing);
    let poissonPred = (val) => {
        return val >= 1 ? "*" : " ";
    };
    dumpNoisePredicate(iWidth, iHeight, poisson, poissonPred);
    assignAdvancedStartRegions();
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


function assignTSL(mapName, defaultStartPositions) {
    console.log("Assigning YnAMP TSL for " + mapName);
    const startPositions = []; // Plot indices for start positions chosen
    const TSL = {};

    for (let i = 0; i < GameInfo.StartPosition.length; ++i) {
        let row = GameInfo.StartPosition[i];
        if (row.MapName == mapName) {
            TSL[row.Civilization] = { X: row.X, Y: row.Y };
        }
    }

    // The index values we will be dealing with in this function, correspond to the index
    // in the Alive Majors array.
    let aliveMajorIds = Players.getAliveMajorIds();

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
                console.log("NO TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " Use default start position (" + Math.floor(iPlot / GameplayMap.getGridWidth()) + ", " + iPlot % GameplayMap.getGridWidth() + ")");
                startPositions[i] = iPlot;
                StartPositioner.setStartPosition(iPlot, iPlayer);
            }
        } else {
            let iPlot = startPosition.Y * GameplayMap.getGridWidth() + startPosition.X;
            startPositions[i] = iPlot;
            console.log("TSL FOR PLAYER: " + civTypeName + " " + iPlayer + " (" + startPosition.X + ", " + startPosition.Y + ")");
            StartPositioner.setStartPosition(iPlot, iPlayer);
        }
    }
    return startPositions;
}

console.log("Loaded ynamp-map-loading.js");
