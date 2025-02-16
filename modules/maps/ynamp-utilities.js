import * as globals from '/base-standard/maps/map-globals.js';
import * as utilities from '/base-standard/maps/map-utilities.js';

export function createLandmasses(iWidth, iHeight, continent1, continent2, iStartSectorRows, iStartSectorCols, startSectors, fMapScale, fWaterPercentFactor) {
    FractalBuilder.create(globals.g_LandmassFractal, iWidth, iHeight, 2, 0);
    let iWaterHeight = FractalBuilder.getHeightFromPercent(globals.g_LandmassFractal, globals.g_WaterPercent * fWaterPercentFactor);
    console.log("iWaterHeight = " + iWaterHeight);
    console.log("continent2.west = " + continent2.west);
    let iBuffer = Math.floor(iHeight / 18.0);
    let iBuffer2 = Math.floor(iWidth / 28.0);
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = globals.g_FlatTerrain;
            let iRandom = TerrainBuilder.getRandomNumber(iBuffer, "Random Top/Bottom Edges");
            let iRandom2 = TerrainBuilder.getRandomNumber(iBuffer2, "Random Left/Right Edges");
            // Initialize plot tag
            TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_NONE);
            //console.log("iPlotHeight at ("+iX+","+iY+")");
            let iPlotHeight = getHeightAdjustingForStartSector(iX, iY, iWaterHeight, globals.g_FractalWeight, globals.g_CenterWeight, globals.g_StartSectorWeight, continent1, continent2, iStartSectorRows, iStartSectorCols, startSectors, fMapScale);
            //console.log(" - Adjusted For Start Sector iPlotHeight = " + iPlotHeight);
			// if between the continents
            if (iX < continent1.west + iRandom2 || iX >= continent2.east - iRandom2 ||
                (iX >= continent1.east - iRandom2 && iX < continent2.west + iRandom2)) {
                iPlotHeight = Math.floor (iPlotHeight*0.5);
                //console.log("   - Adjusted between continents iPlotHeight = " + iPlotHeight);
            }

            //console.log(" - Final iPlotHeight = " + iPlotHeight + "/" + iWaterHeight + " * " +  globals.g_Cutoff);
            //  Must be water if at the poles
            if (iY < continent1.south + iRandom || iY >= continent1.north - iRandom) {
                terrain = globals.g_OceanTerrain;
            }
			/**
			// Gedemon <<
            // Or if between the continents
            else if (iX < continent1.west + iRandom2 || iX >= continent2.east - iRandom2 ||
                (iX >= continent1.east - iRandom2 && iX < continent2.west + iRandom2)) {
                iPlotHeight = Math.floor (iPlotHeight*0.3);
                console.log("   - iPlotHeight = " + iPlotHeight);
            }
			// >> Gedemon
			//*/
            else {
                // Finally see whether or not this stays as Land or has too low a score and drops back to water
                if (iPlotHeight < iWaterHeight * globals.g_Cutoff ) {
                    terrain = globals.g_OceanTerrain;
                }
            }
            // Add plot tag if applicable
            if (terrain != globals.g_OceanTerrain && terrain != globals.g_CoastTerrain) {
				//console.log("   - addLandmassPlotTags");
                utilities.addLandmassPlotTags(iX, iY, continent2.west);
            }
            else {
                utilities.addWaterPlotTags(iX, iY, continent2.west);
            }
            TerrainBuilder.setTerrainType(iX, iY, terrain);
			 if (GameplayMap.hasPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS)) {
				//console.log("   - PLOT_TAG_EAST_LANDMASS");
			 }
			 if (GameplayMap.hasPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_LANDMASS)) {
				//console.log("   - PLOT_TAG_WEST_LANDMASS");
			 }
        }
    }
}

export function createCloseIslands(iWidth, iHeight, continent1, continent2, iSize) {
    FractalBuilder.create(globals.g_LandmassFractal, iWidth, iHeight, iSize, 0);
    let iwater_percent = 50 /*Special Water Percent for Archipelago */ + iSize * 7;
    let iWaterHeight = FractalBuilder.getHeightFromPercent(globals.g_LandmassFractal, iwater_percent);
    let iBuffer = Math.floor(iWidth / 24.0);
    let terrain = globals.g_FlatTerrain;
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let iRandom = TerrainBuilder.getRandomNumber(iBuffer, "Random Top/Bottom Edges");
            if (iY >= continent1.south + iRandom &&
                iY <= continent1.north - iRandom &&
                (iX >= continent1.west && iX <= continent1.east ||
                    iX >= continent2.west && iX <= continent2.east)) {
                let iPlotHeight = FractalBuilder.getHeight(globals.g_LandmassFractal, iX, iY);
                if (iPlotHeight > iWaterHeight) {
                    TerrainBuilder.setTerrainType(iX, iY, terrain);
                    utilities.addLandmassPlotTags(iX, iY, continent2.west);
                }
            }
        }
    }
}

function getHeightAdjustingForStartSector(iX, iY, iWaterHeight, iFractalWeight, iCenterWeight, iStartSectorWeight, continent1, continent2, iStartSectorRows, iStartSectorCols, startSectors, fMapScale) {
    // Get the value from the fractal
    let iPlotHeight = FractalBuilder.getHeight(globals.g_LandmassFractal, iX, iY);
    iPlotHeight *= iFractalWeight;
    //console.log(" initial iPlotHeight = " + iPlotHeight);
	//*
    // Adjust based on distance from center of the continent
    let iDistanceFromCenter = utilities.getDistanceFromContinentCenter(iX, iY, continent1.south, continent1.north, continent1.west, continent1.east, continent2.west, continent2.east);
    let iMaxDistanceFromCenter = utilities.getMaxDistanceFromContinentCenter(iX, continent1.south, continent1.north, continent1.west, continent1.east, continent2.west, continent2.east);
    let iPercentFromCenter = Math.min(100 * iDistanceFromCenter / iMaxDistanceFromCenter * fMapScale, 100);
    iPlotHeight += iCenterWeight * Math.pow((iWaterHeight * (100 - iPercentFromCenter) / 100), globals.g_CenterExponent);
    //console.log(" Adjusted on distance from center of the continent : iPlotHeight = " + iPlotHeight + " / iPercentFromCenter =" + iPercentFromCenter + " / iDistanceFromCenter = " + iDistanceFromCenter);
	/*
    // Adjust based on whether or not the plot is near a start location (unless very far from center)
    if (iPercentFromCenter < globals.g_IgnoreStartSectorPctFromCtr) {
        let iSector = getSector(iX, iY, iStartSectorRows, iStartSectorCols, continent1.south, continent1.north, continent1.west, continent1.east, continent2.west);
        if (startSectors[iSector]) {
            // Start sector, increase chance we include it
            iPlotHeight += iStartSectorWeight * iWaterHeight;
            // Start sector and less than 2/3rds of full distance from center, add that amount again
            if (iPercentFromCenter < (globals.g_IgnoreStartSectorPctFromCtr * 2 / 3)) {
                iPlotHeight += iStartSectorWeight * iWaterHeight;
            }
        }
        // Interior sector that isn't a start sector? Give it the center bias
        if (iStartSectorCols > 2 && iStartSectorRows > 2) {
            let iTestSector = iSector;
            if (iTestSector >= iStartSectorRows * iStartSectorCols) {
                iTestSector = iSector - (iStartSectorRows * iStartSectorCols);
            }
            if ((iTestSector % iStartSectorCols) > 0 && (iTestSector % iStartSectorCols) < (iStartSectorCols - 1)) {
                if (iTestSector >= iStartSectorCols && iTestSector < (iStartSectorRows * iStartSectorCols - iStartSectorCols)) {
                    iPlotHeight += iCenterWeight * iWaterHeight;
                }
            }
        }
    }
	//*/
    return iPlotHeight;
}

console.log("Loading YnAMP Utilities");

