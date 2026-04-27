import { assignAdvancedStartRegions } from '/base-standard/maps/assign-advanced-start-region.js';
import { PlayerRegion, assignStartPositionsFromTiles } from '/base-standard/maps/assign-starting-plots.js';
import { generateDiscoveries } from '/base-standard/maps/discovery-generator.js';
import { generateLakes, addHills, buildRainfallMap } from '/base-standard/maps/elevation-terrain-generator.js';
import { designateBiomes, addFeatures } from '/base-standard/maps/feature-biome-generator.js';
import { dumpContinents, dumpTerrain, dumpElevation, dumpRainfall, dumpBiomes, dumpFeatures, dumpResources } from '/base-standard/maps/map-debug-helpers.js';
import { g_PolarWaterRows, g_FlatTerrain, g_MountainTerrain, g_HillTerrain, g_VolcanoFeature, g_OceanTerrain, g_CoastTerrain, g_NavigableRiverTerrain } from '/base-standard/maps/map-globals.js';
import { addNaturalWonders } from '/base-standard/maps/natural-wonder-generator.js';
import { generateResources } from '/base-standard/maps/resource-generator.js';
import { generateSnow, dumpPermanentSnow } from '/base-standard/maps/snow-generator.js';
import { kdTree, TerrainType } from '/base-standard/scripts/kd-tree.js';
import { VoronoiContinents } from '/base-standard/scripts/voronoi_maps/continents.js';
import { RuleAvoidEdge } from '/base-standard/scripts/voronoi_rules/avoid-edge.js';
import '/base-standard/maps/map-utilities.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/voronoi.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/rbtree.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/vertex.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/edge.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/cell.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/diagram.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/halfedge.js';
import '/core/scripts/MathHelpers.js';
import '/base-standard/scripts/random-pcg-32.js';
import '/base-standard/scripts/voronoi_generators/map-generator.js';
import '/base-standard/scripts/voronoi_maps/map-common.js';
import '/base-standard/scripts/voronoi-builder.js';
import '/base-standard/scripts/voronoi-hex.js';
import '/base-standard/scripts/heap.js';
import '/base-standard/scripts/voronoi_generators/continent-generator.js';
import '/base-standard/scripts/quadtree.js';
import '/base-standard/scripts/voronoi_rules/near-other-region.js';
import '/core/scripts/external/TypeScript-Voronoi-master/src/site.js';
import '/base-standard/scripts/voronoi_rules/rules-base.js';
import '/base-standard/scripts/voronoi-region.js';
import '/base-standard/scripts/voronoi_rules/avoid-other-regions.js';
import '/base-standard/scripts/voronoi_rules/cell-area.js';
import '/base-standard/scripts/voronoi_rules/near-map-center.js';
import '/base-standard/scripts/voronoi_rules/near-neighbor.js';
import '/base-standard/scripts/voronoi_rules/near-plate-boundary.js';
import '/base-standard/scripts/voronoi_rules/near-region-seed.js';
import '/base-standard/scripts/voronoi_rules/neighbors-in-region.js';
import '/base-standard/scripts/voronoi_rules/prefer-latitude.js';

console.log("Generating using script Terra-YnAMP.ts");
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
async function generateMap() {
  console.log("Generating a map!");
  console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
  console.log("DEBUG: getting grid dimensions");
  const iWidth = GameplayMap.getGridWidth();
  const iHeight = GameplayMap.getGridHeight();
  const uiMapSize = GameplayMap.getMapSize();
  console.log(`DEBUG: grid=${iWidth}x${iHeight}, mapSize=${uiMapSize}`);
  const mapInfo = GameInfo.Maps.lookup(uiMapSize);
  if (mapInfo == null) {
    console.log(`ABORT: mapInfo null for mapSize ${uiMapSize}`);
    return;
  }
  const iNumNaturalWonders = mapInfo.NumNaturalWonders;
  const iTilesPerLake = mapInfo.LakeGenerationFrequency;
  const iTotalPlayers = Players.getAliveMajorIds().length;
  console.log(`DEBUG: players=${iTotalPlayers}, NWs=${iNumNaturalWonders}, lake freq=${iTilesPerLake}`);
  const startTime = Date.now();

  // Terra-YnAMP: VoronoiContinents provides the 2-landmass voronoi setup with a working init().
  // UnifiedContinentsBase has no init() — calling it would throw TypeError and crash silently.
  const voronoiMap = new VoronoiContinents();
  console.log("DEBUG: voronoiMap created");
  console.log(`DEBUG: calling voronoiMap.init(${mapInfo.$index})`);
  voronoiMap.init(mapInfo.$index);
  console.log("DEBUG: voronoiMap.init() complete");
  const oceanSeparationRaw = Configuration.getMapValue("TerraOceanSeparation");
  const seaLevelRaw = Configuration.getMapValue("TerraSeaLevel");
  const oceanSeparationMode = oceanSeparationRaw === "STANDARD" ? "STANDARD" : "WIDE";
  const seaLevelMode = seaLevelRaw === "STANDARD" || seaLevelRaw === "PLUS_25" ? seaLevelRaw : "PLUS_35";
  let landSeaRatio = 1;
  if (seaLevelMode === "PLUS_25") {
    landSeaRatio = 0.75;
  } else if (seaLevelMode === "PLUS_35") {
    landSeaRatio = 0.65;
  }
  console.log(`DEBUG: oceanSeparation=${oceanSeparationMode} (raw: "${oceanSeparationRaw}"), seaLevel=${seaLevelMode} (raw: "${seaLevelRaw}")`);
  const rules = voronoiMap.getGenerator().getRules();
  // Use Object.entries to get [categoryName, ruleArray]
  for (const [category, ruleList] of Object.entries(rules)) {
    for (const rule of ruleList) {
      if (rule.name == RuleAvoidEdge.getName()) {
        rule.configValues.poleDistance = g_PolarWaterRows;
        // --- Target only the "Islands" category ---
        if (category === "Islands") {
          rule.configValues.isActive = false; // Disable
          rule.configValues.meridianEnabled = 0; // Disable
          //rule.configValues.meridianDistance = 2; // 2
          //rule.configValues.meridianDistanceFalloff = 5; // 5
        }
        // --- Target only the "Landmasses" category ---
        if (category === "Landmasses") {
          //rule.configValues.meridianEnabled = 0; // Disable
          rule.configValues.meridianDistance = 2; // 2
          rule.configValues.meridianDistanceFalloff = 15; // 5
          // --- Testing pole distance ---
          rule.configValues.poleDistance = 2; // 2
          rule.configValues.poleDistanceFalloff = 18; // 6
        }
      }
      if (rule.name == "Avoid Other Regions") {
        // --- Target only the "Landmasses" category ---
        if (category === "Landmasses") {
          if (oceanSeparationMode === "WIDE") {
            rule.configValues.minDistance = 8; // 5
            rule.configValues.distanceFalloff = 15; // 10
          }
        }
      }
      // --- Testing positions ---
      if (rule.name == "Near Map Center") {
        if (category === "Islands") {
          rule.configValues.scaleFactor = 0; // 50
        }
        if (category === "Landmasses") {
          rule.configValues.weight = 0.02; // 0.05
          //rule.configValues.scaleFactor = 12; // 50
        }
      }
    }
  }
  const generatorSettings = voronoiMap.getGenerator().getSettings();
  console.log(`DEBUG: landmass count after init: ${generatorSettings.landmass.length}`);

  // Read per-map options: landmass ratio and spawn distribution.
  // Read per-map options: landmass ratio (integer percentage string) and spawn distribution ("0"/"1").
  // Hash="0" parameters return their raw Value string — no hashing or BigInt needed.
  const ratioRaw = Configuration.getMapValue("TerraLandmassRatio");
  const spawnRaw = Configuration.getMapValue("TerraSpawnMode");
  const sizeRatio = ratioRaw != null ? parseInt(ratioRaw) / 100 : 1 / 3;
  const bSameLandmass = spawnRaw == "1";
  console.log(`DEBUG: sizeRatio=${sizeRatio.toFixed(4)} (raw: "${ratioRaw}"%); sameLandmass=${bSameLandmass} (raw: "${spawnRaw}")`);

  // Apply landmass ratio and Sea Level option.
  const totalSize = (generatorSettings.landmass[0].size + generatorSettings.landmass[1].size) * landSeaRatio;
  generatorSettings.landmass[0].size = totalSize * sizeRatio;
  generatorSettings.landmass[1].size = totalSize * (1 - sizeRatio);
  console.log(`DEBUG: landmass[0].size=${generatorSettings.landmass[0].size.toFixed(2)}%, landmass[1].size=${generatorSettings.landmass[1].size.toFixed(2)}%`);

  // Apply spawn distribution
  const iNumPlayers1 = bSameLandmass ? 0 : Math.round(iTotalPlayers * sizeRatio);
  const iNumPlayers2 = iTotalPlayers - iNumPlayers1;
  generatorSettings.landmass[0].playerAreas = iNumPlayers1;
  generatorSettings.landmass[1].playerAreas = iNumPlayers2;
  console.log(`DEBUG: playerAreas landmass[0]=${iNumPlayers1}, landmass[1]=${iNumPlayers2}`);

  console.log("DEBUG: calling voronoiMap.simulate()");
  voronoiMap.simulate();
  const tiles = voronoiMap.getHexTiles().getTiles();
  console.log(`DEBUG: simulation complete, tile rows=${tiles.length}`);
  const landmassKdTree = new kdTree((tile) => tile.pos);
  landmassKdTree.build(tiles.flatMap((row) => row.filter((tile) => tile.landmassId > 0)));
  for (let y = 0; y < tiles.length; ++y) {
    for (let x = 0; x < tiles[y].length; ++x) {
      const tile = tiles[y][x];
      if (tile.isLand()) {
        const type = tile.terrainType === TerrainType.Flat ? g_FlatTerrain : tile.terrainType === TerrainType.Mountainous || tile.terrainType === TerrainType.Volcano ? g_MountainTerrain : tile.terrainType === TerrainType.Rough ? g_HillTerrain : g_FlatTerrain;
        TerrainBuilder.setTerrainType(x, y, type);
        if (tile.terrainType === TerrainType.Volcano) {
          TerrainBuilder.setFeatureType(x, y, {
            Feature: g_VolcanoFeature,
            Direction: -1,
            Elevation: 0
          });
        }
        if (tile.landmassId === 1) {
          TerrainBuilder.setLandmassRegionId(x, y, LandmassRegion.LANDMASS_REGION_WEST);
        } else if (tile.landmassId === 2) {
          TerrainBuilder.setLandmassRegionId(x, y, LandmassRegion.LANDMASS_REGION_EAST);
        } else {
          TerrainBuilder.addPlotTag(x, y, PlotTags.PLOT_TAG_ISLAND);
        }
      } else if (tile.isWater()) {
        const type = tile.terrainType === TerrainType.Ocean ? g_OceanTerrain : g_CoastTerrain;
        TerrainBuilder.setTerrainType(x, y, type);
        if (tile.terrainType === TerrainType.Coast) {
          const landmassTile = landmassKdTree.search(tile.pos);
          const landmassId = landmassTile?.data.landmassId ?? -1;
          if (landmassId === 1) {
            TerrainBuilder.setLandmassRegionId(x, y, LandmassRegion.LANDMASS_REGION_WEST);
          } else if (landmassId === 2) {
            TerrainBuilder.setLandmassRegionId(x, y, LandmassRegion.LANDMASS_REGION_EAST);
          } else {
            TerrainBuilder.addPlotTag(x, y, PlotTags.PLOT_TAG_ISLAND);
          }
        }
      }
    }
  }
  const endTime = Date.now();
  console.log(`Initial Voronoi map generation took ${endTime - startTime} ms`);
  console.log(`Landmass 0 size: ${generatorSettings.landmass[0].size.toFixed(2)}%`);
  console.log(`Landmass 1 size: ${generatorSettings.landmass[1].size.toFixed(2)}%`);
  console.log(`Expected ratio: ${(generatorSettings.landmass[0].size / generatorSettings.landmass[1].size).toFixed(3)} (target: 0.5)`);
  console.log("STEP: validateAndFixTerrain (post-voronoi)");
  TerrainBuilder.validateAndFixTerrain();
  console.log("STEP: recalculateAreas (post-voronoi)");
  AreaBuilder.recalculateAreas();
  console.log("STEP: stampContinents");
  TerrainBuilder.stampContinents();
  console.log("DEBUG: stampContinents complete");

  // Verify actual tile counts per hemisphere after stampContinents
  let westCount = 0;
  let eastCount = 0;
  for (let y = 0; y < iHeight; ++y) {
    for (let x = 0; x < iWidth; ++x) {
      const regId = GameplayMap.getLandmassRegionId(x, y);
      if (regId === LandmassRegion.LANDMASS_REGION_WEST) {
        westCount++;
      } else if (regId === LandmassRegion.LANDMASS_REGION_EAST) {
        eastCount++;
      }
    }
  }
  console.log(`Landmass WEST tile count: ${westCount}`);
  console.log(`Landmass EAST tile count: ${eastCount}`);
  if (eastCount > 0) {
    console.log(`Ratio (WEST/EAST): ${(westCount / eastCount).toFixed(3)}`);
  }
  console.log(`Expected ratio (1/3 : 2/3): ${((1 / 3) / (2 / 3)).toFixed(3)}`);

  console.log("STEP: generateLakes");
  generateLakes(iWidth, iHeight, iTilesPerLake);
  AreaBuilder.recalculateAreas();
  console.log("STEP: buildElevation");
  TerrainBuilder.buildElevation();
  console.log("STEP: addHills");
  addHills(iWidth, iHeight);
  console.log("STEP: buildRainfallMap");
  buildRainfallMap(iWidth, iHeight);
  console.log("STEP: modelRivers");
  TerrainBuilder.modelRivers(5, 15, g_NavigableRiverTerrain);
  TerrainBuilder.validateAndFixTerrain();
  console.log("STEP: defineNamedRivers");
  TerrainBuilder.defineNamedRivers();
  console.log("STEP: designateBiomes");
  designateBiomes(iWidth, iHeight);
  console.log("STEP: addNaturalWonders");
  addNaturalWonders(iWidth, iHeight, iNumNaturalWonders);
  console.log("STEP: addFloodplains");
  TerrainBuilder.addFloodplains(4, 10);
  console.log("STEP: addFeatures");
  addFeatures(iWidth, iHeight);
  TerrainBuilder.validateAndFixTerrain();
  AreaBuilder.recalculateAreas();
  console.log("STEP: storeWaterData");
  TerrainBuilder.storeWaterData();
  console.log("STEP: generateSnow");
  generateSnow(iWidth, iHeight);
  dumpContinents(iWidth, iHeight);
  dumpTerrain(iWidth, iHeight);
  dumpElevation(iWidth, iHeight);
  dumpRainfall(iWidth, iHeight);
  dumpBiomes(iWidth, iHeight);
  dumpFeatures(iWidth, iHeight);
  dumpPermanentSnow(iWidth, iHeight);
  console.log("STEP: generateResources");
  generateResources(iWidth, iHeight);
  let startPositions = [];
  const fertilityGetter = (tile) => StartPositioner.getPlotFertilityForCoord(tile.coord.x, tile.coord.y);
  console.log("STEP: createMajorPlayerAreas");
  voronoiMap.createMajorPlayerAreas(fertilityGetter);
  const playerRegions = Array.from({ length: iTotalPlayers }, () => new PlayerRegion());
  playerRegions.forEach((region, index) => {
    region.regionId = index;
  });
  console.log(`Creating player regions.. initializing indices: ${playerRegions.map((pr) => pr.regionId)}`);
  let offset = 0;
  const offsets = [0].concat([
    ...generatorSettings.landmass.map((n) => {
      offset += n.playerAreas;
      return offset;
    })
  ]);
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.majorPlayerRegionId >= 0 && tile.landmassId > 0) {
        const regionId = tile.majorPlayerRegionId + offsets[tile.landmassId - 1];
        const playerRegion = playerRegions[regionId];
        playerRegion.landmassId = tile.landmassId - 1;
        playerRegion.tiles.push({ x: tile.coord.x, y: tile.coord.y });
      }
    }
  }
  console.log("STEP: assignStartPositionsFromTiles");
  startPositions = assignStartPositionsFromTiles(playerRegions);
  console.log("STEP: generateDiscoveries");
  generateDiscoveries(iWidth, iHeight, startPositions, g_PolarWaterRows);
  dumpResources(iWidth, iHeight);
  console.log("STEP: FertilityBuilder.recalculate");
  FertilityBuilder.recalculate();
  console.log("STEP: assignAdvancedStartRegions");
  assignAdvancedStartRegions();
  console.log("Map generation complete!");
}
engine.on("RequestMapInitData", requestMapData);
engine.on("GenerateMap", generateMap);
