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

export function generateYnAMP(mapName, importedMap, genParameters) {

    //let importedMap = GetMap();
	let mapType = ynamp.getMapType(importedMap);
	
    let naturalWonderEvent = false;
    const liveEventDBRow = GameInfo.GlobalParameters.lookup("REGISTERED_RACE_TO_WONDERS_EVENT");
    if (liveEventDBRow && liveEventDBRow.Value != "0") {
        naturalWonderEvent = true;
    }
    console.log("Loading yet (not) another map!");
    console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
    let iWidth = GameplayMap.getGridWidth();
    let iHeight = GameplayMap.getGridHeight();
    let uiMapSize = GameplayMap.getMapSize();
    console.log("uiMapSize = " + uiMapSize);
    console.log("mapType = " + mapType);
    let startPositions = [];
    let mapInfo = GameInfo.Maps.lookup(uiMapSize);
    if (mapInfo == null)
        return;
    // Establish continent boundaries
    let westContinent = {
        west: genParameters.westStart,	//1, //(3 * globals.g_AvoidSeamOffset) + globals.g_IslandWidth,
        east: genParameters.westEnd,	//31, //(iWidth / 2) - globals.g_AvoidSeamOffset,
        south: globals.g_PolarWaterRows,
        north: iHeight - globals.g_PolarWaterRows,
        continent: 0
    };
    let eastContinent = {
        west: genParameters.eastStart,	//32, //westContinent.east + (4 * globals.g_AvoidSeamOffset) + globals.g_IslandWidth,
        east: genParameters.eastEnd,	//102, //iWidth - globals.g_AvoidSeamOffset,
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
    console.log(westContinent.west, ", ", westContinent.east, ", ", eastContinent.west, ", ", eastContinent.east, ", ", westContinent2.west, ", ", westContinent2.east, ", ", eastContinent2.west, ", ", eastContinent2.east, ", ");
    let startSectors;
    let iNumPlayers1 = mapInfo.PlayersLandmass1;
    let iNumPlayers2 = mapInfo.PlayersLandmass2;
    let iNumNaturalWonders = mapInfo.NumNaturalWonders;
    let iTilesPerLake = mapInfo.LakeGenerationFrequency;
    let iStartSectorRows = mapInfo.StartSectorRows;
    let iStartSectorCols = mapInfo.StartSectorCols;
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
    ynamp.createMapTerrains(iWidth, iHeight, westContinent, eastContinent, importedMap, mapType);
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 4);
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 5);
    //utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 6);
    console.log("validateAndFixTerrain (1)...");
    TerrainBuilder.validateAndFixTerrain();
    // ynamp.expandCoastsPlus(westContinent.west, westContinent.east, iHeight);
    // ynamp.expandCoastsPlus(eastContinent.west, eastContinent.east, iHeight);
    // ynamp.expandCoastsPlus(0, westContinent.west - globals.g_OceanWaterColumns, iHeight);
    // ynamp.expandCoastsPlus(westContinent.east + globals.g_OceanWaterColumns, eastContinent.west - globals.g_OceanWaterColumns, iHeight);
    // ynamp.expandCoastsPlus(eastContinent.east + globals.g_OceanWaterColumns, 0, iHeight);
    console.log("recalculateAreas (1)");
    AreaBuilder.recalculateAreas();
    TerrainBuilder.stampContinents();
    //addMountains(iWidth, iHeight);
    addVolcanoes(iWidth, iHeight);
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
	if (mapType == 'CIV6') {
        addFeatures(iWidth, iHeight);
		ynamp.extraJungle(iWidth, iHeight, importedMap);
	} else {
		ynamp.addFeatures(iWidth, iHeight, importedMap, mapType);
	}
    TerrainBuilder.validateAndFixTerrain();
    console.log("adjustOceanPlotTags...");
    utilities.adjustOceanPlotTags(iNumPlayers1 > iNumPlayers2);
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = GameplayMap.getTerrainType(iX, iY);
			const terrainRow = GameInfo.Terrains.lookup(terrain);
			let rainfall = GameplayMap.getRainfall(iX, iY);
			let iElevation = GameplayMap.getElevation(iX, iY);
			console.log("Validate (" + iX + "," + iY +") - Elevation = " + iElevation + ", rainfall = " + rainfall + ", terrain = " + terrainRow.TerrainType);
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
    //dumpStartSectors(startSectors);
    dumpContinents(iWidth, iHeight);
    dumpTerrain(iWidth, iHeight);
    dumpElevation(iWidth, iHeight);
    dumpRainfall(iWidth, iHeight);
    dumpBiomes(iWidth, iHeight);
    dumpFeatures(iWidth, iHeight);
    dumpPermanentSnow(iWidth, iHeight);
    console.log("generateResources...");
    generateResources(iWidth, iHeight, westContinent, eastContinent, iNumPlayers1, iNumPlayers2);
    console.log("assignStartPositions...");
    startPositions = assignTSL(mapName);
    //startPositions = assignStartPositions(iNumPlayers1, iNumPlayers2, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);
    generateDiscoveries(iWidth, iHeight, startPositions);
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


function assignTSL(mapName) {
    console.log("Assigning YnAMP TSL");
    let startPositions = []; // Plot indices for start positions chosen
    let TSL = [];
	if (mapName == 'GreatestEarthMap') {
		TSL = {
			"CIVILIZATION_ABBASID": {X: 65, Y: 39},
			"CIVILIZATION_AKSUM": {X: 63, Y: 29},
			"CIVILIZATION_AMERICA": {X: 19, Y: 47},
			"CIVILIZATION_BUGANDA": {X: 59, Y: 19},
			"CIVILIZATION_CHOLA": {X: 77, Y: 33},
			"CIVILIZATION_EGYPT": {X: 58, Y: 35},
			"CIVILIZATION_FRENCH_EMPIRE": {X: 42, Y: 48},
			"CIVILIZATION_GREECE": {X: 58, Y: 42},
			"CIVILIZATION_HAN": {X: 82, Y: 50},
			"CIVILIZATION_HAWAII": {X: 102, Y: 36},
			"CIVILIZATION_INCA": {X: 23, Y: 17},
			"CIVILIZATION_KHMER": {X: 83, Y: 37},
			"CIVILIZATION_MAJAPAHIT": {X: 87, Y: 24},
			"CIVILIZATION_MAURYA": {X: 78, Y: 39},
			"CIVILIZATION_MAYA": {X: 15, Y: 31},
			"CIVILIZATION_MEIJI": {X: 98, Y: 47},
			"CIVILIZATION_MEXICO": {X: 11, Y: 34},
			"CIVILIZATION_MING": {X: 87, Y: 48},
			"CIVILIZATION_MISSISSIPPIAN": {X: 11, Y: 49},
			"CIVILIZATION_MONGOLIA": {X: 81, Y: 57},
			"CIVILIZATION_MUGHAL": {X: 75, Y: 39},
			"CIVILIZATION_NORMAN": {X: 39, Y: 52}, // London
			//"CIVILIZATION_NORMAN": {X: 41, Y: 48}, // Rouen
			"CIVILIZATION_PERSIA": {X: 67, Y: 41},
			"CIVILIZATION_PRUSSIA": {X: 56, Y: 56},
			"CIVILIZATION_QING": {X: 87, Y: 56},
			"CIVILIZATION_ROME": {X: 50, Y: 42},
			"CIVILIZATION_RUSSIA": {X: 60, Y: 60},
			"CIVILIZATION_SHAWNEE": {X: 17, Y: 48},
			"CIVILIZATION_SIAM": {X: 83, Y: 38},
			"CIVILIZATION_SONGHAI": {X: 47, Y: 25},
			"CIVILIZATION_SPAIN": {X: 37, Y: 38},
		}
    };

    // The index values we will be dealing with in this function, correspond to the index
    // in the Alive Majors array.
    let aliveMajorIds = Players.getAliveMajorIds();

    for (let i = 0; i < aliveMajorIds.length; i++) {

        //console.log("aliveMajorIds["+i+"] = "+ aliveMajorIds[i]);
        
        let iPlayer = aliveMajorIds[i];
        let uiCivType = Players.getEverAlive()[iPlayer].civilizationType;
        let civTypeName =  GameInfo.Civilizations.lookup(uiCivType).CivilizationType;
        //console.log("uiCivType = "+ uiCivType);
        console.log("CivType = "+ civTypeName);
        
        let startPosition = TSL[civTypeName];
        let iPlot = startPosition.Y * GameplayMap.getGridWidth() + startPosition.X;
        startPositions[i] = iPlot;
        console.log("CHOICE FOR PLAYER: " + iPlayer + " (" + startPosition.X + ", " + startPosition.Y + ")");
        StartPositioner.setStartPosition(iPlot, iPlayer);

    }
    return startPositions;
}

console.log("Loaded ynamp-map-loading.js");
