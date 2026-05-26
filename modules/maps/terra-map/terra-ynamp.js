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
import { kdTree } from '/base-standard/scripts/kd-tree.js';
import { TerrainType } from '/base-standard/scripts/voronoi-types.js';
import { VoronoiContinents } from '/base-standard/scripts/voronoi_maps/continents.js';

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

function getSeaLevelVariantKey(seaLevelType) {
  switch (seaLevelType) {
    case "SEA_LEVEL_LOW":
      return "Low";
    case "SEA_LEVEL_HIGH":
      return "High";
    default:
      return void 0;
  }
}

const TERRA_IRREGULARITY_SETTINGS = Object.freeze({

  // A small cell-count increase plus one fewer Lloyd relaxation pass keeps the
  // two-world layout intact while making coastlines less uniformly convex.
  // Base Continents default is 1.0. Higher values create more cells and finer
  // local detail at the cost of noisier shapes and more work; lower values
  // create broader, smoother coastlines.
  voronoiCellCountMultiple: 1.15,

  // Base Continents default is 3. Higher values regularize the cell layout and
  // round continents back out; lower values preserve more of the raw Voronoi
  // jaggedness and asymmetry.
  voronoiRelaxationSteps: 2,

  // These settings are applied to both major landmasses through supported
  // primary generator setters so the Terra ratio, same-landmass spawn mode,
  // wide-ocean spacing, and Sea Level variant flow stay intact.
  // Terra uses stronger but more directed erosion and slightly tighter
  // coastal-island growth to carve bays, peninsulas, and shelves without
  // changing the underlying two-world split.
  landmass: {
    // Base Continents default is 4. Higher values erode a larger share of the
    // landmass and cut more bays, channels, and thinner peninsulas; lower
    // values preserve bulkier, rounder landmasses.
    erosionPercent: 6.5,

    // Base Continents default is 1.0. Higher values spread erosion out more
    // evenly, producing broader and gentler wear; lower values concentrate the
    // cuts into tighter, punchier coastal bites.
    erosionTime: 0.45,

    // Base Continents default is 0.6. Higher values choose erosion targets
    // more randomly and make the coast rougher in a noisier way; lower values
    // follow the strongest scores more consistently and create cleaner,
    // more directed indentations.
    erosionRandomness: 0.35,

    // Base Continents default is 10. Higher values seed more near-shore
    // fragments and shelves; lower values keep the coast cleaner and simpler.
    coastalIslands: 12,

    // Base Continents default is 2. Higher values push coastal island seeds
    // farther offshore; lower values keep them tucked closer to the mainland,
    // where they more readily read as shelves or attached clutter.
    coastalIslandsMinDistance: 1.75,

    // Base Continents default is 3. Higher values allow farther offshore
    // spawns and a looser halo around each continent; lower values constrain
    // the island band to stay tight to the coast.
    coastalIslandsMaxDistance: 2.25,

    // Base Continents default is 0.85. Higher values dedicate more total land
    // area to coastal islands and shelves; lower values make the fringe lighter.
    coastalIslandsSize: 1.1,

    // Base Continents default is 0.5. Higher values swing island output more
    // from map to map; lower values keep the coastal fringe more consistent.
    coastalIslandsSizeVariance: 0.35
  }
});

const TERRA_RULE_TUNING_SETTINGS = Object.freeze({

  // These are placement and spacing rules layered on top of the generator
  // settings above. The two settings here most likely to alter the outline of
  // the major landmasses are Landmasses/Avoid Edge/meridianDistanceFalloff and
  // Landmasses/Avoid Edge/poleDistanceFalloff, because they directly change how
  // strongly the continents are pushed away from the seam and polar margins
  // before their final footprint settles. The center-bias and island rules
  // mostly affect placement and fringe clutter rather than the core silhouette.
  coastalIslands: {
    avoidEdge: {
      // Base default is 2. Higher values keep coastal islands farther from the
      // poles; lower values let them reach deeper into high latitudes.
      poleDistance: 2
    }
  },

  islands: {
    island: {
      // Base Continents default is 5. Higher values force distant islands into
      // deeper water and favor mid-channel placement; lower values let them form
      // closer to the two main continents.
      landmassDistance: 3
    },

    avoidEdge: {
      // Base default is true. Turning this off lets minor islands ignore edge
      // avoidance entirely; keeping it on preserves the normal map-edge guard.
      isActive: true,

      // Base default is 1. Boolean value; setting it to 0 lets islands spill
      // toward the map seam, while 1 keeps seam avoidance active.
      meridianEnabled: 1
    },

    nearMapCenter: {
      // Base default is true, with this rule weighted at 0.04. 
      // Setting this to false removes the center-placement bias entirely.
      isActive: true,

      // Rule schema default is 50. Lower values tighten the center preference;
      // higher values broaden it across more of the map.
      scaleFactor: 50
    }
  },

  landmasses: {
    avoidEdge: {
      // Base default is 2. Higher values create a harder no-go strip at the
      // east-west seam; lower values let continents sit closer to it.
      meridianDistance: 2,

      // Base default is 6. Higher values extend seam pressure farther inland,
      // which can flatten or pull back continent flanks near the seam; lower
      // values localize the effect and preserve more natural bulges.
      meridianDistanceFalloff: 6,

      // Base default is 2. Higher values keep continents farther from the
      // poles; lower values let them climb into higher latitudes.
      poleDistance: 2,

      // Base default is 6. Higher values taper pole pressure over a broader
      // band and can shave or stretch the north-south profile; lower values
      // confine the effect to the extreme top and bottom.
      poleDistanceFalloff: 6
    },

    nearMapCenter: {
      // Base default is 0.05. Higher values pull the main continents inward;
      // lower values let them sit wider apart and closer to the map edges.
      weight: 0.02
    },

    wideOceanSeparation: {
      // Base default is 4. Higher values enforce a wider hard gap between the
      // two major continents; lower values allow them to approach each other.
      minDistance: 8,

      // Base default is 8. Higher values preserve that separation over a wider
      // band, which can indirectly trim facing coastlines; lower values make
      // the spacing rule fade faster.
      distanceFalloff: 8
    }
  }
});

const TERRA_DISTANT_ISLAND_SETTINGS = Object.freeze({
  base: Object.freeze({
    factor: 0.3,
    minSize: 0.1,
    maxSize: 2,
    totalSize: 4.5,
    variance: 1
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

const TERRA_LAYOUT_PASS_SETTINGS = Object.freeze({
  primary: Object.freeze({
    oldworld: Object.freeze({
      xRange: Object.freeze([0.2, 0.36]),
      yRange: Object.freeze([0.24, 0.76])
    }),
    newworld: Object.freeze({
      xRange: Object.freeze([0.66, 0.84]),
      yRange: Object.freeze([0.22, 0.78])
    }),
    validation: Object.freeze({
      edgeBandWidth: 2,
      maxGapTiles: 1,
      maxEdgeRunRatio: 0.58,
      minEdgeRunLength: 16
    })
  }),
  fallback: Object.freeze({
    oldworld: Object.freeze({
      xRange: Object.freeze([0.24, 0.33]),
      yRange: Object.freeze([0.32, 0.68])
    }),
    newworld: Object.freeze({
      xRange: Object.freeze([0.7, 0.78]),
      yRange: Object.freeze([0.28, 0.72])
    }),
    validation: Object.freeze({
      edgeBandWidth: 2,
      maxGapTiles: 1,
      maxEdgeRunRatio: 0.48,
      minEdgeRunLength: 14
    })
  })
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function fract(value) {
  return value - Math.floor(value);
}

function remapUnitToRange(value, range) {
  return range[0] + (range[1] - range[0]) * clamp01(value);
}

function clampToRange(value, range) {
  return Math.max(range[0], Math.min(range[1], value));
}

function getTerraDistantIslandDensityOption(rawValue) {
  switch (rawValue) {
    case "RARE":
    case "FEW":
    case "DEFAULT":
      return rawValue;
    default:
      return "DEFAULT";
  }
}

function getTerraDistantIslandSizeOption(rawValue) {
  switch (rawValue) {
    case "SMALL":
    case "DEFAULT":
    case "MIXED":
      return rawValue;
    default:
      return "DEFAULT";
  }
}

function resolveTerraDistantIslandSettings(densityRaw, sizeRaw) {
  const densityOption = getTerraDistantIslandDensityOption(densityRaw);
  const sizeOption = getTerraDistantIslandSizeOption(sizeRaw);
  const baseSettings = TERRA_DISTANT_ISLAND_SETTINGS.base;
  const densityMultiplier = TERRA_DISTANT_ISLAND_SETTINGS.densityMultipliers[densityOption];
  const sizeMultipliers = TERRA_DISTANT_ISLAND_SETTINGS.sizeMultipliers[sizeOption];
  const bounds = TERRA_DISTANT_ISLAND_SETTINGS.bounds;
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

function countTruthyEntries(values) {
  let total = 0;
  for (const value of values) {
    if (value) {
      total++;
    }
  }
  return total;
}

function getLongestNearContiguousRun(values, maxGapTiles) {
  let best = 0;
  let occupied = 0;
  let gaps = 0;
  let start = 0;

  for (let end = 0; end < values.length; end++) {
    if (values[end]) {
      occupied++;
    } else {
      gaps++;
    }

    while (gaps > maxGapTiles) {
      if (values[start]) {
        occupied--;
      } else {
        gaps--;
      }
      start++;
    }

    if (occupied > 0) {
      best = Math.max(best, end - start + 1);
    }
  }

  return best;
}

function getTerraLayoutPassSettings(passName) {
  return TERRA_LAYOUT_PASS_SETTINGS[passName] ?? TERRA_LAYOUT_PASS_SETTINGS.primary;
}

function getStampedRegionIdForLandmassId(landmassId) {
  if (landmassId === 1) {
    return LandmassRegion.LANDMASS_REGION_WEST;
  }
  if (landmassId === 2) {
    return LandmassRegion.LANDMASS_REGION_EAST;
  }
  return LandmassRegion.LANDMASS_REGION_NONE;
}

function getTerraSeedEntropy(baseX, baseY, salt) {
  const safeBaseX = clamp01(Number.isFinite(baseX) ? baseX : 0.5);
  const safeBaseY = clamp01(Number.isFinite(baseY) ? baseY : 0.5);
  return fract(safeBaseX * (12.9898 + salt * 0.25) + safeBaseY * (78.233 + salt * 0.5) + salt * 0.61803398875);
}

function getTerraLandmassRoleIndexes(landmasses) {
  const landmassIndexes = landmasses.map((_landmass, index) => index);
  landmassIndexes.sort((leftIndex, rightIndex) => landmasses[leftIndex].size - landmasses[rightIndex].size);
  return {
    newworldLandmassIndex: landmassIndexes[0],
    oldworldLandmassIndex: landmassIndexes[landmassIndexes.length - 1]
  };
}

function getTerraLandmassSeedSummary(generatorSettings) {
  return generatorSettings.landmass.map((landmass, index) => `landmass[${index}] size=${landmass.size.toFixed(2)} x=${landmass.xPos.toFixed(4)} y=${landmass.yPos.toFixed(4)}`).join(" | ");
}

function createTerraLandmassStats(landmassId, iWidth, iHeight) {
  return {
    landmassId,
    landCount: 0,
    minX: iWidth,
    maxX: -1,
    minY: iHeight,
    maxY: -1,
    sumX: 0,
    sumY: 0,
    westRows: new Array(iHeight).fill(false),
    eastRows: new Array(iHeight).fill(false),
    northCols: new Array(iWidth).fill(false),
    southCols: new Array(iWidth).fill(false)
  };
}

function finalizeTerraLandmassEdgeMetrics(stats, validationSettings) {
  const verticalSpan = Math.max(1, stats.maxY - stats.minY + 1);
  const horizontalSpan = Math.max(1, stats.maxX - stats.minX + 1);
  const edges = {
    west: {
      runLength: getLongestNearContiguousRun(stats.westRows, validationSettings.maxGapTiles),
      occupiedCount: countTruthyEntries(stats.westRows),
      span: verticalSpan
    },
    east: {
      runLength: getLongestNearContiguousRun(stats.eastRows, validationSettings.maxGapTiles),
      occupiedCount: countTruthyEntries(stats.eastRows),
      span: verticalSpan
    },
    north: {
      runLength: getLongestNearContiguousRun(stats.northCols, validationSettings.maxGapTiles),
      occupiedCount: countTruthyEntries(stats.northCols),
      span: horizontalSpan
    },
    south: {
      runLength: getLongestNearContiguousRun(stats.southCols, validationSettings.maxGapTiles),
      occupiedCount: countTruthyEntries(stats.southCols),
      span: horizontalSpan
    }
  };

  for (const edge of Object.values(edges)) {
    edge.runRatio = edge.runLength / edge.span;
  }

  const [worstEdgeName, worstEdge] = Object.entries(edges).reduce((bestEntry, currentEntry) => {
    if (bestEntry == null) {
      return currentEntry;
    }
    const [, bestEdge] = bestEntry;
    const [, currentEdge] = currentEntry;
    if (currentEdge.runRatio > bestEdge.runRatio) {
      return currentEntry;
    }
    if (currentEdge.runRatio === bestEdge.runRatio && currentEdge.runLength > bestEdge.runLength) {
      return currentEntry;
    }
    return bestEntry;
  }, null);

  return {
    landmassId: stats.landmassId,
    landCount: stats.landCount,
    minX: stats.minX,
    maxX: stats.maxX,
    minY: stats.minY,
    maxY: stats.maxY,
    centroidX: stats.sumX / stats.landCount,
    centroidY: stats.sumY / stats.landCount,
    edges,
    worstEdgeName,
    worstEdge
  };
}

function analyzeTerraLayout(tiles, iWidth, iHeight, passName) {
  const passSettings = getTerraLayoutPassSettings(passName);
  const validationSettings = passSettings.validation;
  const statsByLandmassId = new Map();

  for (let y = 0; y < tiles.length; y++) {
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      if (tile.landmassId <= 0 || !tile.isLand()) {
        continue;
      }

      let stats = statsByLandmassId.get(tile.landmassId);
      if (stats == null) {
        stats = createTerraLandmassStats(tile.landmassId, iWidth, iHeight);
        statsByLandmassId.set(tile.landmassId, stats);
      }

      stats.landCount++;
      stats.sumX += x;
      stats.sumY += y;
      stats.minX = Math.min(stats.minX, x);
      stats.maxX = Math.max(stats.maxX, x);
      stats.minY = Math.min(stats.minY, y);
      stats.maxY = Math.max(stats.maxY, y);

      if (x < validationSettings.edgeBandWidth) {
        stats.westRows[y] = true;
      }
      if (x >= iWidth - validationSettings.edgeBandWidth) {
        stats.eastRows[y] = true;
      }
      if (y < validationSettings.edgeBandWidth) {
        stats.northCols[x] = true;
      }
      if (y >= iHeight - validationSettings.edgeBandWidth) {
        stats.southCols[x] = true;
      }
    }
  }

  const majorLandmasses = Array.from(statsByLandmassId.values()).map((stats) => finalizeTerraLandmassEdgeMetrics(stats, validationSettings)).sort((left, right) => right.landCount - left.landCount);
  const oldworldLandmass = majorLandmasses[0];
  const rejectionReasons = [];

  if (oldworldLandmass == null) {
    rejectionReasons.push("no major OldWorld landmass found after Voronoi simulation");
  } else {
    const worstEdge = oldworldLandmass.worstEdge;
    if (worstEdge.runLength >= validationSettings.minEdgeRunLength && worstEdge.runRatio >= validationSettings.maxEdgeRunRatio) {
      rejectionReasons.push(`oldworld edge ${oldworldLandmass.worstEdgeName} formed a near-straight run of ${worstEdge.runLength} tiles across ${(worstEdge.runRatio * 100).toFixed(1)}% of its span`);
    }
  }

  return {
    passName,
    isRejected: rejectionReasons.length > 0,
    rejectionReasons,
    validationSettings,
    majorLandmasses,
    oldworldLandmassId: oldworldLandmass?.landmassId ?? -1,
    newworldLandmassId: majorLandmasses[1]?.landmassId ?? -1
  };
}

function dumpRejectedTerraLayout(passResult, terraOptions, seaLevelType, oceanSeparationMode) {
  const { analysis, generatorSettings, passName, tiles } = passResult;
  console.log(`TERRA_LAYOUT_REJECTED pass=${passName} seaLevel=${seaLevelType} ocean=${oceanSeparationMode} sizeRatio=${terraOptions.sizeRatio.toFixed(4)} sameLandmass=${terraOptions.sameLandmass}`);
  for (const rejectionReason of analysis.rejectionReasons) {
    console.log(`TERRA_LAYOUT_REJECTED reason=${rejectionReason}`);
  }
  console.log(`TERRA_LAYOUT_REJECTED seeds ${getTerraLandmassSeedSummary(generatorSettings)}`);

  for (const landmass of analysis.majorLandmasses.slice(0, 2)) {
    const edgeSummary = Object.entries(landmass.edges).map(([edgeName, edge]) => `${edgeName}:${edge.runLength}/${edge.span} (${(edge.runRatio * 100).toFixed(1)}%)`).join(", ");
    console.log(`TERRA_LAYOUT_REJECTED landmass=${landmass.landmassId} land=${landmass.landCount} centroid=(${landmass.centroidX.toFixed(2)}, ${landmass.centroidY.toFixed(2)}) edges=[${edgeSummary}]`);
  }

  console.log(`TERRA_LAYOUT_REJECTED_DUMP_BEGIN pass=${passName}`);
  for (let y = 0; y < tiles.length; y++) {
    let row = "";
    for (let x = 0; x < tiles[y].length; x++) {
      const tile = tiles[y][x];
      if (!tile.isLand()) {
        row += ".";
      } else if (tile.landmassId === analysis.oldworldLandmassId) {
        row += "H";
      } else if (tile.landmassId === analysis.newworldLandmassId) {
        row += "D";
      } else if (tile.landmassId > 0) {
        row += "+";
      } else {
        row += ".";
      }
    }
    console.log(row);
  }
  console.log(`TERRA_LAYOUT_REJECTED_DUMP_END pass=${passName}`);
}

function createConfiguredTerraVoronoiMap(terraOptions, seaLevelType, oceanSeparationMode, iWidth, iHeight) {
  const voronoiMap = new TerraVoronoiContinents(terraOptions);
  console.log(`DEBUG: voronoiMap created for pass ${terraOptions.layoutPassName}`);
  const seaLevelVariant = getSeaLevelVariantKey(seaLevelType);
  if (seaLevelVariant !== void 0) {
    voronoiMap.setSelectedVariantKey("Sea Level", seaLevelVariant);
  }
  voronoiMap.setPrimaryMapSetting(["totalPlayers"], terraOptions.totalPlayers);

  applyTerraIrregularitySettings(voronoiMap);
  applyTerraDistantIslandSettings(voronoiMap, terraOptions.distantIslandSettings);
  applyTerraRuleTuningSettings(voronoiMap);
  applyTerraOceanSeparationSettings(voronoiMap, oceanSeparationMode);

  console.log(`DEBUG: calling voronoiMap.init({ x: ${iWidth}, y: ${iHeight} }) for pass ${terraOptions.layoutPassName}`);
  voronoiMap.init({ x: iWidth, y: iHeight });
  console.log(`DEBUG: voronoiMap.init() complete for pass ${terraOptions.layoutPassName}`);
  return voronoiMap;
}

function simulateTerraVoronoiPass(terraOptions, seaLevelType, oceanSeparationMode, iWidth, iHeight) {
  const voronoiMap = createConfiguredTerraVoronoiMap(terraOptions, seaLevelType, oceanSeparationMode, iWidth, iHeight);
  const generatorSettings = voronoiMap.getGenerator().getSettings();
  console.log(`DEBUG: landmass count after init for pass ${terraOptions.layoutPassName}: ${generatorSettings.landmass.length}`);
  console.log(`DEBUG: calling voronoiMap.simulate() for pass ${terraOptions.layoutPassName}`);
  voronoiMap.simulate();
  const tiles = voronoiMap.getHexTiles().getTiles();
  const analysis = analyzeTerraLayout(tiles, iWidth, iHeight, terraOptions.layoutPassName);
  console.log(`DEBUG: simulation complete for pass ${terraOptions.layoutPassName}, tile rows=${tiles.length}`);
  console.log(`DEBUG: terra layout pass=${terraOptions.layoutPassName} rejected=${analysis.isRejected}`);
  if (analysis.majorLandmasses[0] != null) {
    const worstEdge = analysis.majorLandmasses[0].worstEdge;
    console.log(`DEBUG: terra oldworld edge ${analysis.majorLandmasses[0].worstEdgeName} run=${worstEdge.runLength}/${worstEdge.span} (${(worstEdge.runRatio * 100).toFixed(1)}%)`);
  }
  return {
    passName: terraOptions.layoutPassName,
    voronoiMap,
    generatorSettings,
    tiles,
    analysis
  };
}

function applyTerraIrregularitySettings(voronoiMap) {
  voronoiMap.setPrimaryMapSetting(["voronoiCellCountMultiple"], TERRA_IRREGULARITY_SETTINGS.voronoiCellCountMultiple);
  voronoiMap.setPrimaryMapSetting(["voronoiRelaxationSteps"], TERRA_IRREGULARITY_SETTINGS.voronoiRelaxationSteps);

  for (let landmassIndex = 0; landmassIndex < 2; landmassIndex++) {
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "erosionPercent"], TERRA_IRREGULARITY_SETTINGS.landmass.erosionPercent);
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "erosionTime"], TERRA_IRREGULARITY_SETTINGS.landmass.erosionTime);
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "erosionRandomness"], TERRA_IRREGULARITY_SETTINGS.landmass.erosionRandomness);
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "coastalIslands"], TERRA_IRREGULARITY_SETTINGS.landmass.coastalIslands);
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "coastalIslandsMinDistance"], TERRA_IRREGULARITY_SETTINGS.landmass.coastalIslandsMinDistance);
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "coastalIslandsMaxDistance"], TERRA_IRREGULARITY_SETTINGS.landmass.coastalIslandsMaxDistance);
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "coastalIslandsSize"], TERRA_IRREGULARITY_SETTINGS.landmass.coastalIslandsSize);
    voronoiMap.setPrimaryGeneratorSetting(["landmass", landmassIndex, "coastalIslandsSizeVariance"], TERRA_IRREGULARITY_SETTINGS.landmass.coastalIslandsSizeVariance);
  }
}

function applyTerraRuleTuningSettings(voronoiMap) {
  voronoiMap.setPrimaryRuleSetting(["Coastal Islands", "Avoid Edge", "poleDistance"], TERRA_RULE_TUNING_SETTINGS.coastalIslands.avoidEdge.poleDistance);

  voronoiMap.setPrimaryGeneratorSetting(["island", "landmassDistance"], TERRA_RULE_TUNING_SETTINGS.islands.island.landmassDistance);
  voronoiMap.setPrimaryRuleSetting(["Islands", "Avoid Edge", "isActive"], TERRA_RULE_TUNING_SETTINGS.islands.avoidEdge.isActive);
  voronoiMap.setPrimaryRuleSetting(["Islands", "Avoid Edge", "meridianEnabled"], TERRA_RULE_TUNING_SETTINGS.islands.avoidEdge.meridianEnabled);
  voronoiMap.setPrimaryRuleSetting(["Islands", "Near Map Center", "isActive"], TERRA_RULE_TUNING_SETTINGS.islands.nearMapCenter.isActive);
  voronoiMap.setPrimaryRuleSetting(["Islands", "Near Map Center", "scaleFactor"], TERRA_RULE_TUNING_SETTINGS.islands.nearMapCenter.scaleFactor);

  voronoiMap.setPrimaryRuleSetting(["Landmasses", "Avoid Edge", "meridianDistance"], TERRA_RULE_TUNING_SETTINGS.landmasses.avoidEdge.meridianDistance);
  voronoiMap.setPrimaryRuleSetting(["Landmasses", "Avoid Edge", "meridianDistanceFalloff"], TERRA_RULE_TUNING_SETTINGS.landmasses.avoidEdge.meridianDistanceFalloff);
  voronoiMap.setPrimaryRuleSetting(["Landmasses", "Avoid Edge", "poleDistance"], TERRA_RULE_TUNING_SETTINGS.landmasses.avoidEdge.poleDistance);
  voronoiMap.setPrimaryRuleSetting(["Landmasses", "Avoid Edge", "poleDistanceFalloff"], TERRA_RULE_TUNING_SETTINGS.landmasses.avoidEdge.poleDistanceFalloff);
  voronoiMap.setPrimaryRuleSetting(["Landmasses", "Near Map Center", "weight"], TERRA_RULE_TUNING_SETTINGS.landmasses.nearMapCenter.weight);
}

function applyTerraDistantIslandSettings(voronoiMap, islandSettings) {
  voronoiMap.setPrimaryGeneratorSetting(["island", "factor"], islandSettings.factor);
  voronoiMap.setPrimaryGeneratorSetting(["island", "minSize"], islandSettings.minSize);
  voronoiMap.setPrimaryGeneratorSetting(["island", "maxSize"], islandSettings.maxSize);
  voronoiMap.setPrimaryGeneratorSetting(["island", "totalSize"], islandSettings.totalSize);
  voronoiMap.setPrimaryGeneratorSetting(["island", "variance"], islandSettings.variance);
}

function applyTerraOceanSeparationSettings(voronoiMap, oceanSeparationMode) {
  if (oceanSeparationMode === "WIDE") {
    voronoiMap.setPrimaryRuleSetting(["Landmasses", "Avoid Other Regions", "minDistance"], TERRA_RULE_TUNING_SETTINGS.landmasses.wideOceanSeparation.minDistance);
    voronoiMap.setPrimaryRuleSetting(["Landmasses", "Avoid Other Regions", "distanceFalloff"], TERRA_RULE_TUNING_SETTINGS.landmasses.wideOceanSeparation.distanceFalloff);
  }
}

class TerraVoronoiContinents extends VoronoiContinents {
  constructor(terraOptions) {
    super();
    this.terraOptions = terraOptions;
    this.layoutPassSettings = getTerraLayoutPassSettings(terraOptions.layoutPassName);
    this.terraLayoutMetadata = void 0;
  }

  applyTerraSeedPlacement(landmasses) {
    const { oldworldLandmassIndex, newworldLandmassIndex } = getTerraLandmassRoleIndexes(landmasses);
    const oldworldLandmass = landmasses[oldworldLandmassIndex];
    const newworldLandmass = landmasses[newworldLandmassIndex];
    const oldworldXEntropy = getTerraSeedEntropy(oldworldLandmass.xPos, oldworldLandmass.yPos, 11);
    const oldworldYEntropy = getTerraSeedEntropy(oldworldLandmass.yPos, oldworldLandmass.xPos, 17);
    const newworldXEntropy = getTerraSeedEntropy(newworldLandmass.xPos, newworldLandmass.yPos, 23);
    const newworldYEntropy = getTerraSeedEntropy(newworldLandmass.yPos, newworldLandmass.xPos, 29);

    oldworldLandmass.xPos = remapUnitToRange(oldworldXEntropy, this.layoutPassSettings.oldworld.xRange);
    oldworldLandmass.yPos = remapUnitToRange(oldworldYEntropy, this.layoutPassSettings.oldworld.yRange);
    newworldLandmass.xPos = remapUnitToRange(newworldXEntropy, this.layoutPassSettings.newworld.xRange);
    newworldLandmass.yPos = remapUnitToRange(newworldYEntropy, this.layoutPassSettings.newworld.yRange);

    this.terraLayoutMetadata = {
      passName: this.terraOptions.layoutPassName,
      oldworldLandmassIndex,
      newworldLandmassIndex
    };

    console.log(`DEBUG: terra layout pass=${this.terraOptions.layoutPassName} oldworldIndex=${oldworldLandmassIndex} newworldIndex=${newworldLandmassIndex}`);
    console.log(`DEBUG: terra layout seeds oldworld=(${oldworldLandmass.xPos.toFixed(4)}, ${oldworldLandmass.yPos.toFixed(4)}) newworld=(${newworldLandmass.xPos.toFixed(4)}, ${newworldLandmass.yPos.toFixed(4)})`);
  }

  applySettings() {
    super.applySettings();
    const generatorSettings = this.getGenerator().getSettings();
    const landmasses = generatorSettings.landmass;
    if (!Array.isArray(landmasses) || landmasses.length < 2) {
      console.error("Terra-YnAMP expected two landmasses after VoronoiContinents.applySettings().");
      return;
    }
    const totalSize = landmasses[0].size + landmasses[1].size;
    landmasses[0].size = totalSize * this.terraOptions.sizeRatio;
    landmasses[1].size = totalSize * (1 - this.terraOptions.sizeRatio);

    const iNumPlayers1 = this.terraOptions.sameLandmass ? 0 : Math.round(this.terraOptions.totalPlayers * this.terraOptions.sizeRatio);
    const iNumPlayers2 = this.terraOptions.totalPlayers - iNumPlayers1;
    landmasses[0].playerAreas = iNumPlayers1;
    landmasses[1].playerAreas = iNumPlayers2;
    this.applyTerraSeedPlacement(landmasses);

    console.log(`DEBUG: terra applySettings sizeRatio=${this.terraOptions.sizeRatio.toFixed(4)}, sameLandmass=${this.terraOptions.sameLandmass}, pass=${this.terraOptions.layoutPassName}`);
    console.log(`DEBUG: landmass[0].size=${landmasses[0].size.toFixed(2)}%, landmass[1].size=${landmasses[1].size.toFixed(2)}%`);
    console.log(`DEBUG: playerAreas landmass[0]=${iNumPlayers1}, landmass[1]=${iNumPlayers2}`);
    console.log(`DEBUG: ${getTerraLandmassSeedSummary(generatorSettings)}`);
  }
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
  const oceanSeparationRaw = Configuration.getMapValue("TerraOceanSeparation");
  const seaLevelType = Configuration.getMapValue("SeaLevel");
  const ratioRaw = Configuration.getMapValue("TerraLandmassRatio");
  const spawnRaw = Configuration.getMapValue("TerraSpawnMode");
  const distantIslandDensityRaw = Configuration.getMapValue("TerraDistantIslandsDensity");
  const distantIslandSizeRaw = Configuration.getMapValue("TerraDistantIslandsSize");
  const oceanSeparationMode = oceanSeparationRaw === "STANDARD" ? "STANDARD" : "WIDE";
  const parsedSizeRatio = ratioRaw != null ? Number.parseInt(ratioRaw, 10) / 100 : 1 / 3;
  const sizeRatio = Number.isFinite(parsedSizeRatio) && parsedSizeRatio > 0 && parsedSizeRatio < 1 ? parsedSizeRatio : 1 / 3;
  const bSameLandmass = spawnRaw == "1";
  const distantIslandSettings = resolveTerraDistantIslandSettings(distantIslandDensityRaw, distantIslandSizeRaw);

  console.log(`DEBUG: oceanSeparation=${oceanSeparationMode} (raw: "${oceanSeparationRaw}"), seaLevel=${seaLevelType}`);
  console.log(`DEBUG: sizeRatio=${sizeRatio.toFixed(4)} (raw: "${ratioRaw}"%); sameLandmass=${bSameLandmass} (raw: "${spawnRaw}")`);
  console.log(`DEBUG: distant islands density=${distantIslandSettings.densityOption} (raw: "${distantIslandDensityRaw}") size=${distantIslandSettings.sizeOption} (raw: "${distantIslandSizeRaw}") factor=${distantIslandSettings.factor.toFixed(2)} minSize=${distantIslandSettings.minSize.toFixed(2)} maxSize=${distantIslandSettings.maxSize.toFixed(2)} totalSize=${distantIslandSettings.totalSize.toFixed(2)} variance=${distantIslandSettings.variance.toFixed(2)}`);

  const terraOptions = {
    sizeRatio,
    sameLandmass: bSameLandmass,
    totalPlayers: iTotalPlayers,
    distantIslandSettings
  };
  let selectedPassResult = simulateTerraVoronoiPass({
    ...terraOptions,
    layoutPassName: "primary"
  }, seaLevelType, oceanSeparationMode, iWidth, iHeight);

  if (selectedPassResult.analysis.isRejected) {
    dumpRejectedTerraLayout(selectedPassResult, terraOptions, seaLevelType, oceanSeparationMode);
    console.log("DEBUG: primary Terra layout rejected; retrying with fallback placement constraints.");
    selectedPassResult = simulateTerraVoronoiPass({
      ...terraOptions,
      layoutPassName: "fallback"
    }, seaLevelType, oceanSeparationMode, iWidth, iHeight);
    if (selectedPassResult.analysis.isRejected) {
      dumpRejectedTerraLayout(selectedPassResult, terraOptions, seaLevelType, oceanSeparationMode);
      console.log("WARNING: fallback Terra layout still failed validation; continuing with fallback result.");
    } else {
      console.log("DEBUG: fallback Terra layout accepted.");
    }
  } else {
    console.log("DEBUG: primary Terra layout accepted.");
  }

  const voronoiMap = selectedPassResult.voronoiMap;
  const generatorSettings = selectedPassResult.generatorSettings;
  const tiles = selectedPassResult.tiles;
  const acceptedLayoutAnalysis = selectedPassResult.analysis;
  const configuredOldworldShare = Math.max(sizeRatio, 1 - sizeRatio);
  const configuredNewworldShare = Math.min(sizeRatio, 1 - sizeRatio);
  const targetOldworldToNewworldRatio = configuredNewworldShare > 0 ? configuredOldworldShare / configuredNewworldShare : 0;
  const simulatedOldworldLandCount = acceptedLayoutAnalysis.majorLandmasses[0]?.landCount ?? 0;
  const simulatedNewworldLandCount = acceptedLayoutAnalysis.majorLandmasses[1]?.landCount ?? 0;
  const oldworldRegionId = getStampedRegionIdForLandmassId(acceptedLayoutAnalysis.oldworldLandmassId);
  const newworldRegionId = getStampedRegionIdForLandmassId(acceptedLayoutAnalysis.newworldLandmassId);
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
  console.log(`Configured OldWorld/NewWorld target ratio: ${targetOldworldToNewworldRatio.toFixed(3)} (${(configuredOldworldShare * 100).toFixed(1)}%/${(configuredNewworldShare * 100).toFixed(1)}%)`);
  if (simulatedNewworldLandCount > 0) {
    console.log(`Actual simulated OldWorld/NewWorld land ratio: ${(simulatedOldworldLandCount / simulatedNewworldLandCount).toFixed(3)} (${simulatedOldworldLandCount}/${simulatedNewworldLandCount})`);
  }
  console.log("STEP: validateAndFixTerrain (post-voronoi)");
  TerrainBuilder.validateAndFixTerrain();
  console.log("STEP: recalculateAreas (post-voronoi)");
  AreaBuilder.recalculateAreas();
  console.log("STEP: stampContinents");
  TerrainBuilder.stampContinents();
  console.log("DEBUG: stampContinents complete");

  let oldworldStampedCount = 0;
  let newworldStampedCount = 0;
  for (let y = 0; y < iHeight; ++y) {
    for (let x = 0; x < iWidth; ++x) {
      const regId = GameplayMap.getLandmassRegionId(x, y);
      if (regId === oldworldRegionId) {
        oldworldStampedCount++;
      } else if (regId === newworldRegionId) {
        newworldStampedCount++;
      }
    }
  }
  console.log(`Stamped OldWorld region: ${oldworldRegionId === LandmassRegion.LANDMASS_REGION_WEST ? "WEST" : oldworldRegionId === LandmassRegion.LANDMASS_REGION_EAST ? "EAST" : "NONE"}`);
  console.log(`Stamped NewWorld region: ${newworldRegionId === LandmassRegion.LANDMASS_REGION_WEST ? "WEST" : newworldRegionId === LandmassRegion.LANDMASS_REGION_EAST ? "EAST" : "NONE"}`);
  console.log(`Stamped OldWorld tile count: ${oldworldStampedCount}`);
  console.log(`Stamped NewWorld tile count: ${newworldStampedCount}`);
  if (newworldStampedCount > 0) {
    console.log(`Actual stamped OldWorld/NewWorld tile ratio: ${(oldworldStampedCount / newworldStampedCount).toFixed(3)} (${oldworldStampedCount}/${newworldStampedCount})`);
  }

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
  for (const row of tiles) {
    for (const tile of row) {
      if (tile.majorPlayerRegionId >= 0 && tile.landmassId > 0) {
        const playerRegion = playerRegions[tile.majorPlayerRegionId];
        playerRegion.landmassId = tile.playerLandmassId - 1;
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
