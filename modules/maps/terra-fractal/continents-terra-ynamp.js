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
import { dumpLandmassRegionIds, dumpPlayerLandmassIds } from '/ged-ynamp/maps/ynamp-utilities.js';
import { HexValidationSettings, RemoveBridgingCoastsOptions } from '/base-standard/scripts/voronoi-hex.js';
import { TerrainType } from '/base-standard/scripts/voronoi-types.js';
import { VoronoiFractal } from '/base-standard/scripts/voronoi_maps/fractal.js';

console.log('Generating using script Continents-Terra-YnAMP.ts');

const TERRA_FRACTAL_SETTINGS = Object.freeze({
  totalLandPercent: 39,
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
    erosionPercent: 4
  }
});

const TERRA_FRACTAL_DISTANT_ISLAND_SETTINGS = Object.freeze({
  base: Object.freeze({
    factor: 0.25,
    minSize: 0.25,
    maxSize: 1,
    totalSize: 3,
    variance: 0.2
  }),
  densityMultipliers: Object.freeze({
    RARE: 0.5,
    FEW: 0.75,
    DEFAULT: 1
  }),
  sizeMultipliers: Object.freeze({
    SMALL: Object.freeze({
      minSize: 0.5,
      maxSize: 0.5,
      totalSize: 0.6,
      variance: 0.5
    }),
    DEFAULT: Object.freeze({
      minSize: 1,
      maxSize: 1,
      totalSize: 1,
      variance: 1
    }),
    MIXED: Object.freeze({
      minSize: 0.5,
      maxSize: 1.5,
      totalSize: 1,
      variance: 1.25
    })
  }),
  bounds: Object.freeze({
    factor: Object.freeze([0, 2]),
    minSize: Object.freeze([0, 4]),
    maxSize: Object.freeze([0, 4]),
    totalSize: Object.freeze([0, 10]),
    variance: Object.freeze([0, 2])
  })
});

const TERRA_FRACTAL_DEFAULT_LANDMASS_COUNT = 2;
const TERRA_FRACTAL_RANDOM_LANDMASS_COUNTS = Object.freeze([
  { count: 2, weight: 20 },
  { count: 3, weight: 30 },
  { count: 4, weight: 30 },
  { count: 5, weight: 20 }
]);

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

function getDistantWorldShare(ratioRaw) {
  const parsedRatio = ratioRaw != null ? Number.parseInt(ratioRaw, 10) / 100 : 1 / 3;
  return Number.isFinite(parsedRatio) && parsedRatio > 0 && parsedRatio < 1 ? parsedRatio : 1 / 3;
}

function getLandmassScore(entry) {
  return entry.land + entry.coast * 0.6;
}

function getRandomTerraFractalLandmassCount() {
  const roll = TerrainBuilder.getRandomNumber(100, 'Continents Terra Landmass Count');
  let threshold = 0;

  for (const option of TERRA_FRACTAL_RANDOM_LANDMASS_COUNTS) {
    threshold += option.weight;
    if (roll < threshold) {
      return { requested: 'RANDOM', resolved: option.count, roll };
    }
  }

  const fallback = TERRA_FRACTAL_RANDOM_LANDMASS_COUNTS[TERRA_FRACTAL_RANDOM_LANDMASS_COUNTS.length - 1].count;
  return { requested: 'RANDOM', resolved: fallback, roll };
}

function resolveTerraFractalLandmassCount(rawValue) {
  if (rawValue === 'RANDOM') {
    return getRandomTerraFractalLandmassCount();
  }

  const parsedValue = Number.parseInt(rawValue ?? `${TERRA_FRACTAL_DEFAULT_LANDMASS_COUNT}`, 10);
  if (Number.isFinite(parsedValue) && parsedValue >= 2 && parsedValue <= 5) {
    return { requested: `${parsedValue}`, resolved: parsedValue, roll: null };
  }

  return {
    requested: rawValue ?? `${TERRA_FRACTAL_DEFAULT_LANDMASS_COUNT}`,
    resolved: TERRA_FRACTAL_DEFAULT_LANDMASS_COUNT,
    roll: null
  };
}

function clampToRange(value, range) {
  return Math.max(range[0], Math.min(range[1], value));
}

function getTerraDistantIslandDensityOption(rawValue) {
  switch (rawValue) {
    case 'RARE':
    case 'FEW':
    case 'DEFAULT':
      return rawValue;
    default:
      return 'DEFAULT';
  }
}

function getTerraDistantIslandSizeOption(rawValue) {
  switch (rawValue) {
    case 'SMALL':
    case 'DEFAULT':
    case 'MIXED':
      return rawValue;
    default:
      return 'DEFAULT';
  }
}

function resolveTerraFractalDistantIslandSettings(densityRaw, sizeRaw) {
  const densityOption = getTerraDistantIslandDensityOption(densityRaw);
  const sizeOption = getTerraDistantIslandSizeOption(sizeRaw);
  const baseSettings = TERRA_FRACTAL_DISTANT_ISLAND_SETTINGS.base;
  const densityMultiplier = TERRA_FRACTAL_DISTANT_ISLAND_SETTINGS.densityMultipliers[densityOption];
  const sizeMultipliers = TERRA_FRACTAL_DISTANT_ISLAND_SETTINGS.sizeMultipliers[sizeOption];
  const bounds = TERRA_FRACTAL_DISTANT_ISLAND_SETTINGS.bounds;
  const minSize = clampToRange(baseSettings.minSize * sizeMultipliers.minSize, bounds.minSize);
  const maxSize = Math.max(minSize, clampToRange(baseSettings.maxSize * sizeMultipliers.maxSize, bounds.maxSize));

  return {
    densityOption,
    sizeOption,
    factor: clampToRange(baseSettings.factor * densityMultiplier, bounds.factor),
    minSize,
    maxSize,
    totalSize: clampToRange(baseSettings.totalSize * sizeMultipliers.totalSize, bounds.totalSize),
    variance: clampToRange(baseSettings.variance * sizeMultipliers.variance, bounds.variance)
  };
}

function allocateLandmassPlayers(entries, totalPlayers) {
  const allocations = new Map();
  for (const entry of entries) {
    allocations.set(entry.semanticLandmassId, 0);
  }

  if (totalPlayers <= 0 || entries.length === 0) {
    return allocations;
  }

  const sortedEntries = [...entries].sort((a, b) => getLandmassScore(b) - getLandmassScore(a) || a.semanticLandmassId - b.semanticLandmassId);

  if (totalPlayers < sortedEntries.length) {
    for (let i = 0; i < totalPlayers; ++i) {
      allocations.set(sortedEntries[i].semanticLandmassId, 1);
    }
    return allocations;
  }

  for (const entry of sortedEntries) {
    allocations.set(entry.semanticLandmassId, 1);
  }

  let playersLeft = totalPlayers - sortedEntries.length;
  if (playersLeft <= 0) {
    return allocations;
  }

  const totalScore = sortedEntries.reduce((sum, entry) => sum + getLandmassScore(entry), 0);
  const remainders = [];
  let allocatedExtras = 0;

  for (const entry of sortedEntries) {
    const exactExtra = totalScore > 0 ? playersLeft * (getLandmassScore(entry) / totalScore) : playersLeft / sortedEntries.length;
    const extraPlayers = Math.floor(exactExtra);
    allocations.set(entry.semanticLandmassId, allocations.get(entry.semanticLandmassId) + extraPlayers);
    allocatedExtras += extraPlayers;
    remainders.push({ entry, frac: exactExtra - extraPlayers });
  }

  playersLeft -= allocatedExtras;
  remainders.sort((a, b) => b.frac - a.frac || getLandmassScore(b.entry) - getLandmassScore(a.entry) || a.entry.semanticLandmassId - b.entry.semanticLandmassId);
  for (let i = 0; i < remainders.length && playersLeft > 0; ++i, --playersLeft) {
    const semanticLandmassId = remainders[i].entry.semanticLandmassId;
    allocations.set(semanticLandmassId, allocations.get(semanticLandmassId) + 1);
  }

  return allocations;
}


function applyTerraFractalSettings(voronoiMap, terraOptions) {
  const oceanSettings = terraOptions.oceanSeparationMode === 'WIDE' ? TERRA_FRACTAL_SETTINGS.wideOcean : TERRA_FRACTAL_SETTINGS.standardOcean;
  const totalLandPercent = TERRA_FRACTAL_SETTINGS.totalLandPercent;
  const oldWorldShare = 1 - terraOptions.distantWorldShare;
  const islandSettings = terraOptions.distantIslandSettings;

  voronoiMap.setPrimaryMapSetting(['totalPlayers'], terraOptions.totalPlayers);
  voronoiMap.setPrimaryMapSetting(['voronoiCellCountMultiple'], TERRA_FRACTAL_SETTINGS.voronoiCellCountMultiple);
  voronoiMap.setPrimaryMapSetting(['voronoiRelaxationSteps'], TERRA_FRACTAL_SETTINGS.voronoiRelaxationSteps);
  voronoiMap.setPrimaryMapSetting(['totalLandmassSize'], totalLandPercent * oldWorldShare);
  voronoiMap.setPrimaryMapSetting(['totalDistantSize'], totalLandPercent * terraOptions.distantWorldShare);
  voronoiMap.setPrimaryMapSetting(['minLandmassSeeds'], terraOptions.homelandLandmassCount);
  voronoiMap.setPrimaryMapSetting(['maxLandmassSeeds'], terraOptions.homelandLandmassCount);
  voronoiMap.setPrimaryMapSetting(['minDistantSeeds'], terraOptions.americasLandmassCount);
  voronoiMap.setPrimaryMapSetting(['maxDistantSeeds'], terraOptions.americasLandmassCount);
  voronoiMap.setPrimaryMapSetting(['landmassSeedSizeFactor'], 0);
  voronoiMap.setPrimaryMapSetting(['forceAtLeastTwo'], 0);
  voronoiMap.setPrimaryMapSetting(['forceAtLeastThree'], 0);
  voronoiMap.setPrimaryMapSetting(['minLandmassSpawnCenterDistance'], TERRA_FRACTAL_SETTINGS.minLandmassSpawnCenterDistance);
  voronoiMap.setPrimaryMapSetting(['maxLandmassSpawnCenterDistance'], TERRA_FRACTAL_SETTINGS.maxLandmassSpawnCenterDistance);
  voronoiMap.setPrimaryMapSetting(['minDistantSpawnCenterDistance'], oceanSettings.minDistantSpawnCenterDistance);
  voronoiMap.setPrimaryMapSetting(['maxDistantSpawnCenterDistance'], oceanSettings.maxDistantSpawnCenterDistance);

  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'erosionPercent'], TERRA_FRACTAL_SETTINGS.landmass.erosionPercent);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'erosionTime'], TERRA_FRACTAL_SETTINGS.landmass.erosionTime);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'erosionRandomness'], TERRA_FRACTAL_SETTINGS.landmass.erosionRandomness);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslands'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslands);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsMinDistance'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsMinDistance);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsMaxDistance'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsMaxDistance);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsSize'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsSize);
  voronoiMap.setPrimaryGeneratorSetting(['landmass', 0, 'coastalIslandsSizeVariance'], TERRA_FRACTAL_SETTINGS.landmass.coastalIslandsSizeVariance);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'factor'], islandSettings.factor);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'minSize'], islandSettings.minSize);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'maxSize'], islandSettings.maxSize);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'totalSize'], islandSettings.totalSize);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'variance'], islandSettings.variance);
  voronoiMap.setPrimaryGeneratorSetting(['island', 'erosionPercent'], TERRA_FRACTAL_SETTINGS.island.erosionPercent);
}

function getExportRegionIdFromMetadata(metadata, rawPlayerLandmassId) {
  const semanticLandmassId = metadata.semanticLandmassIdByRaw.get(rawPlayerLandmassId);
  return Number.isInteger(semanticLandmassId) && semanticLandmassId >= 0
    ? semanticLandmassId + 1
    : LandmassRegion.LANDMASS_REGION_DEFAULT;
}

function collectPlayerBearingDistantWorldTiles(voronoiMap, tiles) {
  const seedTiles = [];
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.playerLandmassId === 0 && tile.majorPlayerRegionId >= 0 && tile.terrainType !== TerrainType.Ocean) {
        seedTiles.push(tile);
      }
    }
  }

  if (seedTiles.length === 0) {
    return new Set();
  }

  const distantWorldTiles = new Set();
  const considerationList = [...seedTiles];
  const hexTiles = voronoiMap.getHexTiles();

  while (considerationList.length > 0) {
    const tile = considerationList.pop();
    if (!tile || distantWorldTiles.has(tile) || tile.playerLandmassId !== 0 || tile.terrainType === TerrainType.Ocean) {
      continue;
    }

    distantWorldTiles.add(tile);
    for (const neighbor of hexTiles.getNeighbors(tile)) {
      if (!neighbor || distantWorldTiles.has(neighbor) || neighbor.playerLandmassId !== 0 || neighbor.terrainType === TerrainType.Ocean) {
        continue;
      }
      considerationList.push(neighbor);
    }
  }

  return distantWorldTiles;
}

function getExportRegionIdForTile(tile, metadata, distantWorldTiles) {
  if (!tile || tile.terrainType === TerrainType.Ocean || tile.playerLandmassId < 0) {
    return LandmassRegion.LANDMASS_REGION_DEFAULT;
  }

  if (tile.playerLandmassId === 0 && !distantWorldTiles.has(tile)) {
    return LandmassRegion.LANDMASS_REGION_DEFAULT;
  }

  return getExportRegionIdFromMetadata(metadata, tile.playerLandmassId);
}

function stampTerraFractalLandmassRegions(voronoiMap, tiles) {
  const metadata = voronoiMap.getLandmassMetadata();
  const distantWorldTiles = collectPlayerBearingDistantWorldTiles(voronoiMap, tiles);

  for (let y = 0; y < tiles.length; ++y) {
    for (let x = 0; x < tiles[y].length; ++x) {
      const tile = tiles[y][x];
      const exportRegionId = getExportRegionIdForTile(tile, metadata, distantWorldTiles);
      TerrainBuilder.setLandmassRegionId(x, y, exportRegionId);
    }
  }

  const homelandExportLog = metadata.homelandEntries
    .map((entry) => `${entry.rawPlayerLandmassId}->${getExportRegionIdFromMetadata(metadata, entry.rawPlayerLandmassId)}`)
    .join(',');
  console.log(`DEBUG: Continents Terra exported regions homeland=[${homelandExportLog}] distant=${getExportRegionIdFromMetadata(metadata, 0)} distantTiles=${distantWorldTiles.size}`);

  return { metadata, distantWorldTiles };
}

class TerraFractalVoronoi extends VoronoiFractal {
  constructor(terraOptions) {
    super();
    this.terraOptions = terraOptions;
    this.landmassMetadata = null;
  }

  simulateInternal() {
    const settings = this.getSettings();
    settings.distantSeedsBalancedMode = 0;
    settings.landmassCount = this.terraOptions.homelandLandmassCount;
    settings.distantCount = this.terraOptions.americasLandmassCount;
    settings.enforceGroupConstraints = 1;
    settings.landmassGroupCount = Math.min(this.terraOptions.homelandLandmassCount, settings.landmassCount);
    this.landmassMetadata = null;

    const hexValidationSettings = new HexValidationSettings();
    hexValidationSettings.removeBridgingLandmass = false;
    hexValidationSettings.removeBridgingCoasts = RemoveBridgingCoastsOptions.DIFFERENT_TYPES | RemoveBridgingCoastsOptions.DIFFERENT_LANDMASS_GROUPS;
    hexValidationSettings.polarMargin = 1;
    this.getHexTiles().setValidationSettings(hexValidationSettings);
    this.applySettings();
  }

  getLandmassMetadata() {
    if (this.landmassMetadata != null) {
      return this.landmassMetadata;
    }

    const rawEntries = new Map();
    for (const tile of this.getHexTiles().getTiles().flat()) {
      if (tile.playerLandmassId < 0) {
        continue;
      }

      const isCoast = tile.terrainType === TerrainType.Coast;
      if (!tile.isLand() && !isCoast) {
        continue;
      }

      let entry = rawEntries.get(tile.playerLandmassId);
      if (entry == null) {
        entry = {
          rawPlayerLandmassId: tile.playerLandmassId,
          land: 0,
          coast: 0,
          totalWeight: 0,
          xWeighted: 0,
          yWeighted: 0,
          centerX: 0,
          centerY: 0,
          semanticLandmassId: -1
        };
        rawEntries.set(tile.playerLandmassId, entry);
      }

      const weight = tile.isLand() ? 1 : 0.6;
      if (tile.isLand()) {
        entry.land++;
      } else {
        entry.coast++;
      }
      entry.totalWeight += weight;
      entry.xWeighted += tile.coord.x * weight;
      entry.yWeighted += tile.coord.y * weight;
    }

    const finalizeEntry = (entry, fallbackX, fallbackY) => ({
      ...entry,
      centerX: entry.totalWeight > 0 ? entry.xWeighted / entry.totalWeight : fallbackX,
      centerY: entry.totalWeight > 0 ? entry.yWeighted / entry.totalWeight : fallbackY
    });

    const homelandEntries = Array.from(rawEntries.values())
      .filter((entry) => entry.rawPlayerLandmassId > 0)
      .map((entry) => finalizeEntry(entry, this.m_hexDims.x * 0.5, this.m_hexDims.y * 0.5))
      .sort((a, b) => a.centerX - b.centerX || a.centerY - b.centerY || a.rawPlayerLandmassId - b.rawPlayerLandmassId);

    homelandEntries.forEach((entry, index) => {
      entry.semanticLandmassId = index;
    });

    const americasEntry = finalizeEntry(
      rawEntries.get(0) ?? {
        rawPlayerLandmassId: 0,
        land: 0,
        coast: 0,
        totalWeight: 0,
        xWeighted: 0,
        yWeighted: 0,
        centerX: 0,
        centerY: 0,
        semanticLandmassId: -1
      },
      this.m_hexDims.x - 1,
      this.m_hexDims.y * 0.5
    );
    americasEntry.semanticLandmassId = homelandEntries.length;

    const semanticLandmassIdByRaw = new Map();
    for (const entry of homelandEntries) {
      semanticLandmassIdByRaw.set(entry.rawPlayerLandmassId, entry.semanticLandmassId);
    }
    semanticLandmassIdByRaw.set(0, americasEntry.semanticLandmassId);

    this.landmassMetadata = {
      homelandEntries,
      americasEntry,
      homelandSemanticIds: homelandEntries.map((entry) => entry.semanticLandmassId),
      americasSemanticLandmassId: americasEntry.semanticLandmassId,
      semanticLandmassIdByRaw
    };
    return this.landmassMetadata;
  }

  createMajorPlayerAreas(valueFunction) {
    const metadata = this.getLandmassMetadata();
    const homelandEntries = metadata.homelandEntries.filter((entry) => getLandmassScore(entry) > 0);
    const oldWorldScore = homelandEntries.reduce((sum, entry) => sum + getLandmassScore(entry), 0);
    const distantWorldScore = getLandmassScore(metadata.americasEntry);
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
    const homelandPlayerAllocations = allocateLandmassPlayers(homelandEntries, oldWorldPlayers);
    const playerAreas = [];

    for (const entry of homelandEntries) {
      const playerAreaCount = homelandPlayerAllocations.get(entry.semanticLandmassId) ?? 0;
      if (playerAreaCount <= 0) {
        continue;
      }

      playerAreas.push({
        id: entry.rawPlayerLandmassId,
        playerAreas: playerAreaCount,
        filter: (tile) => tile.playerLandmassId === entry.rawPlayerLandmassId
      });
    }
    if (distantWorldPlayers > 0) {
      playerAreas.push({
        id: 0,
        playerAreas: distantWorldPlayers,
        filter: (tile) => tile.playerLandmassId === 0
      });
    }

    const homelandAllocationLog = homelandEntries
      .map((entry) => `bucket=${entry.semanticLandmassId} raw=${entry.rawPlayerLandmassId} score=${getLandmassScore(entry).toFixed(1)} players=${homelandPlayerAllocations.get(entry.semanticLandmassId) ?? 0}`)
      .join(' | ');
    console.log(`DEBUG: Continents Terra player areas oldWorld=${oldWorldPlayers} distantWorld=${distantWorldPlayers} oldScore=${oldWorldScore.toFixed(1)} distantScore=${distantWorldScore.toFixed(1)} homeland=[${homelandAllocationLog}]`);
    this.getHexTiles().createMajorPlayerAreas(playerAreas, valueFunction, {
      wrap: this.getWrapType(),
      width: this.m_hexDims.x,
      height: this.m_hexDims.y
    });
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
  const distantIslandDensityRaw = Configuration.getMapValue('TerraDistantIslandsDensity');
  const distantIslandSizeRaw = Configuration.getMapValue('TerraDistantIslandsSize');
  const landmassCountRaw = Configuration.getMapValue('TerraFractalLandmasses');
  const oceanSeparationMode = oceanSeparationRaw === 'STANDARD' ? 'STANDARD' : 'WIDE';
  const distantWorldShare = getDistantWorldShare(ratioRaw);
  const sameLandmass = spawnRaw === '1';
  const distantIslandSettings = resolveTerraFractalDistantIslandSettings(distantIslandDensityRaw, distantIslandSizeRaw);
  const resolvedLandmassCount = resolveTerraFractalLandmassCount(landmassCountRaw);
  const startTime = Date.now();

  console.log(`DEBUG: Continents Terra oceanSeparation=${oceanSeparationMode} seaLevel=${seaLevelType} distantWorldShare=${distantWorldShare.toFixed(4)} sameLandmass=${sameLandmass} requestedLandmasses=${resolvedLandmassCount.requested} resolvedLandmasses=${resolvedLandmassCount.resolved}${resolvedLandmassCount.roll == null ? '' : ` roll=${resolvedLandmassCount.roll}`}`);
  console.log(`DEBUG: Continents Terra distant islands density=${distantIslandSettings.densityOption} (raw: '${distantIslandDensityRaw}') size=${distantIslandSettings.sizeOption} (raw: '${distantIslandSizeRaw}') factor=${distantIslandSettings.factor.toFixed(2)} minSize=${distantIslandSettings.minSize.toFixed(2)} maxSize=${distantIslandSettings.maxSize.toFixed(2)} totalSize=${distantIslandSettings.totalSize.toFixed(2)} variance=${distantIslandSettings.variance.toFixed(2)}`);

  const terraOptions = {
    totalPlayers: iTotalPlayers,
    distantWorldShare,
    sameLandmass,
    oceanSeparationMode,
    distantIslandSettings,
    requestedLandmassCount: resolvedLandmassCount.requested,
    resolvedLandmassCount: resolvedLandmassCount.resolved,
    homelandLandmassCount: Math.max(1, resolvedLandmassCount.resolved - 1),
    americasLandmassCount: 1
  };
  const voronoiMap = new TerraFractalVoronoi(terraOptions);
  const seaLevelVariant = getSeaLevelVariantKey(seaLevelType);
  if (seaLevelVariant !== void 0) {
    voronoiMap.setSelectedVariantKey('Sea Level', seaLevelVariant);
  }
  applyTerraFractalSettings(voronoiMap, terraOptions);

  console.log(`DEBUG: calling voronoiMap.init({ x: ${iWidth}, y: ${iHeight} })`);
  voronoiMap.init({ x: iWidth, y: iHeight });
  voronoiMap.simulate();
  const tiles = voronoiMap.getHexTiles().getTiles();
  dumpPlayerLandmassIds(tiles, 'CONTINENTS_TERRA_PLAYER_LANDMASS_IDS');

  for (let y = 0; y < tiles.length; ++y) {
    for (let x = 0; x < tiles[y].length; ++x) {
      const tile = tiles[y][x];
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
  const exportRegionData = stampTerraFractalLandmassRegions(voronoiMap, tiles);
  dumpLandmassRegionIds(iWidth, iHeight, 'CONTINENTS_TERRA_EXPORTED_LANDMASS_REGION_IDS');
  const playerRegions = Array.from({ length: iTotalPlayers }, () => new PlayerRegion());
  playerRegions.forEach((region, index) => {
    region.regionId = index;
  });
  console.log(`Creating player regions.. initializing indices: ${playerRegions.map((pr) => pr.regionId)}`);
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.majorPlayerRegionId < 0) continue;

      const exportRegionId = getExportRegionIdForTile(tile, exportRegionData.metadata, exportRegionData.distantWorldTiles);
      if (!Number.isInteger(exportRegionId) || exportRegionId <= 0) continue;

      const playerRegion = playerRegions[tile.majorPlayerRegionId];
      playerRegion.landmassId = exportRegionId - 1;
      playerRegion.tiles.push({ x: tile.coord.x, y: tile.coord.y });
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