// Fractal.ts
/**
 * Base game map script - Produces widely varied continents.
 * @packageDocumentation
 */
console.log("Generating using script fractal.ts");
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
    console.log("Generating a map!");
    console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
    let iWidth = GameplayMap.getGridWidth();
    let iHeight = GameplayMap.getGridHeight();
    let uiMapSize = GameplayMap.getMapSize();
    let startPositions = [];
    let mapInfo = GameInfo.Maps.lookup(uiMapSize);
    if (mapInfo == null)
        return;
    // Establish continent boundaries
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
    let startSectors;
    let iNumPlayers1 = mapInfo.PlayersLandmass1;
    let iNumPlayers2 = mapInfo.PlayersLandmass2;
    let iNumNaturalWonders = mapInfo.NumNaturalWonders;
    let iTilesPerLake = mapInfo.LakeGenerationFrequency;
    let iStartSectorRows = mapInfo.StartSectorRows;
    let iStartSectorCols = mapInfo.StartSectorCols;
    let iRandom = TerrainBuilder.getRandomNumber(2, "East or West");
    console.log("Random Hemisphere: " + iRandom);
    if (iRandom == 1) {
        let iNum1 = iNumPlayers1;
        let iNum2 = iNumPlayers2;
        iNumPlayers1 = iNum2;
        iNumPlayers2 = iNum1;
    }
    let bHumanNearEquator = utilities.needHumanNearEquator();
    startSectors = chooseStartSectors(iNumPlayers1, iNumPlayers2, iStartSectorRows, iStartSectorCols, bHumanNearEquator);
    createLandmasses(iWidth, iHeight, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);
    utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 4);
    utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 5);
    utilities.createIslands(iWidth, iHeight, westContinent2, eastContinent2, 6);
    TerrainBuilder.validateAndFixTerrain();
    expandCoastsPlus(westContinent.west, westContinent.east, iHeight);
    expandCoastsPlus(eastContinent.west, eastContinent.east, iHeight);
    expandCoastsPlus(0, westContinent.west - globals.g_OceanWaterColumns, iHeight);
    expandCoastsPlus(westContinent.east + globals.g_OceanWaterColumns, eastContinent.west - globals.g_OceanWaterColumns, iHeight);
    expandCoastsPlus(eastContinent.east + globals.g_OceanWaterColumns, 0, iHeight);
    utilities.adjustOceanPlotTags(iNumPlayers1 > iNumPlayers2);
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
    addNaturalWonders(iWidth, iHeight, iNumNaturalWonders);
    TerrainBuilder.addFloodplains(4, 10);
    addFeatures(iWidth, iHeight);
    TerrainBuilder.validateAndFixTerrain();
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
    startPositions = assignStartPositions(iNumPlayers1, iNumPlayers2, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);
    generateDiscoveries(iWidth, iHeight, startPositions);
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
	//**
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
}
// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);
console.log("Loaded fractal.ts");
function createLandmasses(iWidth, iHeight, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors) {
    FractalBuilder.create(globals.g_LandmassFractal, iWidth, iHeight, 3, 0);
    let iWaterHeight = FractalBuilder.getHeightFromPercent(globals.g_LandmassFractal, globals.g_WaterPercent);
    let iBuffer = Math.floor(iHeight / 13.5);
    let iBuffer2 = Math.floor(iWidth / 21.0);
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = globals.g_FlatTerrain;
            let iRandom = TerrainBuilder.getRandomNumber(iBuffer, "Random Top/Bottom Edges");
            let iRandom2 = TerrainBuilder.getRandomNumber(iBuffer2, "Random Left/Right Edges");
            // Initialize plot tag
            TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_NONE);
            let iPlotHeight = utilities.getHeightAdjustingForStartSector(iX, iY, iWaterHeight, globals.g_FractalWeight, 0.0 /*CenterWeight*/, globals.g_StartSectorWeight, westContinent, eastContinent, iStartSectorRows, iStartSectorCols, startSectors);
            //  Must be water if at the poles
            if (iY < westContinent.south + iRandom || iY >= westContinent.north - iRandom) {
                terrain = globals.g_OceanTerrain;
            }
			//**
			// Gedemon <<
            // Or if between the continents
            else if (iX < westContinent.west + iRandom2 || iX >= eastContinent.east - iRandom2 ||
                (iX >= westContinent.east - iRandom2 && iX < eastContinent.west + iRandom2)) {
                iPlotHeight = Math.floor (iPlotHeight*0.3);
                console.log("   - iPlotHeight = " + iPlotHeight);
            }
			// >> Gedemon
			//*/
            else {
                // Get the value from the fractal
                // Finally see whether or not this stays as Land or has too low a score and drops back to water
                if (iPlotHeight < iWaterHeight * 1.35 * (globals.g_FractalWeight + globals.g_StartSectorWeight)) {
                    terrain = globals.g_OceanTerrain;
                }
            }
            // Add plot tag if applicable
            if (terrain != globals.g_OceanTerrain && terrain != globals.g_CoastTerrain) {
                utilities.addLandmassPlotTags(iX, iY, eastContinent.west);
            }
            else {
                utilities.addWaterPlotTags(iX, iY, eastContinent.west);
            }
            TerrainBuilder.setTerrainType(iX, iY, terrain);
        }
    }
}
export function expandCoastsPlus(iWest, iEast, iHeight) {
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

//# sourceMappingURL=file:///base-standard/maps/fractal.js.map
