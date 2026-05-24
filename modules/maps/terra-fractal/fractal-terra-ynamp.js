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
import { TerrainType } from '/base-standard/scripts/voronoi-types.js';
import { VoronoiFractal } from '/base-standard/scripts/voronoi_maps/fractal.js';

console.log('Generating using script Fractal-Terra-YnAMP.ts');

const TERRA_FRACTAL_SETTINGS = Object.freeze({
  totalLandPercent: 39,
  oldWorldLandmassSeeds: 4,
  distantWorldSeeds: 3,
  voronoiCellCountMultiple: 1.1,
  voronoiRelaxationSteps: 2,
  minLandmassSpawnCenterDistance: 0.15,
  maxLandmassSpawnCenterDistance: 0.35,
  standardOcean: {
    minDistantSpawnCenterDistance: 0.58,
    maxDistantSpawnCenterDistance: 0.78
  },
  wideOcean: {
    minDistantSpawnCenterDistance: 0.68,
    maxDistantSpawnCenterDistance: 0.88
  },
  landmass: {
    erosionPercent: 7,
    erosionTime: 0.4,
    erosionRandomness: 0.34,
    coastalIslands: 7,
    coastalIslandsMinDistance: 1.35,
    coastalIslandsMaxDistance: 2.15,
    coastalIslandsSize: 0.7,
    coastalIslandsSizeVariance: 0.25
  },
  island: {
    factor: 0.28,
    totalSize: 3.5,
    erosionPercent: 4
  }
});

function requestMapData(initParams) {
  console.log(initParams.width);
  console.log(initParams.height);
  console.log(initParams.topLatitude);
  console.log(initParams.bottomLatitude);
  console.log(initParams.wrapX);
  console.log(initParams.wrapY);
  console.log(initParams.mapSize);
  engine.call('SetMapInitData', initParams);
}

function getSeaLevelVariantKey(seaLevelType) {
  switch (seaLevelType) {
    case 'SEA_LEVEL_LOW':
      return 'Low';
    case 'SEA_LEVEL_HIGH':
      return 'High';
    default:
      return void 0;
  }
}

function getGroupedLandmassId(tile) {
  return tile.playerLandmassId === 0 ? 1 : 0;
}

function getGroupedRegionId(tile) {
  return tile.playerLandmassId === 0 ? LandmassRegion.LANDMASS_REGION_EAST : LandmassRegion.LANDMASS_REGION_WEST;
}

function getDistantWorldShare(ratioRaw) {
  const parsedRatio = ratioRaw != null ? Number.parseInt(ratioRaw, 10) / 100 : 1 / 3;
  return Number.isFinite(parsedRatio) && parsedRatio > 0 && parsedRatio < 1 ? parsedRatio : 1 / 3;
}

function applyTerraFractalSettings(voronoiMap, terraOptions) {
  const oceanSettings = terraOptions.oceanSeparationMode === 'WIDE' ? TERRA_FRACTAL_SETTINGS.wideOcean : TERRA_FRACTAL_SETTINGS.standardOcean;
  const totalLandPercent = TERRA_FRACTAL_SETTINGS.totalLandPercent;
  const oldWorldShare = 1 - terraOptions.distantWorldShare;

  voronoiMap.setPrimaryMapSetting(['totalPlayers'], terraOptions.totalPlayers);
  voronoiMap.setPrimaryMapSetting(['voronoiCellCountMultiple'], TERRA_FRACTAL_SETTINGS.voronoiCellCountMultiple); // Base default is 1.
  voronoiMap.setPrimaryMapSetting(['voronoiRelaxationSteps'], TERRA_FRACTAL_SETTINGS.voronoiRelaxationSteps); // Base default is 3.
  voronoiMap.setPrimaryMapSetting(['totalLandmassSize'], totalLandPercent * oldWorldShare); // Old-world group area.
  voronoiMap.setPrimaryMapSetting(['totalDistantSize'], totalLandPercent * terraOptions.distantWorldShare); // Distant-world area.
  voronoiMap.setPrimaryMapSetting(['minLandmassSeeds'], TERRA_FRACTAL_SETTINGS.oldWorldLandmassSeeds);
  voronoiMap.setPrimaryMapSetting(['maxLandmassSeeds'], TERRA_FRACTAL_SETTINGS.oldWorldLandmassSeeds);
  voronoiMap.setPrimaryMapSetting(['minDistantSeeds'], TERRA_FRACTAL_SETTINGS.distantWorldSeeds);
  voronoiMap.setPrimaryMapSetting(['maxDistantSeeds'], TERRA_FRACTAL_SETTINGS.distantWorldSeeds);
  voronoiMap.setPrimaryMapSetting(['landmassSeedSizeFactor'], 0);
  voronoiMap.setPrimaryMapSetting(['forceAtLeastTwo'], 0); // Keep a single old-world group; distant land uses Fractal's separate distant-world path.
  voronoiMap.setPrimaryMapSetting(['forceAtLeastThree'], 0);
  voronoiMap.setPrimaryMapSetting(['minLandmassSpawnCenterDistance'], TERRA_FRACTAL_SETTINGS.minLandmassSpawnCenterDistance);
  voronoiMap.setPrimaryMapSetting(['maxLandmassSpawnCenterDistance'], TERRA_FRACTAL_SETTINGS.maxLandmassSpawnCenterDistance);
  voronoiMap.setPrimaryMapSetting(['minDistantSpawnCenterDistance'], oceanSettings.minDistantSpawnCenterDistance);
  voronoiMap.setPrimaryMapSetting(['maxDistantSpawnCenterDistance'], oceanSettings.maxDistantSpawnCenterDistance);

  // UnifiedContinentsBase rebuilds the landmass array from index 0, so tuning the
  // first element here becomes the template for both the old-world cluster and the
  // distant-world landmasses.
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'erosionPercent'], TERRA_FRACTAL_SETTINGS.landmass.erosionPercent);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'erosionTime'], TERRA_FRACTAL_SETTINGS.landmass.erosionTime);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'erosionRandomness'], TERRA_FRACTAL_SETTINGS.landmass.erosionRandomness);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslands'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslands);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsMinDistance'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsMinDistance);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsMaxDistance'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsMaxDistance);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsSize'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsSize);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsSizeVariance'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsSizeVariance);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'factor'], TERRA_FRACTAL_SETTINGS.island.factor);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'totalSize'], TERRA_FRACTAL_SETTINGS.island.totalSize);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'erosionPercent'], TERRA_FRACTAL_SETTINGS.island.erosionPercent);
}

class TerraFractalVoronoi extends VoronoiFractal {
  constructor(terraOptions) {
    super();
    this.terraOptions = terraOptions;
  }

  createMajorPlayerAreas(valueFunction) {
    const tiles = this.getHexTiles().getTiles().flat();
    const countGroupSpace = (predicate) => {
      let land = 0;
      let coast = 0;

      for (const tile of tiles) {
        if (!predicate(tile)) {
          continue;
        }
        if (tile.isLand()) {
          land++;
        } else if (tile.terrainType === TerrainType.Coast) {
          coast++;
        }
      }

      return land + coast * 0.6;
    };

    const oldWorldScore = countGroupSpace((tile) => tile.playerLandmassId > 0);
    const distantWorldScore = countGroupSpace((tile) => tile.playerLandmassId === 0);
    const totalScore = oldWorldScore + distantWorldScore;
    let distantWorldPlayers = 0;

    if (!this.terraOptions.sameLandmass && distantWorldScore > 0 && totalScore > 0) {
      distantWorldPlayers = Math.round(this.terraOptions.totalPlayers * (distantWorldScore / totalScore));
      if (this.terraOptions.totalPlayers > 1 && distantWorldPlayers === 0) {
        distantWorldPlayers = 1;
      }
      if (distantWorldPlayers >= this.terraOptions.totalPlayers) {
        distantWorldPlayers = this.terraOptions.totalPlayers - 1;
      }
    }

    const oldWorldPlayers = this.terraOptions.totalPlayers - distantWorldPlayers;
    const playerAreas = [];

    if (oldWorldPlayers > 0) {
      playerAreas.push({
        id: 1,
        playerAreas: oldWorldPlayers,
        filter: (tile) => tile.playerLandmassId > 0
      });
    }
    if (distantWorldPlayers > 0) {
      playerAreas.push({
        id: 2,
        playerAreas: distantWorldPlayers,
        filter: (tile) => tile.playerLandmassId === 0
      });
    }

    console.log(`DEBUG: Terra Fractal player areas oldWorld=${oldWorldPlayers} distantWorld=${distantWorldPlayers} oldScore=${oldWorldScore.toFixed(1)} distantScore=${distantWorldScore.toFixed(1)}`);
    super.createMajorPlayerAreas(valueFunction, playerAreas);
  }
}

async function generateMap() {
  console.log('Generating a map!');
  console.log(`Age - ${GameInfo.Ages.lookup(Game.age).AgeType}`);
  const iWidth = GameplayMap.getGridWidth();
  const iHeight = GameplayMap.getGridHeight();
  const uiMapSize = GameplayMap.getMapSize();
  const mapInfo = GameInfo.Maps.lookup(uiMapSize);
  if (mapInfo == null) {
    console.log(`ABORT: mapInfo null for mapSize ${uiMapSize}`);
    return;
  }
  const iNumNaturalWonders = mapInfo.NumNaturalWonders;
  const iTilesPerLake = mapInfo.LakeGenerationFrequency;
  const iTotalPlayers = Players.getAliveMajorIds().length;
  const oceanSeparationRaw = Configuration.getMapValue('TerraOceanSeparation');
  const seaLevelType = Configuration.getMapValue('SeaLevel');
  const ratioRaw = Configuration.getMapValue('TerraLandmassRatio');
  const spawnRaw = Configuration.getMapValue('TerraSpawnMode');
  const oceanSeparationMode = oceanSeparationRaw === 'STANDARD' ? 'STANDARD' : 'WIDE';
  const distantWorldShare = getDistantWorldShare(ratioRaw);
  const sameLandmass = spawnRaw === '1';
  const startTime = Date.now();

  console.log(`DEBUG: Terra Fractal oceanSeparation=${oceanSeparationMode} seaLevel=${seaLevelType} distantWorldShare=${distantWorldShare.toFixed(4)} sameLandmass=${sameLandmass}`);

  const voronoiMap = new TerraFractalVoronoi({
    totalPlayers: iTotalPlayers,
    distantWorldShare,
    sameLandmass,
    oceanSeparationMode
  });
  const seaLevelVariant = getSeaLevelVariantKey(seaLevelType);
  if (seaLevelVariant !== void 0) {
    voronoiMap.setSelectedVariantKey('Sea Level', seaLevelVariant);
  }
  applyTerraFractalSettings(voronoiMap, {
    totalPlayers: iTotalPlayers,
    distantWorldShare,
    sameLandmass,
    oceanSeparationMode
  });

  console.log(`DEBUG: calling voronoiMap.init({ x: ${iWidth}, y: ${iHeight} })`);
  voronoiMap.init({ x: iWidth, y: iHeight });
  voronoiMap.simulate();
  const tiles = voronoiMap.getHexTiles().getTiles();

  for (let y = 0; y < tiles.length; ++y) {
    for (let x = 0; x < tiles[y].length; ++x) {
      const tile = tiles[y][x];
      TerrainBuilder.setLandmassRegionId(x, y, getGroupedRegionId(tile));

      const type = tile.terrainType === TerrainType.Flat ? g_FlatTerrain : tile.terrainType === TerrainType.Mountainous || tile.terrainType === TerrainType.Volcano ? g_MountainTerrain : tile.terrainType === TerrainType.Rough ? g_HillTerrain : tile.terrainType === TerrainType.Ocean ? g_OceanTerrain : g_CoastTerrain;
      TerrainBuilder.setTerrainType(x, y, type);
      if (tile.terrainType === TerrainType.Volcano) {
        TerrainBuilder.setFeatureType(x, y, {
          Feature: g_VolcanoFeature,
          Direction: -1,
          Elevation: 0
        });
      }
    }
  }

  const endTime = Date.now();
  console.log(`Initial Voronoi map generation took ${endTime - startTime} ms`);
  TerrainBuilder.validateAndFixTerrain();
  AreaBuilder.recalculateAreas();
  TerrainBuilder.stampContinents();
  generateLakes(iWidth, iHeight, iTilesPerLake);
  AreaBuilder.recalculateAreas();
  TerrainBuilder.buildElevation();
  addHills(iWidth, iHeight);
  buildRainfallMap(iWidth, iHeight);
  TerrainBuilder.modelRivers(5, 15, g_NavigableRiverTerrain);
  TerrainBuilder.validateAndFixTerrain();
  TerrainBuilder.defineNamedRivers();
  designateBiomes(iWidth, iHeight);
  addNaturalWonders(iWidth, iHeight, iNumNaturalWonders);
  TerrainBuilder.addFloodplains(4, 10);
  addFeatures(iWidth, iHeight);
  TerrainBuilder.validateAndFixTerrain();
  AreaBuilder.recalculateAreas();
  TerrainBuilder.storeWaterData();
  generateSnow(iWidth, iHeight);
  dumpContinents(iWidth, iHeight);
  dumpTerrain(iWidth, iHeight);
  dumpElevation(iWidth, iHeight);
  dumpRainfall(iWidth, iHeight);
  dumpBiomes(iWidth, iHeight);
  dumpFeatures(iWidth, iHeight);
  dumpPermanentSnow(iWidth, iHeight);
  generateResources(iWidth, iHeight);
  let startPositions = [];
  const fertilityGetter = (tile) => StartPositioner.getPlotFertilityForCoord(tile.coord.x, tile.coord.y);
  console.log('STEP: createMajorPlayerAreas');
  voronoiMap.createMajorPlayerAreas(fertilityGetter);
  const playerRegions = Array.from({ length: iTotalPlayers }, () => new PlayerRegion());
  playerRegions.forEach((region, index) => {
    region.regionId = index;
  });
  console.log(`Creating player regions.. initializing indices: ${playerRegions.map((pr) => pr.regionId)}`);
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.majorPlayerRegionId >= 0 && tile.landmassId > 0) {
        const playerRegion = playerRegions[tile.majorPlayerRegionId];
        playerRegion.landmassId = getGroupedLandmassId(tile);
        playerRegion.tiles.push({ x: tile.coord.x, y: tile.coord.y });
      }
    }
  }
  console.log('STEP: assignStartPositionsFromTiles');
  startPositions = assignStartPositionsFromTiles(playerRegions);
  console.log('STEP: generateDiscoveries');
  generateDiscoveries(iWidth, iHeight, startPositions, g_PolarWaterRows);
  dumpResources(iWidth, iHeight);
  FertilityBuilder.recalculate();
  assignAdvancedStartRegions();
  console.log('Map generation complete!');
}

engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);