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
            /*/
            if (terrain != globals.g_OceanTerrain && terrain != globals.g_CoastTerrain) {
                //console.log("   - addLandmassPlotTags");
                utilities.addLandmassPlotTags(iX, iY, continent2.west);
            }
            TerrainBuilder.setTerrainType(iX, iY, terrain);
             if (GameplayMap.hasPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS)) {
                //console.log("   - PLOT_TAG_EAST_LANDMASS");
             }
             if (GameplayMap.hasPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_LANDMASS)) {
                //console.log("   - PLOT_TAG_WEST_LANDMASS");
             }
             //*/
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
                    //utilities.addLandmassPlotTags(iX, iY, continent2.west);
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
    //console.log("getTerrainFromCiv6 - terrain = " + sCiv6Terrain + " : " + typeof(sCiv6Terrain));
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
    //console.log("getTerrainFromCiv6Row - terrain = " + terrain + " : " + typeof(terrain));
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

export function isCiv6RowRiver(row) {
    let river = row[civ6MapIDX.river];

    // Check for rivers in all three directions
    if (river[0][0] !== 0 || river[1][0] !== 0 || river[2][0] !== 0) {
    return true;
    }

    return false;
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
                //utilities.addLandmassPlotTags(iX, iY, continent2.west);
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
//            TerrainBuilder.setBiomeType(iX, iY, globals.g_MarineBiome);
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
                //console.log("Feature[" + iX + "][" + iY + "]) = " + featureIndex + " (Random)");
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
                //console.log("Resource[" + iX + "][" + iY + "]) = " + resourceIndex + "(Random)");
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

export function validate (iWidth, iHeight, iNumPlayers1, iNumPlayers2, westContinent, eastContinent, startPositions, mapName) {
    // Validation function - renamed to differentiate from the old validate() that handled resource conversion
    // This is a minimal stub for backward compatibility - actual homeland/distant lands classification 
    // is now handled by overrideHomelandsWithXMLRegions() using the superregion system
    console.log("validate: mapName=" + mapName);
    console.log("validate: Homeland/distant lands are now assigned via overrideHomelandsWithXMLRegions()");
}


// Helper function to get neighboring tiles (with wrap-around on X axis)
/**
 * @param {number} x
 * @param {number} y
 * @param {number} mapWidth
 * @param {number} mapHeight
 * @returns {{x:number,y:number}[]}
 */
function getNeighbors(x, y, mapWidth, mapHeight) {
    let neighbors = [];
    let seen = new Set();
    let iIndex = GameplayMap.getIndexFromXY(x, y);
    let iLocation = GameplayMap.getLocationFromIndex(iIndex);

    for (let iDirection = 0; iDirection < DirectionTypes.NUM_DIRECTION_TYPES; iDirection++) {
        let adjacent = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection);
        if (!adjacent) {
            continue;
        }

        let newY = adjacent.y;
        if (newY < 0 || newY >= mapHeight) {
            continue;
        }

        let newX = (adjacent.x + mapWidth) % mapWidth;
        let key = newX + newY * mapWidth;
        if (!seen.has(key)) {
            seen.add(key);
            neighbors.push({x: newX, y: newY});
        }
    }

    return neighbors;
}

function collectConnectedNonOceanComponent(startX, startY, mapWidth, mapHeight) {
    if (GameplayMap.getTerrainType(startX, startY) == globals.g_OceanTerrain) {
        return { tiles: [], keys: new Set(), spansWrap: false };
    }

    let startKey = startX + startY * mapWidth;
    let queue = [{x: startX, y: startY}];
    let tiles = [];
    let keys = new Set([startKey]);
    let touchesWestEdge = startX == 0;
    let touchesEastEdge = startX == mapWidth - 1;

    while (queue.length > 0) {
        let tile = queue.shift();
        tiles.push(tile);

        let neighbors = getNeighbors(tile.x, tile.y, mapWidth, mapHeight);
        for (let neighbor of neighbors) {
            let key = neighbor.x + neighbor.y * mapWidth;
            if (keys.has(key)) {
                continue;
            }
            if (GameplayMap.getTerrainType(neighbor.x, neighbor.y) == globals.g_OceanTerrain) {
                continue;
            }

            keys.add(key);
            queue.push({x: neighbor.x, y: neighbor.y});
            touchesWestEdge = touchesWestEdge || neighbor.x == 0;
            touchesEastEdge = touchesEastEdge || neighbor.x == mapWidth - 1;
        }
    }

    return { tiles, keys, spansWrap: touchesWestEdge && touchesEastEdge };
}

function collectAdjacentCoastRing(componentTiles, componentKeys, mapWidth, mapHeight) {
    let coastTiles = [];
    let coastKeys = new Set();

    for (let tile of componentTiles) {
        let neighbors = getNeighbors(tile.x, tile.y, mapWidth, mapHeight);
        for (let neighbor of neighbors) {
            let key = neighbor.x + neighbor.y * mapWidth;
            if (componentKeys.has(key) || coastKeys.has(key)) {
                continue;
            }
            if (GameplayMap.getTerrainType(neighbor.x, neighbor.y) != globals.g_CoastTerrain) {
                continue;
            }

            coastKeys.add(key);
            coastTiles.push({x: neighbor.x, y: neighbor.y});
        }
    }

    return coastTiles;
}

function hasMixedEastWestRegionIds(componentTiles) {
    let hasWest = false;
    let hasEast = false;

    for (let tile of componentTiles) {
        let regionId = GameplayMap.getLandmassRegionId(tile.x, tile.y);
        hasWest = hasWest || regionId == LandmassRegion.LANDMASS_REGION_WEST;
        hasEast = hasEast || regionId == LandmassRegion.LANDMASS_REGION_EAST;
        if (hasWest && hasEast) {
            return true;
        }
    }

    return false;
}

function applyEastWestRegionTag(iX, iY, targetRegionId, useEastTags) {
    let terrainType = GameplayMap.getTerrainType(iX, iY);
    if (terrainType == globals.g_CoastTerrain) {
        TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WATER);
        if (useEastTags) {
            TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_WATER);
        } else {
            TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_WATER);
        }
        TerrainBuilder.setLandmassRegionId(iX, iY, targetRegionId);
        return "coast";
    }

    if (!GameplayMap.isWater(iX, iY)) {
        if (useEastTags) {
            TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS);
        } else {
            TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_LANDMASS);
        }
        TerrainBuilder.setLandmassRegionId(iX, iY, targetRegionId);
        return "land";
    }

    return "ignored";
}

// Superregion groupings - maps individual XML regions to continental superregions.
// Data is loaded from the ContinentsRegion table (populated in maps.xml).
// Fallback: if the table is empty (e.g. data not loaded yet), returns an empty map.
/**
 * @returns {{[region:string]: string}}
 */
function getSuperregionMapping() {
    const map = {};
    const rows = GameInfo.ContinentsRegion;
    if (!rows) return map;
    for (let i = 0; i < rows.length; i++) {
        map[rows[i].Region] = rows[i].SuperRegion;
    }
    return map;
}

/**
 * @param {number} iWidth
 * @param {number} iHeight
 * @param {string} mapName
 * @returns {(string|null)[][] | null}
 */
function buildRegionGrid(iWidth, iHeight, mapName) {
    let regionRows = GameInfo.RegionPosition;
    if (!regionRows) {
        return null;
    }

    let regionByTile = [];
    for (let iX = 0; iX < iWidth; iX++) {
        regionByTile[iX] = [];
        for (let iY = 0; iY < iHeight; iY++) {
            regionByTile[iX][iY] = null;
        }
    }

    regionRows.forEach((row) => {
        if (row.MapName != mapName) {
            return;
        }
        let startX = row.X;
        let startY = row.Y;
        let endY = row.Y + row.Height - 1;
        for (let xOffset = 0; xOffset < row.Width; xOffset++) {
            let x = (startX + xOffset + iWidth) % iWidth;
            for (let y = startY; y <= endY; y++) {
                if (x >= 0 && x < iWidth && y >= 0 && y < iHeight) {
                    regionByTile[x][y] = row.Region;
                }
            }
        }
    });

    return regionByTile;
}

export function hasRegionPositionData(mapName) {
    let regionRows = GameInfo.RegionPosition;
    if (!regionRows) {
        return false;
    }

    for (let i = 0; i < regionRows.length; i++) {
        if (regionRows[i].MapName == mapName) {
            return true;
        }
    }

    return false;
}

/**
 * @param {number} iWidth
 * @param {number} iHeight
 * @param {string} mapName
 */
export function overrideHomelandsWithXMLRegions(iWidth, iHeight, mapName) {
    console.log("overrideHomelandsWithXMLRegions: Starting for mapName=" + mapName);
    
    // Build region grid from XML
    let regionByTile = buildRegionGrid(iWidth, iHeight, mapName);
    if (!regionByTile) {
        console.log("overrideHomelandsWithXMLRegions: No RegionPosition data found, falling back to landmass mode");
        overrideHomelandsWithLandmass(iWidth, iHeight);
        return;
    }
    
    // Find the human player
    let humanPlayerId = -1;
    let aliveMajorIds = Players.getAliveMajorIds();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        if (Players.isHuman(aliveMajorIds[i])) {
            humanPlayerId = aliveMajorIds[i];
            console.log("overrideHomelandsWithXMLRegions: Found human player ID=" + humanPlayerId);
            break;
        }
    }
    
    if (humanPlayerId == -1) {
        console.log("overrideHomelandsWithXMLRegions: No human player found, falling back to landmass mode");
        overrideHomelandsWithLandmass(iWidth, iHeight);
        return;
    }
    
    // Get human player's start position
    let humanStartPlot = StartPositioner.getStartPosition(humanPlayerId);
    if (humanStartPlot === undefined || humanStartPlot === null || humanStartPlot < 0) {
        console.log("overrideHomelandsWithXMLRegions: Invalid start position for human player: " + humanStartPlot + ", falling back to landmass mode");
        overrideHomelandsWithLandmass(iWidth, iHeight);
        return;
    }
    
    let humanStartX = humanStartPlot % iWidth;
    let humanStartY = Math.floor(humanStartPlot / iWidth);
    if (humanStartX < 0 || humanStartX >= iWidth || humanStartY < 0 || humanStartY >= iHeight || !regionByTile[humanStartX]) {
        console.log("overrideHomelandsWithXMLRegions: Human start position out of bounds: (" + humanStartX + "," + humanStartY + "), falling back to landmass mode");
        overrideHomelandsWithLandmass(iWidth, iHeight);
        return;
    }
    let humanRegion = regionByTile[humanStartX][humanStartY];
    
    console.log("overrideHomelandsWithXMLRegions: Human player at (" + humanStartX + "," + humanStartY + ") in region " + humanRegion);
    
    if (!humanRegion) {
        console.log("overrideHomelandsWithXMLRegions: Human start position not in any XML region, falling back to landmass mode");
        overrideHomelandsWithLandmass(iWidth, iHeight);
        return;
    }
    
    // Map XML region to superregion (continent)
    let superregionMap = getSuperregionMapping();
    let humanSuperregion = superregionMap[humanRegion];
    
    if (!humanSuperregion) {
        console.log("overrideHomelandsWithXMLRegions: Region '" + humanRegion + "' not found in superregion mapping, falling back to landmass mode");
        overrideHomelandsWithLandmass(iWidth, iHeight);
        return;
    }
    
    console.log("overrideHomelandsWithXMLRegions: Human player in superregion " + humanSuperregion);
    
    // First pass: mark all tiles in the human's superregion as homeland
    let isHomeland = [];
    for (let iY = 0; iY < iHeight; iY++) {
        isHomeland[iY] = [];
        for (let iX = 0; iX < iWidth; iX++) {
            let regionName = regionByTile[iX][iY];
            let tileSuperregion = regionName ? superregionMap[regionName] : null;
            isHomeland[iY][iX] = tileSuperregion === humanSuperregion;
        }
    }
    
    // Second pass: flood fill to include all contiguous land tiles in the same superregion
    // This ensures that land tiles not covered by XML regions but connected to the superregion are correctly classified
    let queue = [];
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            if (isHomeland[iY][iX]) {
                queue.push({x: iX, y: iY});
            }
        }
    }
    
    while (queue.length > 0) {
        let tile = queue.shift();
        let neighbors = getNeighbors(tile.x, tile.y, iWidth, iHeight);
        
        for (let neighbor of neighbors) {
            let nX = neighbor.x;
            let nY = neighbor.y;
            
            // If it's land and not yet marked as homeland
            if (!GameplayMap.isWater(nX, nY) && !isHomeland[nY][nX]) {
                // Check if it's in a different superregion
                let neighborRegion = regionByTile[nX][nY];
                let neighborSuperregion = neighborRegion ? superregionMap[neighborRegion] : null;
                
                // Only expand if tile is not explicitly in a different superregion
                if (!neighborSuperregion || neighborSuperregion === humanSuperregion) {
                    isHomeland[nY][nX] = true;
                    queue.push({x: nX, y: nY});
                }
            }
        }
    }
    
    // Final pass: apply landmass region IDs
    let tagCounts = { homeland: 0, distant: 0 };
    let homelandLandPlots = [];
    let distantLandPlots = [];
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            if (!GameplayMap.isWater(iX, iY)) {
                if (isHomeland[iY][iX]) {
                    TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_WEST);
                    tagCounts.homeland++;
                    homelandLandPlots.push({ x: iX, y: iY });
                } else {
                    TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_EAST);
                    tagCounts.distant++;
                    distantLandPlots.push({ x: iX, y: iY });
                }
            }
        }
    }

    function getNearestDistanceToPlots(iX, iY, plots) {
        if (!plots || plots.length === 0) {
            return Number.MAX_SAFE_INTEGER;
        }

        let minDistance = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < plots.length; i++) {
            let plot = plots[i];
            let distance = GameplayMap.getPlotDistance(iX, iY, plot.x, plot.y);
            if (distance < minDistance) {
                minDistance = distance;
                if (minDistance <= 1) {
                    break;
                }
            }
        }
        return minDistance;
    }

    // Water retagging for XML maps:
    // Classify every water tile by nearest homeland-vs-distant land to keep tooltip data consistent.
    let waterTagCounts = { homeland: 0, distant: 0 };
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            if (!GameplayMap.isWater(iX, iY)) {
                continue;
            }

            let nearestHomelandDistance = getNearestDistanceToPlots(iX, iY, homelandLandPlots);
            let nearestDistantDistance = getNearestDistanceToPlots(iX, iY, distantLandPlots);
            let isHomelandWater = nearestHomelandDistance <= nearestDistantDistance;

            if (distantLandPlots.length === 0) {
                isHomelandWater = true;
            }
            if (homelandLandPlots.length === 0) {
                isHomelandWater = false;
            }

            if (isHomelandWater) {
                TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WATER);
                TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_WATER);
                TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_WEST);
                waterTagCounts.homeland++;
            } else {
                TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WATER);
                TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_WATER);
                TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_EAST);
                waterTagCounts.distant++;
            }
        }
    }
    
    console.log("overrideHomelandsWithXMLRegions: Applied landmass region IDs - homeland=" + tagCounts.homeland + " distant=" + tagCounts.distant);
    console.log("overrideHomelandsWithXMLRegions: Retagged coastal water - homeland=" + waterTagCounts.homeland + " distant=" + waterTagCounts.distant);
}

export function overrideEastWestSeamIslandStarts(iWidth, iHeight) {
    console.log("overrideEastWestSeamIslandStarts: Starting");

    let aliveMajorIds = Players.getAliveMajorIds();
    let processedKeys = new Set();
    let retaggedComponents = 0;
    let retaggedLandPlots = 0;
    let retaggedCoastPlots = 0;

    for (let i = 0; i < aliveMajorIds.length; i++) {
        let playerId = aliveMajorIds[i];
        let startPlot = StartPositioner.getStartPosition(playerId);
        if (startPlot === undefined || startPlot === null || startPlot < 0) {
            continue;
        }

        let startX = startPlot % iWidth;
        let startY = Math.floor(startPlot / iWidth);
        let startKey = startX + startY * iWidth;
        if (processedKeys.has(startKey)) {
            continue;
        }

        let component = collectConnectedNonOceanComponent(startX, startY, iWidth, iHeight);
        component.keys.forEach((key) => processedKeys.add(key));

        if (component.tiles.length === 0 || !component.spansWrap || !hasMixedEastWestRegionIds(component.tiles)) {
            continue;
        }

        let targetRegionId = GameplayMap.getLandmassRegionId(startX, startY);
        if (targetRegionId != LandmassRegion.LANDMASS_REGION_WEST && targetRegionId != LandmassRegion.LANDMASS_REGION_EAST) {
            console.log("overrideEastWestSeamIslandStarts: Skipping player " + playerId + " at (" + startX + "," + startY + ") because start tile has non-east-west regionId=" + targetRegionId);
            continue;
        }
        let useEastTags = GameplayMap.hasPlotTag(startX, startY, PlotTags.PLOT_TAG_EAST_LANDMASS);

        let coastRing = collectAdjacentCoastRing(component.tiles, component.keys, iWidth, iHeight);
        retaggedComponents++;

        for (let tile of component.tiles) {
            let result = applyEastWestRegionTag(tile.x, tile.y, targetRegionId, useEastTags);
            if (result == "land") {
                retaggedLandPlots++;
            } else if (result == "coast") {
                retaggedCoastPlots++;
            }
        }

        for (let coastTile of coastRing) {
            let result = applyEastWestRegionTag(coastTile.x, coastTile.y, targetRegionId, useEastTags);
            if (result == "coast") {
                retaggedCoastPlots++;
            }
        }

        console.log("overrideEastWestSeamIslandStarts: Retagged seam-spanning component for player " + playerId + " at (" + startX + "," + startY + ") with " + component.tiles.length + " non-ocean tiles and " + coastRing.length + " adjacent coast tiles");
    }

    console.log("overrideEastWestSeamIslandStarts: Retagged components=" + retaggedComponents + " land=" + retaggedLandPlots + " coast=" + retaggedCoastPlots);
}

function collectConnectedLandSubcomponent(startX, startY, mapWidth, mapHeight, allowedKeys, visitedLandKeys) {
    if (GameplayMap.isWater(startX, startY)) {
        return { tiles: [], keys: new Set(), depth: 0 };
    }

    let startKey = startX + startY * mapWidth;
    let queue = [{x: startX, y: startY, depth: 0}];
    let tiles = [];
    let keys = new Set([startKey]);
    let maxDepth = 0;
    visitedLandKeys.add(startKey);

    while (queue.length > 0) {
        let tile = queue.shift();
        tiles.push({x: tile.x, y: tile.y});
        maxDepth = Math.max(maxDepth, tile.depth);

        let neighbors = getNeighbors(tile.x, tile.y, mapWidth, mapHeight);
        for (let neighbor of neighbors) {
            let key = neighbor.x + neighbor.y * mapWidth;
            if (visitedLandKeys.has(key) || !allowedKeys.has(key) || GameplayMap.isWater(neighbor.x, neighbor.y)) {
                continue;
            }

            visitedLandKeys.add(key);
            keys.add(key);
            queue.push({x: neighbor.x, y: neighbor.y, depth: tile.depth + 1});
        }
    }

    return { tiles, keys, depth: maxDepth };
}

function getLandOnlyStatsForComponent(component, mapWidth, mapHeight) {
    let landTiles = [];
    let visitedLandKeys = new Set();
    let largestLandCoreSize = 0;
    let largestLandCoreDepth = 0;

    for (let tile of component.tiles) {
        if (!GameplayMap.isWater(tile.x, tile.y)) {
            landTiles.push({x: tile.x, y: tile.y});
        }
    }

    for (let tile of landTiles) {
        let key = tile.x + tile.y * mapWidth;
        if (visitedLandKeys.has(key)) {
            continue;
        }

        let landSubcomponent = collectConnectedLandSubcomponent(tile.x, tile.y, mapWidth, mapHeight, component.keys, visitedLandKeys);
        if (landSubcomponent.tiles.length > largestLandCoreSize ||
            (landSubcomponent.tiles.length == largestLandCoreSize && landSubcomponent.depth > largestLandCoreDepth)) {
            largestLandCoreSize = landSubcomponent.tiles.length;
            largestLandCoreDepth = landSubcomponent.depth;
        }
    }

    return {
        landTiles,
        landTileCount: landTiles.length,
        largestLandCoreSize,
        largestLandCoreDepth
    };
}

function getMainlandCoreThreshold(mapWidth, mapHeight) {
    return Math.max(36, Math.floor((mapWidth * mapHeight) / 150));
}

function isMainlandStartComponent(component, mapWidth, mapHeight) {
    return component.largestLandCoreSize >= getMainlandCoreThreshold(mapWidth, mapHeight);
}

function getComponentAttachmentPlots(component) {
    if (component.coastRing.length > 0) {
        return component.coastRing;
    }
    if (component.landTiles.length > 0) {
        return component.landTiles;
    }
    return component.tiles;
}

function getMinimumPlotDistanceBetweenSets(sourcePlots, targetPlots) {
    if (!sourcePlots || sourcePlots.length === 0 || !targetPlots || targetPlots.length === 0) {
        return Number.MAX_SAFE_INTEGER;
    }

    let minDistance = Number.MAX_SAFE_INTEGER;
    for (let sourcePlot of sourcePlots) {
        for (let targetPlot of targetPlots) {
            let distance = GameplayMap.getPlotDistance(sourcePlot.x, sourcePlot.y, targetPlot.x, targetPlot.y);
            if (distance < minDistance) {
                minDistance = distance;
                if (minDistance <= 1) {
                    return minDistance;
                }
            }
        }
    }

    return minDistance;
}

function addComponentKeysToSet(component, targetSet) {
    component.keys.forEach((key) => targetSet.add(key));
}

function collectPlayerStartComponents(iWidth, iHeight, aliveMajorIds) {
    let components = [];
    let componentByTileKey = new Map();

    for (let i = 0; i < aliveMajorIds.length; i++) {
        let playerId = aliveMajorIds[i];
        let startPlot = StartPositioner.getStartPosition(playerId);
        if (startPlot === undefined || startPlot === null || startPlot < 0) {
            continue;
        }

        let startX = startPlot % iWidth;
        let startY = Math.floor(startPlot / iWidth);
        let startKey = startX + startY * iWidth;
        let component = componentByTileKey.get(startKey);

        if (!component) {
            let connectedComponent = collectConnectedNonOceanComponent(startX, startY, iWidth, iHeight);
            let landStats = getLandOnlyStatsForComponent(connectedComponent, iWidth, iHeight);
            component = {
                id: components.length + 1,
                tiles: connectedComponent.tiles,
                keys: connectedComponent.keys,
                spansWrap: connectedComponent.spansWrap,
                coastRing: collectAdjacentCoastRing(connectedComponent.tiles, connectedComponent.keys, iWidth, iHeight),
                landTiles: landStats.landTiles,
                landTileCount: landStats.landTileCount,
                largestLandCoreSize: landStats.largestLandCoreSize,
                largestLandCoreDepth: landStats.largestLandCoreDepth,
                playerIds: [],
                playerOrders: []
            };

            components.push(component);
            component.keys.forEach((key) => componentByTileKey.set(key, component));
        }

        if (component.playerIds.indexOf(playerId) == -1) {
            component.playerIds.push(playerId);
            component.playerOrders.push(i);
        }
    }

    for (let component of components) {
        component.firstPlayerOrder = component.playerOrders.length > 0 ? Math.min(...component.playerOrders) : Number.MAX_SAFE_INTEGER;
        component.isMainland = isMainlandStartComponent(component, iWidth, iHeight);
    }

    return components;
}

/**
 * Tags landmass region IDs based on connectivity from player start positions.
 * Mirrors continents-voronoi.js behavior:
 *   - Human's start component remains homeland when it is mainland-classified
 *   - If the human starts on islands, homeland is anchored to the first mainland-classified player component
 *   - Player-start island components are attached to a mainland root before WEST/EAST tagging
 *   - Ocean-isolated uninhabited islands → PLOT_TAG_ISLAND, no region ID (DEFAULT)
 *   - Single continent (all players reachable from human) → raw 1 (pangaea-voronoi style)
 *   - Coast water: tagged by nearest land group; ocean water: left at DEFAULT
 * @param {number} iWidth
 * @param {number} iHeight
 */
export function overrideHomelandsWithLandmass(iWidth, iHeight) {
    console.log("overrideHomelandsWithLandmass: Starting");

    let humanPlayerId = -1;
    let aliveMajorIds = Players.getAliveMajorIds();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        if (Players.isHuman(aliveMajorIds[i])) {
            humanPlayerId = aliveMajorIds[i];
            break;
        }
    }
    if (humanPlayerId == -1) {
        console.log("overrideHomelandsWithLandmass: No human player found");
        humanPlayerId = aliveMajorIds[0];
    }

    let playerComponents = collectPlayerStartComponents(iWidth, iHeight, aliveMajorIds);
    if (playerComponents.length === 0) {
        console.log("overrideHomelandsWithLandmass: No valid player start components found");
        return;
    }

    let componentByPlayerId = new Map();
    for (let component of playerComponents) {
        for (let playerId of component.playerIds) {
            componentByPlayerId.set(playerId, component);
        }
    }

    let humanComponent = componentByPlayerId.get(humanPlayerId);
    if (!humanComponent) {
        console.log("overrideHomelandsWithLandmass: Human player start was invalid; falling back to the first valid player component");
        for (let i = 0; i < aliveMajorIds.length; i++) {
            let fallbackComponent = componentByPlayerId.get(aliveMajorIds[i]);
            if (fallbackComponent) {
                humanPlayerId = aliveMajorIds[i];
                humanComponent = fallbackComponent;
                break;
            }
        }
    }
    if (!humanComponent) {
        console.log("overrideHomelandsWithLandmass: Could not resolve a homeland root component");
        return;
    }

    let mainlandRootCandidates = [];
    let mainlandRootIds = new Set();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        let component = componentByPlayerId.get(aliveMajorIds[i]);
        if (!component || !component.isMainland || mainlandRootIds.has(component.id)) {
            continue;
        }

        mainlandRootIds.add(component.id);
        mainlandRootCandidates.push(component);
    }

    let homelandRootComponent = humanComponent;
    if (!humanComponent.isMainland) {
        for (let i = 0; i < aliveMajorIds.length; i++) {
            let candidate = componentByPlayerId.get(aliveMajorIds[i]);
            if (!candidate || !candidate.isMainland || candidate.id == humanComponent.id) {
                continue;
            }

            homelandRootComponent = candidate;
            break;
        }

        if (homelandRootComponent.id != humanComponent.id) {
            console.log("overrideHomelandsWithLandmass: Human start component " + humanComponent.id + " is island-classified; anchoring homeland to component " + homelandRootComponent.id + " via player " + homelandRootComponent.playerIds[0]);
        } else {
            console.log("overrideHomelandsWithLandmass: No mainland player component found; keeping human component " + humanComponent.id + " as homeland root");
        }
    }

    let distantRootComponents = [];
    let distantRootIds = new Set();
    if (mainlandRootCandidates.length > 0) {
        for (let component of mainlandRootCandidates) {
            if (component.id == homelandRootComponent.id || distantRootIds.has(component.id)) {
                continue;
            }

            distantRootIds.add(component.id);
            distantRootComponents.push(component);
        }
    } else {
        for (let i = 0; i < aliveMajorIds.length; i++) {
            let component = componentByPlayerId.get(aliveMajorIds[i]);
            if (!component || component.id == homelandRootComponent.id || distantRootIds.has(component.id)) {
                continue;
            }

            distantRootIds.add(component.id);
            distantRootComponents.push(component);
        }
    }

    let componentAssignments = new Map();
    componentAssignments.set(homelandRootComponent.id, "homeland");
    for (let component of distantRootComponents) {
        componentAssignments.set(component.id, "distant");
    }

    let mainlandAttachmentRoots = [];
    let mainlandAttachmentRootIds = new Set();
    let orderedAttachmentRoots = [homelandRootComponent].concat(distantRootComponents);
    for (let component of orderedAttachmentRoots) {
        if (!component.isMainland || mainlandAttachmentRootIds.has(component.id)) {
            continue;
        }

        mainlandAttachmentRootIds.add(component.id);
        mainlandAttachmentRoots.push(component);
    }

    let startAttachments = 0;
    if (mainlandAttachmentRoots.length > 0) {
        for (let component of playerComponents) {
            if (componentAssignments.has(component.id) || component.isMainland) {
                continue;
            }

            let targetRoot = null;
            if (component.id == humanComponent.id && homelandRootComponent.id != humanComponent.id && homelandRootComponent.isMainland) {
                targetRoot = homelandRootComponent;
            } else {
                let sourcePlots = getComponentAttachmentPlots(component);
                let bestDistance = Number.MAX_SAFE_INTEGER;
                for (let root of mainlandAttachmentRoots) {
                    if (root.id == component.id) {
                        continue;
                    }

                    let distance = getMinimumPlotDistanceBetweenSets(sourcePlots, getComponentAttachmentPlots(root));
                    if (distance < bestDistance || (distance == bestDistance && root.id == homelandRootComponent.id)) {
                        bestDistance = distance;
                        targetRoot = root;
                    }
                }
            }

            if (!targetRoot) {
                continue;
            }

            componentAssignments.set(component.id, targetRoot.id == homelandRootComponent.id ? "homeland" : "distant");
            startAttachments++;
            console.log("overrideHomelandsWithLandmass: Attached start-island component " + component.id + " (land=" + component.landTileCount + ", depth=" + component.largestLandCoreDepth + ") to anchor component " + targetRoot.id + " (land=" + targetRoot.landTileCount + ", depth=" + targetRoot.largestLandCoreDepth + ")");
        }
    }

    let homelandReachable = new Set();
    let distantReachable = new Set();
    for (let component of playerComponents) {
        let assignment = componentAssignments.get(component.id);
        if (assignment == "homeland") {
            addComponentKeysToSet(component, homelandReachable);
        } else if (assignment == "distant") {
            addComponentKeysToSet(component, distantReachable);
        }
    }

    let isSingleContinent = distantReachable.size === 0;
    if (isSingleContinent) {
        console.log("overrideHomelandsWithLandmass: Single continent — tagging non-ocean tiles as raw 1 (pangaea style)");
    }

    let distantRootIdList = [];
    for (let component of distantRootComponents) {
        distantRootIdList.push(component.id);
    }
    console.log("overrideHomelandsWithLandmass: Components=" + playerComponents.length + " startAttachments=" + startAttachments + " homelandRoot=" + homelandRootComponent.id + " distantRoots=" + distantRootIdList.length + (distantRootIdList.length > 0 ? " [" + distantRootIdList.join(",") + "]" : ""));

    // Classify and tag non-water (land) tiles
    let homelandLandPlots = [];
    let distantLandPlots = [];
    let isolatedLandPlots = [];

    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            if (GameplayMap.isWater(iX, iY)) continue; // land tiles only
            let key = iX + iY * iWidth;
            if (homelandReachable.has(key)) {
                if (isSingleContinent) {
                    // Pangaea-voronoi style: raw 1 so modulo check passes for all resource types
                    TerrainBuilder.setLandmassRegionId(iX, iY, 1);
                } else {
                    TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_LANDMASS);
                    TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_WEST);
                }
                homelandLandPlots.push({x: iX, y: iY});
            } else if (!isSingleContinent && distantReachable.has(key)) {
                TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS);
                TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_EAST);
                distantLandPlots.push({x: iX, y: iY});
            } else {
                // Ocean-isolated uninhabited island — no setLandmassRegionId → stays DEFAULT
                // Matches continents-voronoi behavior for landmassId 0/3/4+
                TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_ISLAND);
                isolatedLandPlots.push({x: iX, y: iY});
            }
        }
    }

    // Helper: brute-force nearest-plot-distance scan (same as overrideHomelandsWithXMLRegions)
    function getNearestDistanceToPlots(iX, iY, plots) {
        if (!plots || plots.length === 0) return Number.MAX_SAFE_INTEGER;
        let minDistance = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < plots.length; i++) {
            let distance = GameplayMap.getPlotDistance(iX, iY, plots[i].x, plots[i].y);
            if (distance < minDistance) {
                minDistance = distance;
                if (minDistance <= 1) break;
            }
        }
        return minDistance;
    }

    // Tag coast water tiles by nearest land group; leave ocean tiles at DEFAULT
    let waterTagCounts = { homeland: 0, distant: 0, island: 0, ocean: 0 };
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            let terrainType = GameplayMap.getTerrainType(iX, iY);
            if (terrainType == globals.g_CoastTerrain) {
                let nearestHomeland  = getNearestDistanceToPlots(iX, iY, homelandLandPlots);
                let nearestDistant   = getNearestDistanceToPlots(iX, iY, distantLandPlots);
                let nearestIsolated  = getNearestDistanceToPlots(iX, iY, isolatedLandPlots);

                if (isSingleContinent) {
                    // Single continent: coast near mainland gets raw 1; coast near isolated island stays PLOT_TAG_ISLAND
                    if (nearestHomeland <= nearestIsolated) {
                        TerrainBuilder.setLandmassRegionId(iX, iY, 1);
                        waterTagCounts.homeland++;
                    } else {
                        TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_ISLAND);
                        waterTagCounts.island++;
                    }
                } else if (nearestHomeland <= nearestDistant && nearestHomeland <= nearestIsolated) {
                    TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WATER);
                    TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_WATER);
                    TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_WEST);
                    waterTagCounts.homeland++;
                } else if (nearestDistant <= nearestIsolated) {
                    TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WATER);
                    TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_WATER);
                    TerrainBuilder.setLandmassRegionId(iX, iY, LandmassRegion.LANDMASS_REGION_EAST);
                    waterTagCounts.distant++;
                } else {
                    // Nearest land is an isolated island → island tag, no LandmassRegionId (DEFAULT)
                    TerrainBuilder.addPlotTag(iX, iY, PlotTags.PLOT_TAG_ISLAND);
                    waterTagCounts.island++;
                }
            } else if (terrainType == globals.g_OceanTerrain) {
                // Ocean: leave at DEFAULT — no tags, no region ID (consistent with voronoi ocean tiles)
                waterTagCounts.ocean++;
            }
        }
    }

    console.log("overrideHomelandsWithLandmass: Land — homeland=" + homelandLandPlots.length + " distant=" + distantLandPlots.length + " isolated=" + isolatedLandPlots.length);
    console.log("overrideHomelandsWithLandmass: Coast water — homeland=" + waterTagCounts.homeland + " distant=" + waterTagCounts.distant + " island=" + waterTagCounts.island + " (ocean untouched: " + waterTagCounts.ocean + ")");
}

/**
 * @param {number} iWidth
 * @param {number} iHeight
 * @param {number[]} startPositions
 * @param {string} mapName
 */
export function applyRegionBasedLandmassTags(iWidth, iHeight, startPositions, mapName) {
    console.log("applyRegionBasedLandmassTags: Starting with mapName=" + mapName);
    console.log("applyRegionBasedLandmassTags: startPositions type=" + typeof startPositions + " length=" + (Array.isArray(startPositions) ? startPositions.length : "not array"));
    if (Array.isArray(startPositions) && startPositions.length > 0) {
        console.log("applyRegionBasedLandmassTags: startPositions[0]=" + startPositions[0]);
    }
    
    // Build region grid from XML
    let regionByTile = buildRegionGrid(iWidth, iHeight, mapName);
    if (!regionByTile) {
        console.log("applyRegionBasedLandmassTags: No RegionPosition data found");
        return;
    }
    
    // Identify human player's starting region
    let homelandRegions = {};
    if (Array.isArray(startPositions) && startPositions.length > 0) {
        let startIndex = startPositions[0]; // Human player is always index 0
        console.log("applyRegionBasedLandmassTags: Processing startIndex=" + startIndex);
        if (typeof startIndex === 'number' && !isNaN(startIndex)) {
            let startX = startIndex % iWidth;
            let startY = Math.floor(startIndex / iWidth);
            console.log("applyRegionBasedLandmassTags: Converted to (" + startX + "," + startY + ")");
            if (startX >= 0 && startX < iWidth && startY >= 0 && startY < iHeight) {
                let regionName = regionByTile[startX][startY];
                console.log("applyRegionBasedLandmassTags: regionByTile[" + startX + "][" + startY + "]=" + regionName);
                if (regionName) {
                    homelandRegions[regionName] = true;
                    console.log("applyRegionBasedLandmassTags: Human player in region " + regionName + " at (" + startX + "," + startY + ")");
                } else {
                    console.log("applyRegionBasedLandmassTags: No region name found at this position");
                }
            } else {
                console.log("applyRegionBasedLandmassTags: Coordinates out of bounds");
            }
        }
    }
    
    // Apply landmass tags based on regions
    // Tag ALL land tiles - homeland regions get WEST_LANDMASS, everything else (including unassigned) gets EAST_LANDMASS
    let tagCounts = { homeland: 0, distant: 0 };
    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            if (!GameplayMap.isWater(iX, iY)) {
                let regionName = regionByTile[iX][iY];
                let isHomeland = regionName ? homelandRegions[regionName] : false;
                if (isHomeland) {
                    TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_WEST_LANDMASS);
                    tagCounts.homeland++;
                } else {
                    // All non-homeland tiles (including unassigned) are distant lands
                    TerrainBuilder.setPlotTag(iX, iY, PlotTags.PLOT_TAG_EAST_LANDMASS);
                    tagCounts.distant++;
                }
            }
        }
    }
    
    console.log("applyRegionBasedLandmassTags: Applied tags - homeland=" + tagCounts.homeland + " distant=" + tagCounts.distant);
}

export function dumpElevationPrecise(iWidth, iHeight) {
    // Dump it out as an ASCII map to "Scripting.log"
    for (let iY = iHeight - 1; iY >= 0; iY--) {
        let str = '';
        if (iY % 2 == 1) {
            str += '   ';
        }
        for (let iX = 0; iX < iWidth; iX++) {
            if (GameplayMap.isWater(iX, iY) == false) {
                let elevation = GameplayMap.getElevation(iX, iY);
                let elevationToDisplay = ' ';
                let iNumToDisplay = elevation;
                if (iNumToDisplay < 100) {
                    elevationToDisplay += ' ';
                }
                if (iNumToDisplay < 10) {
                    elevationToDisplay += ' ';
                }
                elevationToDisplay += iNumToDisplay.toString();
                str += elevationToDisplay + ' ';
            }
            else {
                str += '     ';
            }
        }
        console.log(str);
    }
}

export function dumpRivers(iWidth, iHeight) {
    // Dump it out as an ASCII map to "Scripting.log"
    for (let iY = iHeight - 1; iY >= 0; iY--) {
        let str = '';
        if (iY % 2 == 1) {
            str += ' ';
        }
        for (let iX = 0; iX < iWidth; iX++) {
            if (GameplayMap.isWater(iX, iY) == false) {
                let riverToDisplay = '.';
                if (GameplayMap.isNavigableRiver(iX, iY)) {
                    riverToDisplay = 'R';
                }
                else if (GameplayMap.isRiver(iX, iY)) {
                    riverToDisplay = 'r';
                }
                str += riverToDisplay + ' ';
            }
            else {
                str += '  ';
            }
        }
        console.log(str);
    }
}

export function dumpciv6ImportedRivers(iWidth, iHeight, map) {
    // Dump it out as an ASCII map to "Scripting.log"
    for (let iY = iHeight - 1; iY >= 0; iY--) {
        let str = '';
        if (iY % 2 == 1) {
            str += ' ';
        }
        for (let iX = 0; iX < iWidth; iX++) {
            const row = map[iX][iY];
            if (getTerrainFromCiv6Row(row) != globals.g_OceanTerrain && getTerrainFromCiv6Row(row) != globals.g_CoastTerrain) {
                let riverToDisplay = '.';
                if (isCiv6RowRiver(row)) {
                    riverToDisplay = 'r';
                }
                str += riverToDisplay + ' ';
            }
            else {
                str += '  ';
            }
        }
        console.log(str);
    }
}

export function isAdjacentToTerrain(iX, iY, terrain) {
    for (let iDirection = 0; iDirection < DirectionTypes.NUM_DIRECTION_TYPES; iDirection++) {
        let iIndex = GameplayMap.getIndexFromXY(iX, iY);
        let iLocation = GameplayMap.getLocationFromIndex(iIndex);
        let iAdjacentX = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).x;
        let iAdjacentY = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).y;
        if (GameplayMap.getTerrainType(iAdjacentX, iAdjacentY) == terrain) {
            return true;
        }
    }
    return false;
}

console.log("Loaded YnAMP Utilities");

// ── Plot helpers (shared between ynamp-map-loading.js and ynamp-cultural-start.js) ──

function getComponentRegionIds(componentLandTiles) {
    let regionIds = new Set();
    for (let tile of componentLandTiles) {
        let regionId = GameplayMap.getLandmassRegionId(tile.x, tile.y);
        if (regionId == LandmassRegion.LANDMASS_REGION_DEFAULT ||
                regionId == LandmassRegion.LANDMASS_REGION_NONE ||
                regionId == LandmassRegion.LANDMASS_REGION_ANY) {
            continue;
        }
        regionIds.add(regionId);
    }
    return Array.from(regionIds).sort((a, b) => a - b);
}

function retagIslandComponentRegion(component, targetRegionId) {
    if (!component || targetRegionId == undefined || targetRegionId == null || targetRegionId < 0) {
        return;
    }

    for (let tile of component.tiles) {
        TerrainBuilder.setLandmassRegionId(tile.x, tile.y, targetRegionId);
    }
    for (let coastTile of component.coastRing) {
        TerrainBuilder.setLandmassRegionId(coastTile.x, coastTile.y, targetRegionId);
    }

    component.regionIds = [targetRegionId];
    component.primaryRegionId = targetRegionId;
    component.closestMainlandRegionId = targetRegionId;
}

function resolveClosestMainlandRegionId(component, islandMetadata) {
    if (!component) {
        return -1;
    }
    if (component.closestMainlandRegionId != undefined) {
        return component.closestMainlandRegionId;
    }

    let bestRegionId = -1;
    let bestDistance = Number.MAX_SAFE_INTEGER;
    let sourcePlots = component.attachmentPlots;
    for (let mainlandComponent of islandMetadata.mainlandComponents) {
        if (mainlandComponent.primaryRegionId < 0) {
            continue;
        }

        let distance = getMinimumPlotDistanceBetweenSets(sourcePlots, mainlandComponent.attachmentPlots);
        if (distance < bestDistance ||
                (distance == bestDistance && (bestRegionId < 0 || mainlandComponent.primaryRegionId < bestRegionId))) {
            bestDistance = distance;
            bestRegionId = mainlandComponent.primaryRegionId;
        }
    }

    component.closestMainlandRegionId = bestRegionId;
    component.closestMainlandDistance = bestDistance;
    return bestRegionId;
}

export function buildIslandStartMetadata(iWidth, iHeight) {
    let processedKeys = new Set();
    let components = [];
    let componentsById = new Map();
    let plotToComponentId = new Map();
    let islandPlots = new Set();
    let mainlandComponents = [];

    for (let y = 0; y < iHeight; y++) {
        for (let x = 0; x < iWidth; x++) {
            if (GameplayMap.getTerrainType(x, y) == globals.g_OceanTerrain) {
                continue;
            }

            let key = x + y * iWidth;
            if (processedKeys.has(key)) {
                continue;
            }

            let connectedComponent = collectConnectedNonOceanComponent(x, y, iWidth, iHeight);
            if (connectedComponent.tiles.length === 0) {
                continue;
            }

            connectedComponent.keys.forEach((componentKey) => processedKeys.add(componentKey));
            let landStats = getLandOnlyStatsForComponent(connectedComponent, iWidth, iHeight);
            let component = {
                id: components.length + 1,
                tiles: connectedComponent.tiles,
                keys: connectedComponent.keys,
                spansWrap: connectedComponent.spansWrap,
                coastRing: collectAdjacentCoastRing(connectedComponent.tiles, connectedComponent.keys, iWidth, iHeight),
                landTiles: landStats.landTiles,
                landTileCount: landStats.landTileCount,
                largestLandCoreSize: landStats.largestLandCoreSize,
                largestLandCoreDepth: landStats.largestLandCoreDepth,
            };
            component.isIsland = !isMainlandStartComponent(component, iWidth, iHeight);
            component.regionIds = getComponentRegionIds(component.landTiles);
            component.primaryRegionId = component.regionIds.length > 0 ? component.regionIds[0] : -1;
            component.attachmentPlots = getComponentAttachmentPlots(component);
            components.push(component);
            componentsById.set(component.id, component);

            for (let landTile of component.landTiles) {
                let plot = landTile.y * iWidth + landTile.x;
                plotToComponentId.set(plot, component.id);
                if (component.isIsland) {
                    islandPlots.add(plot);
                }
            }

            if (!component.isIsland && component.primaryRegionId >= 0) {
                mainlandComponents.push(component);
            }
        }
    }

    return {
        components,
        componentsById,
        plotToComponentId,
        islandPlots,
        mainlandComponents,
    };
}

export function isValidPlot(plotIndex) {
    return plotIndex !== undefined && plotIndex !== null && !isNaN(plotIndex) && plotIndex >= 0;
}

export function isSettlablePlot(x, y) {
    return !GameplayMap.isWater(x, y) &&
           !GameplayMap.isMountain(x, y) &&
           !GameplayMap.isNaturalWonder(x, y) &&
           GameplayMap.getResourceType(x, y) === ResourceTypes.NO_RESOURCE;
}

/**
 * @param {number} plotIndex
 * @param {Set<number>} usedPlots
 * @param {number} iWidth
 * @param {number} minDistance
 */
export function isPlotTooCloseToUsed(plotIndex, usedPlots, iWidth, minDistance) {
    if (!isValidPlot(plotIndex)) return true;
    const x = plotIndex % iWidth;
    const y = Math.floor(plotIndex / iWidth);
    for (const usedPlot of usedPlots) {
        const ux = usedPlot % iWidth;
        const uy = Math.floor(usedPlot / iWidth);
        if (GameplayMap.getPlotDistance(x, y, ux, uy) < minDistance) return true;
    }
    return false;
}

function chooseFallbackStartPlot(defaultPlot, usedPlots, iWidth, iHeight, minDistance, requiredRegionId = -1, candidateFilter = null) {
    const regionFilter = requiredRegionId >= 0;

    if (isValidPlot(defaultPlot)) {
        const x = defaultPlot % iWidth;
        const y = Math.floor(defaultPlot / iWidth);
        const regionOk = !regionFilter || GameplayMap.getLandmassRegionId(x, y) === requiredRegionId;
        const filterOk = !candidateFilter || candidateFilter(x, y, defaultPlot);
        if (regionOk && filterOk && isSettlablePlot(x, y) && !usedPlots.has(defaultPlot) &&
                !isPlotTooCloseToUsed(defaultPlot, usedPlots, iWidth, minDistance)) {
            return defaultPlot;
        }
    }

    const candidates = [];
    for (let y = 0; y < iHeight; y++) {
        for (let x = 0; x < iWidth; x++) {
            if (!isSettlablePlot(x, y)) continue;
            if (regionFilter && GameplayMap.getLandmassRegionId(x, y) !== requiredRegionId) continue;
            const plot = y * iWidth + x;
            if (usedPlots.has(plot)) continue;
            if (candidateFilter && !candidateFilter(x, y, plot)) continue;
            const score = StartPositioner.getStartPositionScore(x, y);
            if (score > 0) {
                candidates.push({ plot, score });
            }
        }
    }
    candidates.sort((a, b) => b.score - a.score);

    for (let i = 0; i < candidates.length; i++) {
        if (!isPlotTooCloseToUsed(candidates[i].plot, usedPlots, iWidth, minDistance)) {
            return candidates[i].plot;
        }
    }

    if (candidates.length > 0) return candidates[0].plot;
    return -1;
}

/**
 * Finds the best available start plot, optionally restricted to a specific landmass regionID.
 *
 * @param {number}  defaultPlot      Preferred plot index to try first; pass -1 to skip.
 * @param {Set<number>} usedPlots    Set of already-occupied plot indices.
 * @param {number}  iWidth
 * @param {number}  iHeight
 * @param {number}  minDistance      Minimum hex distance from any used plot.
 * @param {number}  [requiredRegionId=-1]
 *   When >= 0, only candidates whose GameplayMap.getLandmassRegionId() matches this value
 *   are considered. Pass -1 (default) to accept candidates from any region.
 * @returns {number} Plot index, or -1 if none found.
 */
export function findFallbackStartPlot(defaultPlot, usedPlots, iWidth, iHeight, minDistance, requiredRegionId = -1) {
    return chooseFallbackStartPlot(defaultPlot, usedPlots, iWidth, iHeight, minDistance, requiredRegionId);
}

export function findFallbackIslandStartPlot(defaultPlot, usedPlots, iWidth, iHeight, minDistance, preferredRegionId = -1, islandMetadata = null) {
    let metadata = islandMetadata || buildIslandStartMetadata(iWidth, iHeight);

    function getComponentForPlot(plot) {
        let componentId = metadata.plotToComponentId.get(plot);
        return componentId ? metadata.componentsById.get(componentId) : null;
    }

    function isRegionIslandCandidate(x, y, plot) {
        let component = getComponentForPlot(plot);
        return !!component && component.isIsland && component.regionIds.indexOf(preferredRegionId) >= 0;
    }

    if (preferredRegionId >= 0) {
        let preferredIslandPlot = chooseFallbackStartPlot(
            defaultPlot,
            usedPlots,
            iWidth,
            iHeight,
            minDistance,
            preferredRegionId,
            isRegionIslandCandidate
        );
        if (isValidPlot(preferredIslandPlot)) {
            let component = getComponentForPlot(preferredIslandPlot);
            return {
                plot: preferredIslandPlot,
                componentId: component ? component.id : -1,
                regionId: preferredRegionId,
                source: "region-island",
            };
        }
    }

    function isNeutralIslandCandidate(x, y, plot) {
        let component = getComponentForPlot(plot);
        return !!component && component.isIsland && component.regionIds.length === 0;
    }

    let neutralIslandPlot = chooseFallbackStartPlot(
        defaultPlot,
        usedPlots,
        iWidth,
        iHeight,
        minDistance,
        -1,
        isNeutralIslandCandidate
    );
    if (!isValidPlot(neutralIslandPlot)) {
        return {
            plot: -1,
            componentId: -1,
            regionId: -1,
            source: "none",
        };
    }

    let component = getComponentForPlot(neutralIslandPlot);
    let targetRegionId = resolveClosestMainlandRegionId(component, metadata);
    if (targetRegionId >= 0) {
        retagIslandComponentRegion(component, targetRegionId);
    }

    return {
        plot: neutralIslandPlot,
        componentId: component ? component.id : -1,
        regionId: targetRegionId,
        source: "retagged-island",
    };
}

