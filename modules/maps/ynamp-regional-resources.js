/**
 * ynamp-regional-resources
 * Applies a curated Earth-region resource pass after normal resource generation.
 */
import {
    getActiveEarthMapContext,
    getEarthMapLabel,
    getEarthMapSourceMapName,
    isEarthMapPlayableLocalCoordinate,
    mapLocalToSourceCoordinate,
} from '/ged-ynamp/maps/earth-map-context.js';

let g_resourceIndexByType = null;
let g_validAgesByResource = null;
let g_improvementFamiliesByResource = null;
let g_replacementPriorityConfig = null;

const REPLACEMENT_TIER_REGIONAL_PRIORITY = "REGIONAL_PRIORITY";
const REPLACEMENT_TIER_GLOBAL_FALLBACK = "GLOBAL_FALLBACK";

function getTypeSeed(type) {
    return Number(BigInt.asIntN(32, BigInt(Database.makeHash(type))));
}

function getRegionalResourcePlacementMode() {
    let rawMode = Configuration.getMapValue("RegionalResourceMode");
    if (rawMode == null) {
        return "off";
    }

    let mode = Number(BigInt.asIntN(32, BigInt(rawMode)));
    const curatedHash = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_REGIONAL_RESOURCE_CURATED"))));
    if (mode === curatedHash) {
        return "curated";
    }

    return "off";
}

function getGeographicUnlockMode() {
    let rawMode = Configuration.getMapValue("GeographicUnlockMode");
    if (rawMode == null) {
        return "none";
    }

    let mode = Number(BigInt.asIntN(32, BigInt(rawMode)));
    const addHash = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_GEOGRAPHIC_UNLOCK_ADD"))));
    const strictHash = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_GEOGRAPHIC_UNLOCK_STRICT"))));
    if (mode === addHash) {
        return "add";
    }
    if (mode === strictHash) {
        return "strict";
    }

    return "none";
}

function getCurrentAgeType() {
    const ageInfo = GameInfo.Ages.lookup(Game.age);
    return ageInfo ? ageInfo.AgeType : null;
}

function getResourceIndex(resourceType) {
    if (!g_resourceIndexByType) {
        g_resourceIndexByType = {};
        for (let i = 0; i < GameInfo.Resources.length; i++) {
            const resource = GameInfo.Resources[i];
            if (!resource) {
                continue;
            }
            g_resourceIndexByType[resource.ResourceType] = resource.$index;
        }
    }

    return g_resourceIndexByType[resourceType];
}

function getValidAgesByResource() {
    if (!g_validAgesByResource) {
        g_validAgesByResource = {};
        const rows = GameInfo.Resource_ValidAges;
        if (rows) {
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!g_validAgesByResource[row.ResourceType]) {
                    g_validAgesByResource[row.ResourceType] = new Set();
                }
                g_validAgesByResource[row.ResourceType].add(row.AgeType);
            }
        }
    }

    return g_validAgesByResource;
}

function getReplacementPriorityConfig() {
    if (!g_replacementPriorityConfig) {
        const byResource = {};
        const orderByTier = {};
        const resourcesByTier = {};
        const rows = GameInfo.ResourcePlacementPriority ?? [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row.Resource || !row.Tier) {
                continue;
            }

            const tier = row.Tier;
            const priority = Number(row.Priority ?? 0);
            byResource[row.Resource] = {
                tier,
                priority,
            };

            if (!orderByTier[tier]) {
                orderByTier[tier] = {};
                resourcesByTier[tier] = [];
            }

            orderByTier[tier][row.Resource] = priority;
            resourcesByTier[tier].push(row.Resource);
        }

        const tiers = Object.keys(resourcesByTier);
        for (let i = 0; i < tiers.length; i++) {
            const tier = tiers[i];
            resourcesByTier[tier].sort((leftResourceType, rightResourceType) => compareCandidateType(leftResourceType, rightResourceType, orderByTier[tier]));
        }

        g_replacementPriorityConfig = {
            byResource,
            orderByTier,
            resourcesByTier,
        };
    }

    return g_replacementPriorityConfig;
}

function getReplacementPriorityMeta(resourceType) {
    return getReplacementPriorityConfig().byResource[resourceType] ?? null;
}

function getReplacementPriorityOrder(tier) {
    return getReplacementPriorityConfig().orderByTier[tier] ?? null;
}

function getReplacementResourcesForTier(tier) {
    return getReplacementPriorityConfig().resourcesByTier[tier] ?? [];
}

function getImprovementFamiliesByResource() {
    if (!g_improvementFamiliesByResource) {
        g_improvementFamiliesByResource = {};

        function addFamily(resourceType, constructibleType) {
            if (!resourceType || !constructibleType) {
                return;
            }
            if (!g_improvementFamiliesByResource[resourceType]) {
                g_improvementFamiliesByResource[resourceType] = new Set();
            }
            g_improvementFamiliesByResource[resourceType].add(constructibleType);
        }

        const validRows = GameInfo.Constructible_ValidResources ?? [];
        for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i];
            addFamily(row.ResourceType, row.ConstructibleType);
        }

        const districtRows = GameInfo.District_FreeConstructibles ?? [];
        for (let i = 0; i < districtRows.length; i++) {
            const row = districtRows[i];
            addFamily(row.ResourceType, row.ConstructibleType);
        }
    }

    return g_improvementFamiliesByResource;
}

function getImprovementFamiliesForResource(resourceType) {
    return getImprovementFamiliesByResource()[resourceType] ?? null;
}

function sharesImprovementFamily(leftResourceType, rightResourceType) {
    const leftFamilies = getImprovementFamiliesForResource(leftResourceType);
    const rightFamilies = getImprovementFamiliesForResource(rightResourceType);
    if (!leftFamilies || !rightFamilies || leftFamilies.size == 0 || rightFamilies.size == 0) {
        return false;
    }

    for (const family of leftFamilies) {
        if (rightFamilies.has(family)) {
            return true;
        }
    }

    return false;
}

function isResourceValidForAge(resourceType, ageType) {
    if (!ageType) {
        return true;
    }

    const validAgesByResource = getValidAgesByResource();
    const validAges = validAgesByResource[resourceType];
    if (!validAges || validAges.size == 0) {
        return true;
    }

    return validAges.has(ageType);
}

function buildPrimaryRegionGrid(iWidth, iHeight, mapContext) {
    const regionRows = GameInfo.RegionPosition;
    if (!regionRows) {
        return null;
    }

    const sourceMapName = getEarthMapSourceMapName(mapContext);
    const sourceWidth = mapContext?.sourceWidth ?? iWidth;
    const regionByTile = [];

    for (let iX = 0; iX < iWidth; iX++) {
        regionByTile[iX] = [];
        for (let iY = 0; iY < iHeight; iY++) {
            regionByTile[iX][iY] = null;
        }
    }

    for (let iX = 0; iX < iWidth; iX++) {
        for (let iY = 0; iY < iHeight; iY++) {
            if (!isEarthMapPlayableLocalCoordinate(iX, iY, mapContext)) {
                continue;
            }

            const sourceCoord = mapLocalToSourceCoordinate(iX, iY, mapContext);
            if (!sourceCoord) {
                continue;
            }

            for (let i = 0; i < regionRows.length; i++) {
                const row = regionRows[i];
                if (row.MapName != sourceMapName) {
                    continue;
                }

                if (sourceCoord.Y < row.Y || sourceCoord.Y >= row.Y + row.Height) {
                    continue;
                }

                let xOffset = sourceCoord.X - row.X;
                if (xOffset < 0) {
                    xOffset += sourceWidth;
                }

                if (xOffset >= 0 && xOffset < row.Width) {
                    regionByTile[iX][iY] = row.Region;
                    break;
                }
            }
        }
    }

    return regionByTile;
}

function buildRegionTileAccessor(iWidth, iHeight, mapContext) {
    const cache = {};
    const regionRows = GameInfo.RegionPosition;
    const sourceMapName = getEarthMapSourceMapName(mapContext);
    const sourceWidth = mapContext?.sourceWidth ?? iWidth;

    return function getTilesForRegion(regionName) {
        if (cache[regionName]) {
            return cache[regionName];
        }

        const tiles = [];
        const seen = new Set();
        if (!regionRows) {
            cache[regionName] = tiles;
            return tiles;
        }

        for (let iX = 0; iX < iWidth; iX++) {
            for (let iY = 0; iY < iHeight; iY++) {
                if (!isEarthMapPlayableLocalCoordinate(iX, iY, mapContext)) {
                    continue;
                }

                const sourceCoord = mapLocalToSourceCoordinate(iX, iY, mapContext);
                if (!sourceCoord) {
                    continue;
                }

                for (let i = 0; i < regionRows.length; i++) {
                    const row = regionRows[i];
                    if (row.MapName != sourceMapName || row.Region != regionName) {
                        continue;
                    }

                    if (sourceCoord.Y < row.Y || sourceCoord.Y >= row.Y + row.Height) {
                        continue;
                    }

                    let xOffset = sourceCoord.X - row.X;
                    if (xOffset < 0) {
                        xOffset += sourceWidth;
                    }

                    if (xOffset >= 0 && xOffset < row.Width) {
                        const key = iX + "," + iY;
                        if (!seen.has(key)) {
                            seen.add(key);
                            tiles.push({ x: iX, y: iY });
                        }
                        break;
                    }
                }
            }
        }

        cache[regionName] = tiles;
        return tiles;
    };
}

function buildRegionalRules(ageType = getCurrentAgeType()) {
    const rulesByResource = {};
    const exclusiveRows = GameInfo.ResourceRegionExclusive ?? [];
    const excludeRows = GameInfo.ResourceRegionExclude ?? [];
    const depositRows = GameInfo.ResourceRegionDeposit ?? [];

    function getRule(resourceType) {
        if (!rulesByResource[resourceType]) {
            rulesByResource[resourceType] = {
                allowedRegions: new Set(),
                excludedRegions: new Set(),
                deposits: [],
            };
        }
        return rulesByResource[resourceType];
    }

    for (let i = 0; i < exclusiveRows.length; i++) {
        const row = exclusiveRows[i];
        if (!isResourceValidForAge(row.Resource, ageType)) {
            continue;
        }
        getRule(row.Resource).allowedRegions.add(row.Region);
    }

    for (let i = 0; i < excludeRows.length; i++) {
        const row = excludeRows[i];
        if (!isResourceValidForAge(row.Resource, ageType)) {
            continue;
        }
        getRule(row.Resource).excludedRegions.add(row.Region);
    }

    for (let i = 0; i < depositRows.length; i++) {
        const row = depositRows[i];
        if (!isResourceValidForAge(row.Resource, ageType)) {
            continue;
        }

        const rule = getRule(row.Resource);
        rule.allowedRegions.add(row.Region);
        rule.deposits.push({
            region: row.Region,
            deposit: row.Deposit || row.Region,
            minCount: row.MinYield ?? 1,
            maxCount: Math.max(row.MinYield ?? 1, row.MaxYield ?? row.MinYield ?? 1),
        });
    }

    return rulesByResource;
}

function isRegionAllowed(rule, primaryRegion) {
    if (rule.allowedRegions.size > 0) {
        if (!primaryRegion || !rule.allowedRegions.has(primaryRegion)) {
            return false;
        }
    }

    if (primaryRegion && rule.excludedRegions.has(primaryRegion)) {
        return false;
    }

    return true;
}

function getCandidateScore(x, y, seed) {
    return (Math.imul(x + 17, 73856093) ^ Math.imul(y + 31, 19349663) ^ seed) >>> 0;
}

function compareCandidateType(leftResourceType, rightResourceType, priorityOrder = null) {
    const leftOrder = priorityOrder?.[leftResourceType] ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = priorityOrder?.[rightResourceType] ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
    }

    const leftSeed = getTypeSeed(leftResourceType);
    const rightSeed = getTypeSeed(rightResourceType);
    if (leftSeed !== rightSeed) {
        return leftSeed - rightSeed;
    }

    return leftResourceType.localeCompare(rightResourceType);
}

function countResourceOnTiles(resourceIndex, tiles) {
    let count = 0;
    for (let i = 0; i < tiles.length; i++) {
        if (GameplayMap.getResourceType(tiles[i].x, tiles[i].y) === resourceIndex) {
            count++;
        }
    }
    return count;
}

    function incrementResourceCount(counter, resourceType, amount = 1) {
        counter[resourceType] = (counter[resourceType] ?? 0) + amount;
    }

    function getResourceCount(counter, resourceType) {
        return counter[resourceType] ?? 0;
    }

    function incrementReplacementPairCount(counter, fromResourceType, toResourceType, tier) {
        const key = fromResourceType + "|" + toResourceType + "|" + tier;
        counter[key] = (counter[key] ?? 0) + 1;
    }

    function getActiveReplacementCandidates(resourceTypes, removedResourceType, primaryRegion, rulesByResource) {
        const candidates = [];
        const regionalPriorityOrder = getReplacementPriorityOrder(REPLACEMENT_TIER_REGIONAL_PRIORITY);

        for (let i = 0; i < resourceTypes.length; i++) {
            const resourceType = resourceTypes[i];
            if (resourceType === removedResourceType) {
                continue;
            }
            if (!sharesImprovementFamily(removedResourceType, resourceType)) {
                continue;
            }

            const rule = rulesByResource[resourceType];
            if (!rule || !isRegionAllowed(rule, primaryRegion)) {
                continue;
            }

            candidates.push(resourceType);
        }

        candidates.sort((leftResourceType, rightResourceType) => {
            const leftBucket = getReplacementPriorityMeta(leftResourceType)?.tier === REPLACEMENT_TIER_REGIONAL_PRIORITY ? 0 : 1;
            const rightBucket = getReplacementPriorityMeta(rightResourceType)?.tier === REPLACEMENT_TIER_REGIONAL_PRIORITY ? 0 : 1;
            if (leftBucket !== rightBucket) {
                return leftBucket - rightBucket;
            }

            if (leftBucket === 0) {
                return compareCandidateType(leftResourceType, rightResourceType, regionalPriorityOrder);
            }

            return compareCandidateType(leftResourceType, rightResourceType, null);
        });

        return candidates;
    }

    function getGlobalFallbackCandidates(removedResourceType, ageType) {
        const candidates = [];
        const fallbackResources = getReplacementResourcesForTier(REPLACEMENT_TIER_GLOBAL_FALLBACK);
        const fallbackOrder = getReplacementPriorityOrder(REPLACEMENT_TIER_GLOBAL_FALLBACK);

        for (let i = 0; i < fallbackResources.length; i++) {
            const resourceType = fallbackResources[i];
            if (!isResourceValidForAge(resourceType, ageType)) {
                continue;
            }
            if (!sharesImprovementFamily(removedResourceType, resourceType)) {
                continue;
            }

            candidates.push(resourceType);
        }

        candidates.sort((leftResourceType, rightResourceType) => compareCandidateType(leftResourceType, rightResourceType, fallbackOrder));
        return candidates;
    }

    function tryPlaceReplacementOnRemovedPlot(removedPlot, ageType, resourceTypes, rulesByResource, replacementPairsByResource) {
        if (GameplayMap.getResourceType(removedPlot.x, removedPlot.y) !== ResourceTypes.NO_RESOURCE) {
            return { placed: false, globalFallback: false };
        }

        const activeCandidates = getActiveReplacementCandidates(resourceTypes, removedPlot.resourceType, removedPlot.primaryRegion, rulesByResource);
        for (let i = 0; i < activeCandidates.length; i++) {
            const candidateType = activeCandidates[i];
            const candidateIndex = getResourceIndex(candidateType);
            if (candidateIndex == null) {
                continue;
            }
            if (!ResourceBuilder.canHaveResource(removedPlot.x, removedPlot.y, candidateIndex)) {
                continue;
            }

            ResourceBuilder.setResourceType(removedPlot.x, removedPlot.y, candidateIndex);
            incrementReplacementPairCount(replacementPairsByResource, removedPlot.resourceType, candidateType, "active");
            return { placed: true, globalFallback: false };
        }

        const globalCandidates = getGlobalFallbackCandidates(removedPlot.resourceType, ageType);
        for (let i = 0; i < globalCandidates.length; i++) {
            const candidateType = globalCandidates[i];
            const candidateIndex = getResourceIndex(candidateType);
            if (candidateIndex == null) {
                continue;
            }
            if (!ResourceBuilder.canHaveResource(removedPlot.x, removedPlot.y, candidateIndex)) {
                continue;
            }

            ResourceBuilder.setResourceType(removedPlot.x, removedPlot.y, candidateIndex);
            incrementReplacementPairCount(replacementPairsByResource, removedPlot.resourceType, candidateType, "global");
            return { placed: true, globalFallback: true };
        }

        return { placed: false, globalFallback: false };
    }

export function applyRegionalResourcePlacement(iWidth, iHeight, mapContext = getActiveEarthMapContext()) {
    const mode = getRegionalResourcePlacementMode();
    const unlockMode = getGeographicUnlockMode();
    if (mode === "off") {
        return;
    }

    if (!mapContext || !GameInfo.RegionPosition) {
        console.log("RegionalResourcePlacement: skipped (no Earth region context)");
        return;
    }

    const primaryRegionGrid = buildPrimaryRegionGrid(iWidth, iHeight, mapContext);
    if (!primaryRegionGrid) {
        console.log("RegionalResourcePlacement: skipped (no region grid)");
        return;
    }

    const ageType = getCurrentAgeType();
    const mapLabel = getEarthMapLabel(mapContext);
    const rulesByResource = buildRegionalRules(ageType);
    const resourceTypes = Object.keys(rulesByResource).sort();
    if (resourceTypes.length == 0) {
        console.log("RegionalResourcePlacement: skipped (no active rules)");
        return;
    }

    let removedCount = 0;
    let addedCount = 0;
    let replacedCount = 0;
    let replacementMissCount = 0;
    let globalFallbackCount = 0;
    const removedByResource = {};
    const addedByResource = {};
    const replacedByResource = {};
    const replacementMissByResource = {};
    const globalFallbackByResource = {};
    const unmetByResource = {};
    const skippedDepositsByResource = {};
    const replacementPairsByResource = {};
    const removedPlots = [];

    for (let iY = 0; iY < iHeight; iY++) {
        for (let iX = 0; iX < iWidth; iX++) {
            if (!isEarthMapPlayableLocalCoordinate(iX, iY, mapContext)) {
                continue;
            }

            const resourceIndex = GameplayMap.getResourceType(iX, iY);
            if (resourceIndex === ResourceTypes.NO_RESOURCE) {
                continue;
            }

            const resourceInfo = GameInfo.Resources[resourceIndex];
            if (!resourceInfo) {
                continue;
            }

            const rule = rulesByResource[resourceInfo.ResourceType];
            if (!rule) {
                continue;
            }

            if (!isRegionAllowed(rule, primaryRegionGrid[iX][iY])) {
                removedPlots.push({
                    x: iX,
                    y: iY,
                    resourceType: resourceInfo.ResourceType,
                    primaryRegion: primaryRegionGrid[iX][iY],
                });
                ResourceBuilder.setResourceType(iX, iY, ResourceTypes.NO_RESOURCE);
                removedCount++;
                incrementResourceCount(removedByResource, resourceInfo.ResourceType);
            }
        }
    }

    const getTilesForRegion = buildRegionTileAccessor(iWidth, iHeight, mapContext);

    for (let i = 0; i < resourceTypes.length; i++) {
        const resourceType = resourceTypes[i];
        const resourceIndex = getResourceIndex(resourceType);
        if (resourceIndex == null) {
            continue;
        }

        const rule = rulesByResource[resourceType];
        const seed = Number(BigInt.asIntN(32, BigInt(Database.makeHash(resourceType))));

        for (let j = 0; j < rule.deposits.length; j++) {
            const depositRule = rule.deposits[j];
            let tiles = getTilesForRegion(depositRule.deposit);
            if (tiles.length == 0 && depositRule.deposit != depositRule.region) {
                tiles = getTilesForRegion(depositRule.region);
            }
            if (tiles.length == 0) {
                incrementResourceCount(skippedDepositsByResource, resourceType);
                continue;
            }

            const existingCount = countResourceOnTiles(resourceIndex, tiles);
            const targetCount = Math.min(Math.max(existingCount, depositRule.minCount), depositRule.maxCount);
            let neededCount = targetCount - existingCount;
            if (neededCount <= 0) {
                continue;
            }

            const candidates = [];
            for (let k = 0; k < tiles.length; k++) {
                const tile = tiles[k];
                if (!isRegionAllowed(rule, primaryRegionGrid[tile.x][tile.y])) {
                    continue;
                }
                if (GameplayMap.getResourceType(tile.x, tile.y) !== ResourceTypes.NO_RESOURCE) {
                    continue;
                }
                if (!ResourceBuilder.canHaveResource(tile.x, tile.y, resourceIndex)) {
                    continue;
                }

                candidates.push({
                    x: tile.x,
                    y: tile.y,
                    score: getCandidateScore(tile.x, tile.y, seed),
                });
            }

            candidates.sort((left, right) => left.score - right.score);
            for (let k = 0; k < candidates.length && neededCount > 0; k++) {
                ResourceBuilder.setResourceType(candidates[k].x, candidates[k].y, resourceIndex);
                addedCount++;
                incrementResourceCount(addedByResource, resourceType);
                neededCount--;
            }

            if (neededCount > 0) {
                incrementResourceCount(unmetByResource, resourceType, neededCount);
            }
        }
    }

    for (let i = 0; i < removedPlots.length; i++) {
        const removedPlot = removedPlots[i];
        if (GameplayMap.getResourceType(removedPlot.x, removedPlot.y) !== ResourceTypes.NO_RESOURCE) {
            continue;
        }

        const replacementResult = tryPlaceReplacementOnRemovedPlot(removedPlot, ageType, resourceTypes, rulesByResource, replacementPairsByResource);
        if (!replacementResult.placed) {
            replacementMissCount++;
            incrementResourceCount(replacementMissByResource, removedPlot.resourceType);
            continue;
        }

        replacedCount++;
        incrementResourceCount(replacedByResource, removedPlot.resourceType);
        if (replacementResult.globalFallback) {
            globalFallbackCount++;
            incrementResourceCount(globalFallbackByResource, removedPlot.resourceType);
        }
    }

    console.log(
        "RegionalResourcePlacement: mode=" + mode +
        " unlockMode=" + unlockMode +
        " age=" + (ageType ?? "UNKNOWN") +
        " map=" + mapLabel +
        " rules=" + resourceTypes.length +
        " removed=" + removedCount +
        " added=" + addedCount +
        " replaced=" + replacedCount +
        " replacementMiss=" + replacementMissCount +
        " globalFallback=" + globalFallbackCount
    );

    console.log(
        "RegionalResourcePlacementActive: map=" + mapLabel +
        " age=" + (ageType ?? "UNKNOWN") +
        " resources=" + resourceTypes.join(",")
    );

    for (let i = 0; i < resourceTypes.length; i++) {
        const resourceType = resourceTypes[i];
        console.log(
            "RegionalResourcePlacementDetail: map=" + mapLabel +
            " age=" + (ageType ?? "UNKNOWN") +
            " resource=" + resourceType +
            " removed=" + getResourceCount(removedByResource, resourceType) +
            " added=" + getResourceCount(addedByResource, resourceType) +
            " replaced=" + getResourceCount(replacedByResource, resourceType) +
            " replacementMiss=" + getResourceCount(replacementMissByResource, resourceType) +
            " globalFallback=" + getResourceCount(globalFallbackByResource, resourceType) +
            " unmet=" + getResourceCount(unmetByResource, resourceType) +
            " skippedDeposits=" + getResourceCount(skippedDepositsByResource, resourceType)
        );
    }

    const replacementPairKeys = Object.keys(replacementPairsByResource).sort();
    for (let i = 0; i < replacementPairKeys.length; i++) {
        const pairKey = replacementPairKeys[i];
        const [fromResourceType, toResourceType, tier] = pairKey.split("|");
        console.log(
            "RegionalResourcePlacementReplacement: map=" + mapLabel +
            " age=" + (ageType ?? "UNKNOWN") +
            " from=" + fromResourceType +
            " to=" + toResourceType +
            " tier=" + tier +
            " count=" + replacementPairsByResource[pairKey]
        );
    }
}