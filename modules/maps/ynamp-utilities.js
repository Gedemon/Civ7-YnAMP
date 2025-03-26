import * as globals from '/base-standard/maps/map-globals.js';
import * as utilities from '/base-standard/maps/map-utilities.js';

export function getVersion() {
    // Modding is not defined in MapGeneration context... (13-Mar-25)
    /*
    const allMods = Modding.getInstalledMods()
    allMods.forEach((mod) => {
        if (mod.handle != null) {
            const modInfo = Modding.getModInfo(handle);
            if (modInfo.id == "ged-ynamp") {
                return Modding.getModProperty(modInfo.handle, 'Version');
            }
        }
    });
    //*/
    return GlobalParameters.YNAMP_VERSION;
}

/*
 *  map script
 *
 */
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

/*
 *  map data
 *
 */

/*  Civ6 maps --------------------------------------------------- | Civ7 maps --------------------------------------------------------------------------------
        
    0 FEATURE_FLOODPLAINS       0  TERRAIN_GRASS                    0  FEATURE_SAGEBRUSH_STEPPE                 0 BIOME_TUNDRA      0 TERRAIN_MOUNTAIN          
    1 FEATURE_ICE               1  TERRAIN_GRASS_HILLS              1  FEATURE_OASIS                            1 BIOME_GRASSLAND   1 TERRAIN_HILL              
    2 FEATURE_JUNGLE            2  TERRAIN_GRASS_MOUNTAIN           2  FEATURE_DESERT_FLOODPLAIN_MINOR          2 BIOME_PLAINS      2 TERRAIN_FLAT              
    3 FEATURE_FOREST            3  TERRAIN_PLAINS                   3  FEATURE_DESERT_FLOODPLAIN_NAVIGABLE      3 BIOME_TROPICAL    3 TERRAIN_COAST             
    4 FEATURE_OASIS             4  TERRAIN_PLAINS_HILLS             4  FEATURE_FOREST                           4 BIOME_DESERT      4 TERRAIN_OCEAN             
    5 FEATURE_MARSH             5  TERRAIN_PLAINS_MOUNTAIN          5  FEATURE_MARSH                            5 BIOME_MARINE      5 TERRAIN_NAVIGABLE_RIVER   
    6 FEATURE_BARRIER_REEF      6  TERRAIN_DESERT                   6  FEATURE_GRASSLAND_FLOODPLAIN_MINOR       
                                7  TERRAIN_DESERT_HILLS             7  FEATURE_GRASSLAND_FLOODPLAIN_NAVIGABLE   
                                8  TERRAIN_DESERT_MOUNTAIN          8  FEATURE_REEF                             
                                9  TERRAIN_TUNDRA                   9  FEATURE_COLD_REEF                        
                                10 TERRAIN_TUNDRA_HILLS             10 FEATURE_ICE                              
                                11 TERRAIN_TUNDRA_MOUNTAIN          11 FEATURE_SAVANNA_WOODLAND                 
                                12 TERRAIN_SNOW                     12 FEATURE_WATERING_HOLE                    
                                13 TERRAIN_SNOW_HILLS               13 FEATURE_PLAINS_FLOODPLAIN_MINOR          
                                14 TERRAIN_SNOW_MOUNTAIN            14 FEATURE_PLAINS_FLOODPLAIN_NAVIGABLE      
                                15 TERRAIN_COAST                    15 FEATURE_RAINFOREST                       
                                16 TERRAIN_OCEAN                    16 FEATURE_MANGROVE                         
                                                                    17 FEATURE_TROPICAL_FLOODPLAIN_MINOR        
                                                                    18 FEATURE_TROPICAL_FLOODPLAIN_NAVIGABLE    
                                                                    19 FEATURE_TAIGA                            
                                                                    20 FEATURE_TUNDRA_BOG                       
                                                                    21 FEATURE_TUNDRA_FLOODPLAIN_MINOR          
                                                                    22 FEATURE_TUNDRA_FLOODPLAIN_NAVIGABLE      
                                                                    23 FEATURE_VOLCANO                          
    
    Map Data (from Civ6 WB)
    MapToConvert[x][y] = {civ6TerrainType, civ6FeatureTypes, civ6ContinentType, {{IsNEOfRiver, flow}, {IsWOfRiver, flow}, {IsNWOfRiver, flow}}, {Civ6ResourceType, num}, {IsNEOfCliff, IsWOfCliff, IsNWOfCliff} }

//*/
const civ7terrain   = ["TERRAIN_MOUNTAIN", "TERRAIN_HILL", "TERRAIN_FLAT","TERRAIN_COAST", "TERRAIN_OCEAN","TERRAIN_NAVIGABLE_RIVER"];
const civ7biome     = ["BIOME_TUNDRA", "BIOME_GRASSLAND", "BIOME_PLAINS","BIOME_TROPICAL", "BIOME_DESERT", "BIOME_MARINE"];
const civ7Feature   = ["FEATURE_SAGEBRUSH_STEPPE", "FEATURE_OASIS", "FEATURE_DESERT_FLOODPLAIN_MINOR","FEATURE_DESERT_FLOODPLAIN_NAVIGABLE", "FEATURE_FOREST", "FEATURE_MARSH","FEATURE_GRASSLAND_FLOODPLAIN_MINOR", "FEATURE_GRASSLAND_FLOODPLAIN_NAVIGABLE", "FEATURE_REEF","FEATURE_COLD_REEF", "FEATURE_ICE", "FEATURE_SAVANNA_WOODLAND","FEATURE_WATERING_HOLE", "FEATURE_PLAINS_FLOODPLAIN_MINOR", "FEATURE_PLAINS_FLOODPLAIN_NAVIGABLE","FEATURE_RAINFOREST", "FEATURE_MANGROVE", "FEATURE_TROPICAL_FLOODPLAIN_MINOR","FEATURE_TROPICAL_FLOODPLAIN_NAVIGABLE", "FEATURE_TAIGA", "FEATURE_TUNDRA_BOG","FEATURE_TUNDRA_FLOODPLAIN_MINOR", "FEATURE_TUNDRA_FLOODPLAIN_NAVIGABLE", "FEATURE_VOLCANO"];
const civ6Terrain   = ["TERRAIN_GRASS", "TERRAIN_GRASS_HILLS", "TERRAIN_GRASS_MOUNTAIN", "TERRAIN_PLAINS", "TERRAIN_PLAINS_HILLS", "TERRAIN_PLAINS_MOUNTAIN", "TERRAIN_DESERT", "TERRAIN_DESERT_HILLS", "TERRAIN_DESERT_MOUNTAIN", "TERRAIN_TUNDRA", "TERRAIN_TUNDRA_HILLS", "TERRAIN_TUNDRA_MOUNTAIN", "TERRAIN_SNOW", "TERRAIN_SNOW_HILLS", "TERRAIN_SNOW_MOUNTAIN", "TERRAIN_COAST", "TERRAIN_OCEAN"];
const civ6Feature   = ["FEATURE_FLOODPLAINS","FEATURE_ICE", "FEATURE_JUNGLE", "FEATURE_FOREST","FEATURE_OASIS", "FEATURE_MARSH", "FEATURE_BARRIER_REEF"];


export function getMapType(importedMap) {
    if (importedMap[0][0].length > 5 && importedMap[0][0][3].length == 3 && importedMap[0][0][5].length == 3) {
        return 'CIV6';
    } else {
        return 'CIV7';
    }
}

// Civ6

const civ6MapIDX = {
    terrain: 0,
    feature: 1,
    continent: 2,
    river: 3,
    resource: 4,
    cliff: 5
}

function getTerrainFromCiv6(sCiv6Terrain) {
    if (sCiv6Terrain.search("MOUNTAIN") != -1) {
        return globals.g_MountainTerrain;
    } else if (sCiv6Terrain.search("HILLS") != -1) {
        return globals.g_HillTerrain;
    } else if (sCiv6Terrain == "TERRAIN_COAST") {
        return globals.g_CoastTerrain;
    } else if (sCiv6Terrain == "TERRAIN_OCEAN") {
        return globals.g_OceanTerrain;
    } 
    // default
    return globals.g_FlatTerrain;
}

function getBiomeFromCiv6(sCiv6Terrain) {
    if (sCiv6Terrain.search("GRASS") != -1) {
        return globals.g_GrasslandBiome;
    } else if (sCiv6Terrain.search("PLAINS") != -1) {
        return globals.g_PlainsBiome;
    } else if (sCiv6Terrain.search("DESERT") != -1) {
        return globals.g_DesertBiome;
    } else if (sCiv6Terrain.search("TUNDRA") != -1) {
        return globals.g_TundraBiome;
    } else if (sCiv6Terrain.search("SNOW") != -1) {
        return globals.g_TundraBiome;
    }
    // default
    return globals.g_MarineBiome;
}

function getTerrainFromCiv6Row(row) {
    let terrain = row[civ6MapIDX.terrain];
    //console.log("getTerrainFromCiv6Row - terrain = " + terrain);
    if (typeof(terrain) == 'number') {
        let sCiv6Terrain = civ6Terrain[terrain];
        return getTerrainFromCiv6(sCiv6Terrain);
    } else {
        return getTerrainFromCiv6(terrain);
    }
}

function getBiomeFromCiv6Row(row) {
    let terrain = row[civ6MapIDX.terrain];
    let feature = row[civ6MapIDX.feature];
    let isJungle;
    
    if (typeof(feature) == 'number') {
        isJungle = civ6Feature[feature] == "FEATURE_JUNGLE";
    } else {
        isJungle = feature == "FEATURE_JUNGLE";
    }
    
    if (isJungle) {
        return globals.g_TropicalBiome;
    }
    
    if (typeof(terrain) == 'number') {
        let sCiv6Terrain = civ6Terrain[terrain];
        return getBiomeFromCiv6(sCiv6Terrain);
    } else {
        return getBiomeFromCiv6(terrain);
    }
}

function getFeatureFromCiv6Row(row) {
    console.log("Civ6 features import not implemented");
    return;
}


function isCiv6RowJungle(row) {
    let feature = row[civ6MapIDX.feature];
    //console.log("isCiv6RowJungle - feature = " + feature);
    if (typeof(feature) == 'number') {
        let sCiv6Feature = civ6Feature[feature];
        return sCiv6Feature == "FEATURE_JUNGLE";
    } else {
        return feature == "FEATURE_JUNGLE";
    }
}

function isCiv6RowSnow(row) {
    let terrain = row[civ6MapIDX.terrain];
    //console.log("getTerrainFromRow - terrain = " + terrain);
    if (typeof(terrain) == 'number') {
        let sCiv6Terrain = civ6Terrain[terrain];
        return sCiv6Terrain.search("SNOW") != -1;
    } else {
        return terrain.search("SNOW") != -1;
    }
}


/*
(for reference)
g_MountainTerrain = GameInfo.Terrains.find(t => t.TerrainType == 'TERRAIN_MOUNTAIN').$index;
g_HillTerrain = GameInfo.Terrains.find(t => t.TerrainType == 'TERRAIN_HILL').$index;
g_FlatTerrain = GameInfo.Terrains.find(t => t.TerrainType == 'TERRAIN_FLAT').$index;
g_CoastTerrain = GameInfo.Terrains.find(t => t.TerrainType == 'TERRAIN_COAST').$index;
g_OceanTerrain = GameInfo.Terrains.find(t => t.TerrainType == 'TERRAIN_OCEAN').$index;
g_NavigableRiverTerrain = GameInfo.Terrains.find(t => t.TerrainType == 'TERRAIN_NAVIGABLE_RIVER').$index;
g_TundraBiome = GameInfo.Biomes.find(t => t.BiomeType == 'BIOME_TUNDRA').$index;
g_GrasslandBiome = GameInfo.Biomes.find(t => t.BiomeType == 'BIOME_GRASSLAND').$index;
g_PlainsBiome = GameInfo.Biomes.find(t => t.BiomeType == 'BIOME_PLAINS').$index;
g_TropicalBiome = GameInfo.Biomes.find(t => t.BiomeType == 'BIOME_TROPICAL').$index;
g_DesertBiome = GameInfo.Biomes.find(t => t.BiomeType == 'BIOME_DESERT').$index;
g_MarineBiome = GameInfo.Biomes.find(t => t.BiomeType == 'BIOME_MARINE').$index;
g_VolcanoFeature = GameInfo.Features.find(t => t.FeatureType == 'FEATURE_VOLCANO').$index;
//*/

// Civ7 functions

const civ7MapIDX = {
    terrain: 0,
    biome: 1,
    feature: 2,
    resource : 3
}

function getTerrainFromCiv7Row(row) {
    let terrain = row[civ7MapIDX.terrain];
    if (typeof(terrain) == 'number') {
        return terrain;
    } else {
        return GameInfo.Terrains.find(t => t.TerrainType == terrain).$index;
    }
}

function getBiomeFromCiv7Row(row) {
    let biome = row[civ7MapIDX.biome];
    if (typeof(biome) == 'number') {
        return biome;
    } else {
        return GameInfo.Biomes.find(t => t.BiomeType == biome).$index;
    }
}

function getFeatureFromCiv7Row(row) {
    let feature = row[civ7MapIDX.feature];
    if (typeof(feature) == 'number') {
        return feature;
    } else {
        return GameInfo.Features.find(t => t.FeatureType == feature).$index;
    }
}

function getResourceFromCiv7Row(row) {
    let resource = row[civ7MapIDX.resource];
    if (typeof (resource) == 'number') {
        return resource;
    } else {
        return GameInfo.Resources.find(t => t.ResourceType == resource).$index;
    }
}

// Map creation

export function createMapTerrains(iWidth, iHeight, continent1, continent2, importedMap, mapType) {
    
    console.log("YnAMP : Set Land and Water...");
    let getTerrainFromRow;
    
    switch (mapType) {
        case "CIV6":
            getTerrainFromRow = getTerrainFromCiv6Row;
            break;
        case "CIV7":
            getTerrainFromRow = getTerrainFromCiv7Row;
            break;
        default:
            console.log("MapType Error = " + mapType);
            return;
    }

    console.log(iHeight);
    console.log(iWidth);

    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = globals.g_FlatTerrain;
            // Initialize plot tag
            TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_NONE);
            //console.log("createLandmasses (" + iX + "," + iY +")");
            terrain = getTerrainFromRow(importedMap[iX][iY]);

            // Add plot tag if applicable
            if (terrain != globals.g_OceanTerrain && terrain != globals.g_CoastTerrain) {
                utilities.addLandmassPlotTags(iX, iY, continent2.west);
            }
            else {
                utilities.addWaterPlotTags(iX, iY, continent2.west);
            }
            TerrainBuilder.setTerrainType(iX, iY, terrain);
            //console.log("createLandmasses (" + iX + "," + iY +") = " + importedMap[iX][iY][0] + " = " + terrain + " / " + GameplayMap.getTerrainType(iX, iY));
        }
    }
}

export function createBiomes(iWidth, iHeight, importedMap, mapType) {
    
    console.log("YnAMP : Create Biomes...");
    
    let getBiomeFromRow;
    
    switch (mapType) {
        case "CIV6":
            getBiomeFromRow = getBiomeFromCiv6Row;
            break;
        case "CIV7":
            getBiomeFromRow = getBiomeFromCiv7Row;
            break;
        default:
            console.log("MapType Error = " + mapType);
            return;
    }
    
    //console.log(iHeight);
    //console.log(iWidth);

    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let biome = getBiomeFromRow(importedMap[iX][iY]);
            TerrainBuilder.setBiomeType(iX, iY, biome);
            //console.log("SetBiome (" + iX + "," + iY +") = " + importedMap[iX][iY][0] + " = " + biome);
        }
    }
}

export function placeFeatures(iWidth, iHeight, importedMap, mapType) {
    
    console.log("YnAMP : Add Features...");
    
    let getFeatureFromRow;
    
    switch (mapType) {
        case "CIV6":
            getFeatureFromRow = getFeatureFromCiv6Row;
            break;
        case "CIV7":
            getFeatureFromRow = getFeatureFromCiv7Row;
            break;
        default:
            console.log("MapType Error = " + mapType);
            return;
    }

    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let featureIndex = getFeatureFromRow(importedMap[iX][iY]);

            const featureParam = {
                Feature: featureIndex,
                Direction: -1,
                Elevation: 0
            };

            if (featureIndex == 0) {
                console.log("Feature[" + iX + "][" + iY + "]) = " + featureIndex + " (None)");
                TerrainBuilder.setFeatureType(iX, iY, 0);
            } else if (featureIndex == -1) {
                console.log("Feature[" + iX + "][" + iY + "]) = " + featureIndex + " (Random)");
            } else { 
                TerrainBuilder.setFeatureType(iX, iY, 0); // Remove existing feature if any
                if (TerrainBuilder.canHaveFeature(iX, iY, featureParam)) {
                    console.log("Feature[" + iX + "][" + iY + "]) = " + featureIndex + " (" + GameInfo.Features[featureIndex].Name + ") ... OK");
                    TerrainBuilder.setFeatureType(iX, iY, featureParam);
                } else {
                    console.log("Feature[" + iX + "][" + iY + "]) = " + featureIndex + " (" + GameInfo.Resources[featureIndex].Name + ") - WARNING: ResourceBuilder check failed, incompatible position !");
                    TerrainBuilder.setFeatureType(iX, iY, featureParam);
                }
            }
        }
    }
}

export function placeResources(iWidth, iHeight, importedMap, mapType) {
    console.log("YnAMP : Add Resources...");

    let getResourceFromRow;

    switch (mapType) {
        case "CIV6":
            //getResourceFromRow = getResourceFromCiv6Row;
            break;
        case "CIV7":
            getResourceFromRow = getResourceFromCiv7Row;
            break;
        default:
            console.log("MapType Error = " + mapType);
            return;
    }

    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let resourceIndex = getResourceFromRow(importedMap[iX][iY]);
            
            if (resourceIndex == 0) {
                console.log("Resource[" + iX + "][" + iY + "]) = " + resourceIndex + " (None)");
                ResourceBuilder.setResourceType(iX, iY, ResourceTypes.NO_RESOURCE);
            } else if (resourceIndex == -1) {
                console.log("Resource[" + iX + "][" + iY + "]) = " + resourceIndex + "(Random)");
            } else { 
                ResourceBuilder.setResourceType(iX, iY, ResourceTypes.NO_RESOURCE); // Remove existing resource if any
                if (ResourceBuilder.canHaveResource(iX, iY, resourceIndex)) {
                    console.log("Resource[" + iX + "][" + iY + "]) = " + resourceIndex + " (" + GameInfo.Resources[resourceIndex].Name + ") ... OK");
                    ResourceBuilder.setResourceType(iX, iY, resourceIndex);
                } else {
                    console.log("Resource[" + iX + "][" + iY + "]) = " + resourceIndex + " (" + GameInfo.Resources[resourceIndex].Name + ") - WARNING: ResourceBuilder check failed, incompatible position !");
                    ResourceBuilder.setResourceType(iX, iY, resourceIndex); // 
                }
            }
        }
    }
}

export function importSnow(iWidth, iHeight, importedMap) {
    
    console.log("YnAMP : Add snow...");
    const aLightSnowEffects = MapPlotEffects.getPlotEffectTypesContainingTags(["SNOW", "LIGHT", "PERMANENT"]);
    const aMediumSnowEffects = MapPlotEffects.getPlotEffectTypesContainingTags(["SNOW", "MEDIUM", "PERMANENT"]);
    const aHeavySnowEffects = MapPlotEffects.getPlotEffectTypesContainingTags(["SNOW", "HEAVY", "PERMANENT"]);
    
    let aWeightEffect = (aHeavySnowEffects ? aHeavySnowEffects[0] : -1);
    
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {   
            if (isCiv6RowSnow(importedMap[iX][iY])) {
                //console.log("Snow (" + iX + "," + iY +") = " + importedMap[iX][iY][0]);
                MapPlotEffects.addPlotEffect(GameplayMap.getIndexFromXY(iX, iY), aWeightEffect);
            }
        }
    }
}

export function extraJungle(iWidth, iHeight, importedMap) {
    let featIdx = GameInfo.Features.find(t => t.FeatureType == 'FEATURE_RAINFOREST').$index;
    console.log("YnAMP : Extra Jungle...");

    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {           
            let feature = GameplayMap.getFeatureType(iX, iY);
            if (GameplayMap.isWater(iX, iY) == false && feature == FeatureTypes.NO_FEATURE && GameplayMap.isNavigableRiver(iX, iY) == false) {
                if (isCiv6RowJungle(importedMap[iX][iY]) ) {//&& canAddFeature(iX, iY, featIdx, true /*bScatterable*/, false /*bRiverMouth*/, false /*bCoastal*/, false /*bNearRiver*/, false /*bIsolated*/, false /*bReef*/, false /*bIce*/)) {
                    //console.log("Extra Jungle (" + iX + "," + iY +") = " + importedMap[iX][iY][0]);
                     const featureParam = {
                        Feature: featIdx,
                        Direction: -1,
                        Elevation: 0
                    };
                    TerrainBuilder.setFeatureType(iX, iY, featureParam);
                }
            }
        }
    }
}

export function validate (iWidth, iHeight, iNumPlayers1, iNumPlayers2) {
    
    // Fix for distant land resources on homeland
    // (generateResources hemispheres are hardcoded, on Earth map with the old world / new world ratio being != 1/2 it causes issues )
    let uiStartAgeHash = Configuration.getGameValue("StartAge");
    let resourceReplace = {};
    GameInfo.Resources.forEach((o) => {
        var resourceInfo = o;
        if (resourceInfo && resourceInfo.Tradeable) {
            if (ResourceBuilder.isResourceValidForAge(resourceInfo.ResourceType, uiStartAgeHash)) {
                let sResourceType = resourceInfo.ResourceType;
                switch (sResourceType) {
                    case "RESOURCE_SILVER":
                        resourceReplace["RESOURCE_SILVER_DISTANT_LANDS"] = GameInfo.Resources.find(t => t.ResourceType == sResourceType).$index;
                        break;
                    case "RESOURCE_GOLD":
                        resourceReplace["RESOURCE_GOLD_DISTANT_LANDS"] = GameInfo.Resources.find(t => t.ResourceType == sResourceType).$index;
                        break;
                    case "RESOURCE_KAOLIN":
                        resourceReplace["RESOURCE_COCOA"] = GameInfo.Resources.find(t => t.ResourceType == sResourceType).$index;
                        break;
                    case "RESOURCE_IVORY":
                        resourceReplace["RESOURCE_SPICES"] = GameInfo.Resources.find(t => t.ResourceType == sResourceType).$index;
                        break;
                    case "RESOURCE_COTTON":
                        resourceReplace["RESOURCE_SUGAR"] = GameInfo.Resources.find(t => t.ResourceType == sResourceType).$index;
                        break;
                    case "RESOURCE_HIDES":
                        resourceReplace["RESOURCE_TEA"] = GameInfo.Resources.find(t => t.ResourceType == sResourceType).$index;
                        break;
                    default:
                }
            }
        }
    });
    
    
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrain = GameplayMap.getTerrainType(iX, iY);
            const terrainRow = GameInfo.Terrains.lookup(terrain);
            let rainfall = GameplayMap.getRainfall(iX, iY);
            let iElevation = GameplayMap.getElevation(iX, iY);
            let plotTag = "WEST";
            if (GameplayMap.hasPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS) || GameplayMap.hasPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_WATER)) {
                plotTag = "EAST";
            }
            //console.log("Validate (" + iX + "," + iY + ") - Elevation = " + iElevation + ", rainfall = " + rainfall + ", terrain = " + terrainRow.TerrainType + ", plotTag = " + plotTag + " num1 > num2 = " + (iNumPlayers1 > iNumPlayers2));
            let bIsDistantLand = false;
            if (iNumPlayers1 > iNumPlayers2) { // "EAST" is Distant Land
                bIsDistantLand = plotTag == "EAST";
            } else {
                bIsDistantLand = plotTag == "WEST";
            }
            if (!bIsDistantLand) {
                let iResource = GameplayMap.getResourceType(iX, iY);
                if (iResource != ResourceTypes.NO_RESOURCE) {
                    let resourceInfo = GameInfo.Resources.lookup(iResource);
                    if (resourceInfo != null && resourceInfo.Hemispheres == 1) {
                        console.log("  - FOUND DISTANT LAND RESOURCE IN HOME LAND : " + resourceInfo.ResourceType);
                        let iResource = resourceReplace[resourceInfo.ResourceType];
                        ResourceBuilder.setResourceType(iX, iY, ResourceTypes.NO_RESOURCE); // Remove distant land resources
                        if (typeof resourceReplace[resourceInfo.ResourceType] !== 'undefined' && ResourceBuilder.canHaveResource(iX, iY, iResource)) {
                            ResourceBuilder.setResourceType(iX, iY, iResource);
                            console.log("    - replaced");
                        } else {
                            console.log("    - can't replace, removed");
                        }
                    }
                }
            }
        }
    }
}

console.log("Loaded YnAMP Utilities");

