/**
 * ynamp-natural-wonders
 * Natural wonder placement logic for YnAMP maps.
 */
import * as globals from '/base-standard/maps/map-globals.js';

/**
 * Reads the NWPlacementMode map option and returns the effective mode string.
 * @returns {'random'|'real-and-random'|'real-only'}
 */
export function getNWPlacementMode() {
    let rawMode = Configuration.getMapValue("NWPlacementMode");
    if (rawMode == null) {
        return "real-and-random";
    }
    let mode = Number(BigInt.asIntN(32, BigInt(rawMode)));
    const randomHash         = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_NW_PLACEMENT_RANDOM"))));
    const realOnlyHash       = Number(BigInt.asIntN(32, BigInt(Database.makeHash("YNAMP_NW_PLACEMENT_REAL_ONLY"))));

    if (mode === randomHash) {
        return "random";
    }
    if (mode === realOnlyHash) {
        return "real-only";
    }
    return "real-and-random";
}

const TERRAIN_NAMES_SHORT = ["MTN", "HILL", "FLAT", "COAST", "OCEAN", "NAVR"];
const BIOME_NAMES_SHORT = ["TUNDRA", "GRASS", "PLAINS", "TROP", "DESERT", "MARINE"];
const TERRAIN_NAMES_FULL = ["TERRAIN_MOUNTAIN", "TERRAIN_HILL", "TERRAIN_FLAT", "TERRAIN_COAST", "TERRAIN_OCEAN", "TERRAIN_NAVIGABLE_RIVER"];
const BIOME_NAMES_FULL = ["BIOME_TUNDRA", "BIOME_GRASSLAND", "BIOME_PLAINS", "BIOME_TROPICAL", "BIOME_DESERT", "BIOME_MARINE"];

function logNWDiagnostic(x, y, typeTagSet, minElev, requiredTerrain, requiredBiome, footprintTiles) {
    // Log elevation vs MinimumElevation
    const elev = GameplayMap.getElevation(x, y);
    let elevStr = "elev=" + elev;
    if (minElev > 0) elevStr += " (minElev=" + minElev + (elev < minElev ? " FAIL)" : " ok)");

    // Check river adjacency: onRiver = river edge ON this tile; hasAdjRiver = any river within 1 tile
    const onRiver     = GameplayMap.isRiver(x, y);
    const hasAdjRiver = GameplayMap.isAdjacentToRivers(x, y, 1);

    // Simulate JS-accessible TypeTag checks
    const tagResults = [];
    const loc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(x, y));
    let hasAdjMtn = false, hasAdjLand = false, allSameBiome = true;
    const anchorBiome = GameplayMap.getBiomeType(x, y);
    const adjTiles = [];
    const cliffDirs = [];
    for (let d = 0; d < 6; d++) {
        const a = GameplayMap.getAdjacentPlotLocation(loc, d);
        if (a.x < 0 || a.y < 0) continue;
        const hasCliff = GameplayMap.isCliffCrossing(x, y, d);
        if (hasCliff) cliffDirs.push(d);
        const aTerrain = GameplayMap.getTerrainType(a.x, a.y);
        const aBiome   = GameplayMap.getBiomeType(a.x, a.y);
        adjTiles.push("d" + d + ":" + (["MTN","HILL","FLAT","COAST","OCEAN","NAVR"][aTerrain] || aTerrain) + "/" + (["TUNDRA","GRASS","PLAINS","TROP","DESERT","MARINE"][aBiome] || aBiome) + " cliff=" + hasCliff);
        if (aTerrain === globals.g_MountainTerrain) hasAdjMtn = true;
        if (!GameplayMap.isWater(a.x, a.y)) hasAdjLand = true;
        if (aBiome !== anchorBiome) allSameBiome = false;
    }

    if (typeTagSet.has("ADJACENTMOUNTAIN"))    tagResults.push("ADJACENTMOUNTAIN=" + hasAdjMtn);
    if (typeTagSet.has("NOTADJACENTMOUNTAIN")) tagResults.push("NOTADJACENTMOUNTAIN=" + !hasAdjMtn);
    if (typeTagSet.has("ADJACENTTOSAMEBIOME")) tagResults.push("ADJACENTTOSAMEBIOME=" + allSameBiome);
    if (typeTagSet.has("ADJACENTTOLAND"))      tagResults.push("ADJACENTTOLAND=" + hasAdjLand);
    if (typeTagSet.has("NOTADJACENTTORIVER"))  tagResults.push("NOTADJACENTTORIVER=" + !hasAdjRiver);
    if (typeTagSet.has("WATERFALL"))           tagResults.push("WATERFALL(needsRiver)=onRiver:" + onRiver + " adjRiver:" + hasAdjRiver);
    if (typeTagSet.has("NOTNEARCOAST"))        tagResults.push("NOTNEARCOAST(approx)=coastal:" + GameplayMap.isCoastalLand(x, y));
    if (typeTagSet.has("SHALLOWWATER")) {
        const tIdx = GameplayMap.getTerrainType(x, y);
        tagResults.push("SHALLOWWATER=isCoast:" + (tIdx === globals.g_CoastTerrain));
    }
    tagResults.push("CLIFFS=" + (cliffDirs.length > 0 ? cliffDirs.join(",") : "none"));

    const terrainToStrD = ["TERRAIN_MOUNTAIN","TERRAIN_HILL","TERRAIN_FLAT","TERRAIN_COAST","TERRAIN_OCEAN","TERRAIN_NAVIGABLE_RIVER"];
    const biomeToStrD   = ["BIOME_TUNDRA","BIOME_GRASSLAND","BIOME_PLAINS","BIOME_TROPICAL","BIOME_DESERT","BIOME_MARINE"];
    const anchorTStr = terrainToStrD[GameplayMap.getTerrainType(x, y)] || ("terrain#" + GameplayMap.getTerrainType(x, y));
    const anchorBStr = biomeToStrD[anchorBiome] || ("biome#" + anchorBiome);
    console.log("     diag: " + elevStr + " | onRiver=" + onRiver + " adjRiver=" + hasAdjRiver + " | anchor=" + anchorTStr + "/" + anchorBStr + " (want " + requiredTerrain + "/" + requiredBiome + ")");
    if (tagResults.length > 0) console.log("     diag: tags: " + tagResults.join(" | "));
    console.log("     diag: adj: " + adjTiles.join(", "));
    
    // Enhanced: Log river/cliff state for each footprint tile
    if (footprintTiles && footprintTiles.length > 0) {
        const fpDetails = [];
        for (let i = 0; i < footprintTiles.length; i++) {
            const ft = footprintTiles[i];
            const fpOnRiver = GameplayMap.isRiver(ft.x, ft.y);
            const fpAdjRiver = GameplayMap.isAdjacentToRivers(ft.x, ft.y, 1);
            const fpCliffs = [];
            const fpLoc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(ft.x, ft.y));
            for (let d = 0; d < 6; d++) {
                const fpAdj = GameplayMap.getAdjacentPlotLocation(fpLoc, d);
                if (fpAdj.x >= 0 && fpAdj.y >= 0) {
                    if (GameplayMap.isCliffCrossing(ft.x, ft.y, d)) {
                        fpCliffs.push(d);
                    }
                }
            }
            fpDetails.push("(" + ft.x + "," + ft.y + "):river=" + fpOnRiver + " adjRiver=" + fpAdjRiver + " cliff=" + (fpCliffs.length > 0 ? fpCliffs.join(",") : "none"));
        }
        console.log("     diag: footprint: " + fpDetails.join(" | "));
    }
}

function getAdjacentOrNull(x, y, dir) {
    const loc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(x, y));
    const a = GameplayMap.getAdjacentPlotLocation(loc, dir);
    if (a.x < 0 || a.y < 0) return null;
    return { x: a.x, y: a.y };
}

function getFootprintTiles(anchorX, anchorY, placementClass, dir) {
    const pc = placementClass || "ONE";
    const d0 = dir;
    const d1 = (dir + 1) % 6;
    const tiles = [{ x: anchorX, y: anchorY }];

    const pushTile = (t) => {
        if (!t) return false;
        const key = t.x + "," + t.y;
        for (let i = 0; i < tiles.length; i++) {
            if (tiles[i].x + "," + tiles[i].y === key) return true;
        }
        tiles.push(t);
        return true;
    };

    if (pc === "ONE") {
        return tiles;
    }

    if (pc === "TWO" || pc === "TWOADJACENT") {
        const t1 = getAdjacentOrNull(anchorX, anchorY, d0);
        if (!t1) return null;
        pushTile(t1);
        return tiles;
    }

    if (pc === "THREETRIANGLE" || pc === "THREETRIANGLEDEEPOCEAN") {
        const t1 = getAdjacentOrNull(anchorX, anchorY, d0);
        const t2 = getAdjacentOrNull(anchorX, anchorY, d1);
        if (!t1 || !t2) return null;
        pushTile(t1);
        pushTile(t2);
        return tiles;
    }

    if (pc === "FOURADJACENT") {
        let cur = { x: anchorX, y: anchorY };
        for (let i = 0; i < 3; i++) {
            cur = getAdjacentOrNull(cur.x, cur.y, d0);
            if (!cur) return null;
            pushTile(cur);
        }
        return tiles;
    }

    if (pc === "FOURPARALLELAGRM") {
        const t1 = getAdjacentOrNull(anchorX, anchorY, d0);
        const t2 = getAdjacentOrNull(anchorX, anchorY, d1);
        if (!t1 || !t2) return null;
        const t3 = getAdjacentOrNull(t1.x, t1.y, d1);
        if (!t3) return null;
        pushTile(t1);
        pushTile(t2);
        pushTile(t3);
        return tiles;
    }

    if (pc === "FOURL") {
        const t1 = getAdjacentOrNull(anchorX, anchorY, d0);
        if (!t1) return null;
        const t2 = getAdjacentOrNull(t1.x, t1.y, d0);
        const t3 = getAdjacentOrNull(anchorX, anchorY, d1);
        if (!t2 || !t3) return null;
        pushTile(t1);
        pushTile(t2);
        pushTile(t3);
        return tiles;
    }

    // Unknown PlacementClass: fall back to anchor-only behavior.
    return tiles;
}

function diagnoseKnownTypeTagBlocks(x, y, typeTagSet) {
    const knownTags = new Set([
        "ADJACENTMOUNTAIN",
        "NOTADJACENTMOUNTAIN",
        "ADJACENTTOSAMEBIOME",
        "ADJACENTTOLAND",
        "NOTADJACENTTORIVER",
        "WATERFALL",
        "NOTNEARCOAST",
        "SHALLOWWATER",
    ]);
    const blockingTags = [];
    const unresolvedTags = [];

    const loc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(x, y));
    let hasAdjMtn = false;
    let hasAdjLand = false;
    let allSameBiome = true;
    const anchorBiome = GameplayMap.getBiomeType(x, y);
    for (let d = 0; d < 6; d++) {
        const a = GameplayMap.getAdjacentPlotLocation(loc, d);
        if (a.x < 0 || a.y < 0) continue;
        if (GameplayMap.getTerrainType(a.x, a.y) === globals.g_MountainTerrain) hasAdjMtn = true;
        if (!GameplayMap.isWater(a.x, a.y)) hasAdjLand = true;
        if (GameplayMap.getBiomeType(a.x, a.y) !== anchorBiome) allSameBiome = false;
    }

    if (typeTagSet.has("ADJACENTMOUNTAIN") && !hasAdjMtn) blockingTags.push("ADJACENTMOUNTAIN");
    if (typeTagSet.has("NOTADJACENTMOUNTAIN") && hasAdjMtn) blockingTags.push("NOTADJACENTMOUNTAIN");
    if (typeTagSet.has("ADJACENTTOSAMEBIOME") && !allSameBiome) blockingTags.push("ADJACENTTOSAMEBIOME");
    if (typeTagSet.has("ADJACENTTOLAND") && !hasAdjLand) blockingTags.push("ADJACENTTOLAND");
    if (typeTagSet.has("NOTADJACENTTORIVER") && GameplayMap.isAdjacentToRivers(x, y, 1)) blockingTags.push("NOTADJACENTTORIVER");
    if (typeTagSet.has("WATERFALL") && !GameplayMap.isRiver(x, y) && !GameplayMap.isAdjacentToRivers(x, y, 1)) blockingTags.push("WATERFALL");
    if (typeTagSet.has("NOTNEARCOAST") && GameplayMap.isCoastalLand(x, y)) blockingTags.push("NOTNEARCOAST");
    if (typeTagSet.has("SHALLOWWATER") && GameplayMap.getTerrainType(x, y) !== globals.g_CoastTerrain) blockingTags.push("SHALLOWWATER");

    typeTagSet.forEach(tag => {
        if (!knownTags.has(tag)) unresolvedTags.push(tag);
    });

    return { blockingTags, unresolvedTags };
}

function formatFootprintSnapshot(footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater) {
    if (!footprintTiles || footprintTiles.length === 0) return "footprint:none";
    const parts = [];
    for (let i = 0; i < footprintTiles.length; i++) {
        const ft = footprintTiles[i];
        const tIdx = GameplayMap.getTerrainType(ft.x, ft.y);
        const bIdx = GameplayMap.getBiomeType(ft.x, ft.y);
        const tStr = TERRAIN_NAMES_SHORT[tIdx] || ("t#" + tIdx);
        const bStr = BIOME_NAMES_SHORT[bIdx] || ("b#" + bIdx);
        const tFull = TERRAIN_NAMES_FULL[tIdx] || ("terrain#" + tIdx);
        const bFull = BIOME_NAMES_FULL[bIdx] || ("biome#" + bIdx);
        const isWater = (tIdx === globals.g_CoastTerrain || tIdx === globals.g_OceanTerrain);
        const flags = [];
        if (requiredTerrain && tFull !== requiredTerrain) flags.push("t");
        if (requiredBiome && bFull !== requiredBiome) flags.push("b");
        if (wonderNeedsWater !== undefined && isWater !== wonderNeedsWater) flags.push("d");
        
        // Enhanced: Add river and cliff state flags
        const riverFlag = GameplayMap.isRiver(ft.x, ft.y) ? "r" : "";
        const adjRiverFlag = GameplayMap.isAdjacentToRivers(ft.x, ft.y, 1) ? "ar" : "";
        const fpLoc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(ft.x, ft.y));
        const cliffDirs = [];
        for (let d = 0; d < 6; d++) {
            const fpAdj = GameplayMap.getAdjacentPlotLocation(fpLoc, d);
            if (fpAdj.x >= 0 && fpAdj.y >= 0) {
                if (GameplayMap.isCliffCrossing(ft.x, ft.y, d)) {
                    cliffDirs.push(d);
                }
            }
        }
        const cliffFlag = cliffDirs.length > 0 ? ("c" + cliffDirs.join(",")) : "";
        if (riverFlag) flags.push(riverFlag);
        if (adjRiverFlag) flags.push(adjRiverFlag);
        if (cliffFlag) flags.push(cliffFlag);
        
        parts.push("(" + ft.x + "," + ft.y + ")=" + tStr + "/" + bStr + (flags.length > 0 ? "!" + flags.join("") : ""));
    }
    return "footprint:" + parts.join(" ");
}

function getTileStateSnapshot(x, y) {
    const terrainIdx = GameplayMap.getTerrainType(x, y);
    const biomeIdx = GameplayMap.getBiomeType(x, y);
    const elevation = GameplayMap.getElevation(x, y);
    const onRiver = GameplayMap.isRiver(x, y);
    const adjRiver = GameplayMap.isAdjacentToRivers(x, y, 1);
    const isWater = (terrainIdx === globals.g_CoastTerrain || terrainIdx === globals.g_OceanTerrain);
    const loc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(x, y));
    const cliffDirs = [];
    for (let d = 0; d < 6; d++) {
        const adj = GameplayMap.getAdjacentPlotLocation(loc, d);
        if (adj.x < 0 || adj.y < 0) continue;
        if (GameplayMap.isCliffCrossing(x, y, d)) cliffDirs.push(d);
    }
    return {
        x,
        y,
        terrainIdx,
        biomeIdx,
        terrainShort: TERRAIN_NAMES_SHORT[terrainIdx] || ("t#" + terrainIdx),
        biomeShort: BIOME_NAMES_SHORT[biomeIdx] || ("b#" + biomeIdx),
        terrainFull: TERRAIN_NAMES_FULL[terrainIdx] || ("terrain#" + terrainIdx),
        biomeFull: BIOME_NAMES_FULL[biomeIdx] || ("biome#" + biomeIdx),
        elevation,
        onRiver,
        adjRiver,
        isWater,
        cliffDirs,
    };
}

function buildOverrideStateLookup(primaryOverrides, secondaryOverrides) {
    const overrideLookup = new Map();
    const addOverrides = (items, source) => {
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            const ov = items[i];
            overrideLookup.set(ov.x + "," + ov.y, {
                origTerrain: ov.origTerrain,
                origBiome: ov.origBiome,
                source,
            });
        }
    };
    addOverrides(secondaryOverrides, "secondary");
    addOverrides(primaryOverrides, "footprint");
    return overrideLookup;
}

function countRewrittenTiles(footprintTiles, primaryOverrides, secondaryOverrides) {
    if (!footprintTiles || footprintTiles.length === 0) return 0;
    const overrideLookup = buildOverrideStateLookup(primaryOverrides, secondaryOverrides);
    let rewrittenTiles = 0;
    for (let i = 0; i < footprintTiles.length; i++) {
        const ft = footprintTiles[i];
        const ov = overrideLookup.get(ft.x + "," + ft.y);
        if (!ov) continue;
        if (ov.origTerrain !== GameplayMap.getTerrainType(ft.x, ft.y) || ov.origBiome !== GameplayMap.getBiomeType(ft.x, ft.y)) {
            rewrittenTiles++;
        }
    }
    return rewrittenTiles;
}

function buildCompactFootprintSignature(footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater) {
    if (!footprintTiles || footprintTiles.length === 0) return "sig:none";
    const parts = [];
    for (let i = 0; i < footprintTiles.length; i++) {
        const ft = footprintTiles[i];
        const tileState = getTileStateSnapshot(ft.x, ft.y);
        const flags = [];
        if (requiredTerrain && tileState.terrainFull !== requiredTerrain) flags.push("t");
        if (requiredBiome && tileState.biomeFull !== requiredBiome) flags.push("b");
        if (wonderNeedsWater !== undefined && tileState.isWater !== wonderNeedsWater) flags.push("d");
        if (tileState.onRiver) flags.push("r");
        if (tileState.adjRiver) flags.push("ar");
        if (tileState.cliffDirs.length > 0) flags.push("c" + tileState.cliffDirs.join(","));

        let adjacentWaterCount = 0;
        let adjacentRiverCount = 0;
        let adjacentAdjRiverCount = 0;
        const loc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(ft.x, ft.y));
        for (let d = 0; d < 6; d++) {
            const adj = GameplayMap.getAdjacentPlotLocation(loc, d);
            if (adj.x < 0 || adj.y < 0) continue;
            const adjState = getTileStateSnapshot(adj.x, adj.y);
            if (adjState.isWater) adjacentWaterCount++;
            if (adjState.onRiver) {
                adjacentRiverCount++;
            } else if (adjState.adjRiver) {
                adjacentAdjRiverCount++;
            }
        }

        const topology = [];
        if (adjacentWaterCount > 0) topology.push("W" + adjacentWaterCount);
        if (adjacentRiverCount > 0) topology.push("R" + adjacentRiverCount);
        if (adjacentAdjRiverCount > 0) topology.push("A" + adjacentAdjRiverCount);

        parts.push(
            "(" + ft.x + "," + ft.y + ")=" + tileState.terrainShort + "/" + tileState.biomeShort
            + (flags.length > 0 ? "!" + flags.join("") : "")
            + (topology.length > 0 ? "{" + topology.join(",") + "}" : "")
        );
    }
    return "sig:" + parts.join(" ");
}

function buildCandidateSignatureRecord(passLabel, anchorX, anchorY, dir, dist, footprintTiles, primaryOverrides, secondaryOverrides, requiredTerrain, requiredBiome, wonderNeedsWater, skippedDomainMismatch) {
    return {
        passLabel,
        anchorX,
        anchorY,
        dir,
        dist,
        rewrittenTiles: countRewrittenTiles(footprintTiles, primaryOverrides, secondaryOverrides),
        footprintSize: footprintTiles ? footprintTiles.length : 0,
        skippedDomainMismatch: skippedDomainMismatch || 0,
        signature: buildCompactFootprintSignature(footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater),
    };
}

function formatCandidateSignatureRecord(record) {
    if (!record) return "sig:none";
    let header = record.passLabel + " anchor=(" + record.anchorX + "," + record.anchorY + ") dir=" + record.dir;
    if (record.dist !== undefined && record.dist !== null) header += " dist=" + record.dist;
    header += " rewrite=" + record.rewrittenTiles + "/" + record.footprintSize;
    if (record.skippedDomainMismatch > 0) header += " skip=" + record.skippedDomainMismatch;
    return header + " " + record.signature;
}

function logNWCandidateSignature(label, featureType, record, NW_VERBOSE) {
    if (!NW_VERBOSE || !record) return;
    console.log("     diag: " + label + " feature=" + featureType + " | " + formatCandidateSignatureRecord(record));
}

function logNWAnchorWinnerSignature(featureType, anchorRecord, winnerRecord, NW_VERBOSE) {
    if (!NW_VERBOSE || !anchorRecord || !winnerRecord) return;
    console.log(
        "     diag: anchor-vs-winner feature=" + featureType
        + " | anchor " + formatCandidateSignatureRecord(anchorRecord)
        + " | winner " + formatCandidateSignatureRecord(winnerRecord)
    );
}

function buildEngineUnknownReason(x, y, eIndex, typeTagSet) {
    const actualFeature = GameplayMap.getFeatureType(x, y);
    const tagDiag = diagnoseKnownTypeTagBlocks(x, y, typeTagSet);
    const blocks = tagDiag.blockingTags.length > 0 ? tagDiag.blockingTags.join("+") : "none";
    const unresolved = tagDiag.unresolvedTags.length > 0 ? tagDiag.unresolvedTags.length : 0;
    return "engine:unknown[idx=" + actualFeature + "/" + eIndex + ",tags=" + blocks + ",u=" + unresolved + "]";
}

function buildEngineUnknownDetail(passLabel, dir, footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater) {
    return passLabel + "|dir=" + dir + "|" + buildCompactFootprintSignature(footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater);
}

function captureEngineUnknown(x, y, eIndex, typeTagSet, passLabel, dir, footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater) {
    return {
        reason: buildEngineUnknownReason(x, y, eIndex, typeTagSet),
        detail: buildEngineUnknownDetail(passLabel, dir, footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater),
        pass: passLabel,
        dir,
    };
}

// Returns a compact reason string ("terrain:FLAT≠HILL", "elev:467<600", etc.) explaining why
// canHaveFeatureParam / setFeatureType failed at (x,y).  Returns "" if no JS-visible cause found.
function collectFailReason(x, y, typeTagSet, requiredTerrain, requiredBiome, minElev, hasWaterfallTag, wonderNeedsWater) {
    const tIdx = GameplayMap.getTerrainType(x, y);
    const bIdx = GameplayMap.getBiomeType(x, y);
    const tNames = ["TERRAIN_MOUNTAIN","TERRAIN_HILL","TERRAIN_FLAT","TERRAIN_COAST","TERRAIN_OCEAN","TERRAIN_NAVIGABLE_RIVER"];
    const bNames = ["BIOME_TUNDRA","BIOME_GRASSLAND","BIOME_PLAINS","BIOME_TROPICAL","BIOME_DESERT","BIOME_MARINE"];
    const tStr = tNames[tIdx] || ("t#" + tIdx);
    const bStr = bNames[bIdx] || ("b#" + bIdx);
    const isWater = (tIdx === globals.g_CoastTerrain || tIdx === globals.g_OceanTerrain);
    const reasons = [];

    // Domain mismatch
    if (wonderNeedsWater !== undefined && wonderNeedsWater !== isWater)
        reasons.push("domain:" + (isWater ? "water" : "land") + "≠" + (wonderNeedsWater ? "water" : "land"));

    // Terrain mismatch
    if (requiredTerrain && tStr !== requiredTerrain)
        reasons.push("terrain:" + tStr.replace("TERRAIN_","") + "≠" + requiredTerrain.replace("TERRAIN_",""));

    // Biome mismatch
    if (requiredBiome && bStr !== requiredBiome)
        reasons.push("biome:" + bStr.replace("BIOME_","") + "≠" + requiredBiome.replace("BIOME_",""));

    // Elevation
    if (minElev > 0) {
        const elev = GameplayMap.getElevation(x, y);
        if (elev < minElev) reasons.push("elev:" + elev + "<" + minElev);
    }

    // Waterfall requires adjacent river
    if (hasWaterfallTag) {
        if (!GameplayMap.isRiver(x, y) && !GameplayMap.isAdjacentToRivers(x, y, 1))
            reasons.push("WATERFALL:noRiver");
    }

    // Residual TypeTags that the engine still enforces (useful when real-only SQL should have removed them)
    const tagDiag = diagnoseKnownTypeTagBlocks(x, y, typeTagSet);
    if (tagDiag.blockingTags.length > 0) reasons.push("tags:[" + tagDiag.blockingTags.join(",") + "]");
    if (tagDiag.unresolvedTags.length > 0) reasons.push("tags:unresolved=" + tagDiag.unresolvedTags.length);

    return reasons.join("|");
}

// tiles: expected tile count for this wonder (from Feature_NaturalWonders.Tiles); drives BFS depth.
// BFS depth = max(tiles-1, 1) so a 4-tile linear chain is fully discovered (needs 3 hops).
function logNWFootprint(anchorX, anchorY, featureType, tiles, NW_VERBOSE) {
    const bfsDepth = Math.max((tiles || 1) - 1, 1);
    const visited = new Set();
    visited.add(anchorX + "," + anchorY);
    // BFS frontier: each element is {x, y, depth}
    let frontier = [{ x: anchorX, y: anchorY, depth: 0 }];
    const nwTiles = [];
    while (frontier.length > 0) {
        const next = [];
        for (const node of frontier) {
            if (node.depth >= bfsDepth) continue;
            const loc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(node.x, node.y));
            for (let d = 0; d < 6; d++) {
                const a = GameplayMap.getAdjacentPlotLocation(loc, d);
                if (a.x < 0 || a.y < 0) continue;
                const key = a.x + "," + a.y;
                if (visited.has(key)) continue;
                visited.add(key);
                if (GameplayMap.isNaturalWonder(a.x, a.y)) {
                    nwTiles.push("(" + a.x + "," + a.y + ")");
                }
                next.push({ x: a.x, y: a.y, depth: node.depth + 1 });
            }
        }
        frontier = next;
    }
    const anchorKey = "(" + anchorX + "," + anchorY + ")";
    const allTiles = [anchorKey].concat(nwTiles);
    const incomplete = (tiles && tiles > 1 && allTiles.length < tiles) ? " [!" + allTiles.length + "/" + tiles + "]" : "";
    if (NW_VERBOSE) console.log("     footprint: " + allTiles.join("") + incomplete);
    return { tiles: allTiles, incomplete: incomplete !== "" };
}

function logNWPlacedFootprint(anchorX, anchorY, featureType, tiles, expectedFootprint, requiredTerrain, requiredBiome, wonderNeedsWater, NW_VERBOSE) {
    const placedFootprint = logNWFootprint(anchorX, anchorY, featureType, tiles, NW_VERBOSE);
    const signature = (expectedFootprint && expectedFootprint.length > 0)
        ? buildCompactFootprintSignature(expectedFootprint, requiredTerrain, requiredBiome, wonderNeedsWater)
        : null;
    if (NW_VERBOSE && signature && getNWPlacementMode() !== "real-only") {
        console.log("     diag: success " + signature);
    }
    return { tiles: placedFootprint.tiles, incomplete: placedFootprint.incomplete, signature };
}

export function placeCustomNaturalWonders(mapName) {
    console.log("YNAMP - Place Custom Natural Wonders for map " + mapName);
    let numPlaced = 0;
    const placedFeatureHashes = new Set();
    // NW_VERBOSE: set true to re-enable old per-direction/per-candidate verbose logs
    const NW_VERBOSE = true;
    const postOverrideVerbose = NW_VERBOSE && getNWPlacementMode() === "real-only";
    // nwStatusMap: keyed by FeatureType; tracks placement result and all failed tries
    // Entry shape: { placementClass, tiles, tries:[{x,y,dir,pass,reason}], placed:{x,y,dir,pass,forced,footprint} | null }
    const nwStatusMap = new Map();

    // Decode indices to strings for logging
    const terrainToStr = ["TERRAIN_MOUNTAIN", "TERRAIN_HILL", "TERRAIN_FLAT", "TERRAIN_COAST", "TERRAIN_OCEAN", "TERRAIN_NAVIGABLE_RIVER"];
    const biomeToStr   = ["BIOME_TUNDRA", "BIOME_GRASSLAND", "BIOME_PLAINS", "BIOME_TROPICAL", "BIOME_DESERT", "BIOME_MARINE"];

    // Encode strings to globals indices for setTerrainType / setBiomeType
    const terrainFromStr = {
        "TERRAIN_MOUNTAIN":        globals.g_MountainTerrain,
        "TERRAIN_HILL":            globals.g_HillTerrain,
        "TERRAIN_FLAT":            globals.g_FlatTerrain,
        "TERRAIN_COAST":           globals.g_CoastTerrain,
        "TERRAIN_OCEAN":           globals.g_OceanTerrain,
        "TERRAIN_NAVIGABLE_RIVER": globals.g_NavigableRiverTerrain,
    };
    const biomeFromStr = {
        "BIOME_TUNDRA":    globals.g_TundraBiome,
        "BIOME_GRASSLAND": globals.g_GrasslandBiome,
        "BIOME_PLAINS":    globals.g_PlainsBiome,
        "BIOME_TROPICAL":  globals.g_TropicalBiome,
        "BIOME_DESERT":    globals.g_DesertBiome,
        "BIOME_MARINE":    globals.g_MarineBiome,
    };

    // Pre-build a Set of feature types that carry the WATERFALL tag (checked once, O(1) per NW)
    const waterfallFeatureTypes = new Set(
        GameInfo.TypeTags.filter(tt => tt.Tag === "WATERFALL").map(tt => tt.Type)
    );

    // Pre-build per-NW metadata maps (MinimumElevation, TypeTag set) for diagnostic logging
    const nwMinElevMap  = {};  // featureType -> number (0 if not set)
    const nwTypeTagsMap = {};  // featureType -> Set<string>
    for (let i = 0; i < GameInfo.Features.length; i++) {
        const f = GameInfo.Features[i];
        nwMinElevMap[f.FeatureType] = f.MinimumElevation || 0;
    }
    for (let i = 0; i < GameInfo.TypeTags.length; i++) {
        const tt = GameInfo.TypeTags[i];
        if (!nwTypeTagsMap[tt.Type]) nwTypeTagsMap[tt.Type] = new Set();
        nwTypeTagsMap[tt.Type].add(tt.Tag);
    }

    // Group NaturalWonderPosition rows by FeatureType preserving order of first appearance.
    // First row per FeatureType = anchor tile; subsequent rows = secondary pre-condition tiles.
    const nwOrder  = [];  // ordered list of featureType strings
    const nwGroups = {};  // featureType -> { anchor: row, secondary: [row, ...] }
    for (let i = 0; i < GameInfo.NaturalWonderPosition.length; ++i) {
        const r = GameInfo.NaturalWonderPosition[i];
        if (r.MapName != mapName) continue;
        if (!nwGroups[r.FeatureType]) {
            nwGroups[r.FeatureType] = { anchor: r, secondary: [] };
            nwOrder.push(r.FeatureType);
        } else {
            nwGroups[r.FeatureType].secondary.push(r);
        }
    }

    for (let gi = 0; gi < nwOrder.length; gi++) {
        const featureType = nwOrder[gi];
        const group = nwGroups[featureType];
        const row = group.anchor;
        const eFeature = Database.makeHash(row.FeatureType);
        const eIndex = GameInfo.Features.lookup(row.FeatureType)?.$index ?? -1;  // DB row index returned by GameplayMap.getFeatureType()
        const nwDef = GameInfo.Feature_NaturalWonders.lookup(eFeature);
        // Init tracking entry for this NW
        const _nwFeat = GameInfo.Features ? Array.from(GameInfo.Features).find(f => f.FeatureType === row.FeatureType) : null;
        const placementClass = (_nwFeat && _nwFeat.PlacementClass) ? _nwFeat.PlacementClass : "ONE";
        nwStatusMap.set(row.FeatureType, {
            placementClass: (_nwFeat && _nwFeat.PlacementClass) ? _nwFeat.PlacementClass : "?",
            tiles: (nwDef && nwDef.Tiles) ? nwDef.Tiles : 1,
            searchRadius: 0,
            anchorSignature: null,
            tries: [],
            placed: null,
        });
        if (nwDef == null) {
            console.log("   - " + row.FeatureType + " : not a valid natural wonder (DLC not active?), skipping");
            continue;
        }

        // Determine wonder's required terrain and biome (first valid entry each)
        let requiredTerrain = null;
        let requiredBiome   = null;
        for (let j = 0; j < GameInfo.Feature_ValidTerrains.length; j++) {
            const vt = GameInfo.Feature_ValidTerrains[j];
            if (vt.FeatureType === row.FeatureType) { requiredTerrain = vt.TerrainType; break; }
        }
        for (let j = 0; j < GameInfo.Feature_ValidBiomes.length; j++) {
            const vb = GameInfo.Feature_ValidBiomes[j];
            if (vb.FeatureType === row.FeatureType) { requiredBiome = vb.BiomeType; break; }
        }
        const hasWaterfallTag = waterfallFeatureTypes.has(row.FeatureType);
        const wonderNeedsWater = (requiredTerrain === "TERRAIN_COAST");
        const minElev   = nwMinElevMap[row.FeatureType]  || 0;
        const typeTagSet = nwTypeTagsMap[row.FeatureType] || new Set();

        // Direction hint from XML: -1 = try all 6; >= 0 = try that direction first, then others as fallback
        const dirHint = (row.Direction !== undefined && row.Direction !== null && row.Direction >= 0) ? row.Direction : -1;
        const dirList = [];
        if (dirHint >= 0) {
            dirList.push(dirHint);
            for (let k = 0; k < 6; k++) { if (k !== dirHint) dirList.push(k); }
        } else {
            // Randomize starting direction to explore all PlacementClass directions across multiple runs
            const startDir = Math.floor(Math.random() * 6);
            for (let k = 0; k < 6; k++) dirList.push((startDir + k) % 6);
        }

        // Pre-condition secondary tiles from XML (Civ6-style per-tile approach).
        // Save originals so they can be reverted if placement fails.
        const secondaryOverrides = [];
        const secondarySet = new Set();
        for (let si = 0; si < group.secondary.length; si++) {
            const sec = group.secondary[si];
            const secTerrainStr = sec.TerrainType || requiredTerrain;
            if (secTerrainStr === null || terrainFromStr[secTerrainStr] === undefined) continue;
            const origTerrain = GameplayMap.getTerrainType(sec.X, sec.Y);
            const origBiome   = GameplayMap.getBiomeType(sec.X, sec.Y);
            TerrainBuilder.setTerrainType(sec.X, sec.Y, terrainFromStr[secTerrainStr]);
            // Infer biome: use required biome if defined, else marine for water terrain
            const secBiomeStr = requiredBiome !== null ? requiredBiome
                : (secTerrainStr === "TERRAIN_COAST" || secTerrainStr === "TERRAIN_OCEAN" ? "BIOME_MARINE" : null);
            if (secBiomeStr !== null && biomeFromStr[secBiomeStr] !== undefined) {
                TerrainBuilder.setBiomeType(sec.X, sec.Y, biomeFromStr[secBiomeStr]);
            }
            secondaryOverrides.push({ x: sec.X, y: sec.Y, origTerrain, origBiome });
            secondarySet.add(sec.X + "," + sec.Y);
        }

        // --- Pass 1: try placement with current terrain/biome (+ pre-conditioned secondary tiles) ---
        let placed = false;
        let iElevation = GameplayMap.getElevation(row.X, row.Y);
        let anchorEngineUnknown = null;
        for (let di = 0; di < dirList.length; di++) {
            const d = dirList[di];
            const featureParam = { Feature: eFeature, Direction: d, Elevation: iElevation };
            if (TerrainBuilder.canHaveFeatureParam(row.X, row.Y, featureParam)) {
                const anchorFootprint = getFootprintTiles(row.X, row.Y, placementClass, d);
                TerrainBuilder.setFeatureType(row.X, row.Y, featureParam);
                if (GameplayMap.getFeatureType(row.X, row.Y) === eIndex) {
                    placedFeatureHashes.add(eFeature);
                    numPlaced++;
                    placed = true;
                    // Revert secondary pre-conditions that are NOT part of the placed NW
                    let revertedCount = 0;
                    for (let k = 0; k < secondaryOverrides.length; k++) {
                        const ov = secondaryOverrides[k];
                        if (!GameplayMap.isNaturalWonder(ov.x, ov.y)) {
                            TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                            TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                            revertedCount++;
                        }
                    }
                    const hintNote = (dirHint >= 0 && d !== dirHint) ? " [dir-hint=" + dirHint + " fallback]" : "";
                    const secNote  = group.secondary.length > 0
                        ? " [secondary: " + group.secondary.length + " pre-conditioned"
                            + (revertedCount > 0 ? ", " + revertedCount + " reverted" : "") + "]"
                        : "";
                    if (NW_VERBOSE) console.log("   - " + row.FeatureType + " placed at (" + row.X + ", " + row.Y + ") dir=" + d + hintNote + secNote);
                    const _fp1 = logNWPlacedFootprint(row.X, row.Y, row.FeatureType, nwStatusMap.get(row.FeatureType).tiles, anchorFootprint, requiredTerrain, requiredBiome, wonderNeedsWater, NW_VERBOSE);
                    nwStatusMap.get(row.FeatureType).placed = { x: row.X, y: row.Y, dir: d, pass: (group.secondary.length > 0 ? "P1-sec" : "P1"), forced: false, footprint: _fp1.tiles, incomplete: _fp1.incomplete, signature: _fp1.signature };
                    break;
                }
                if (anchorEngineUnknown == null) {
                    anchorEngineUnknown = captureEngineUnknown(row.X, row.Y, eIndex, typeTagSet, (group.secondary.length > 0 ? "P1-sec" : "P1"), d, anchorFootprint, requiredTerrain, requiredBiome, wonderNeedsWater);
                }
            }
        }
        if (placed) continue;

        // --- Pass 1 failed: read actual tile state ---
        const actualTerrainIdx = GameplayMap.getTerrainType(row.X, row.Y);
        const actualBiomeIdx   = GameplayMap.getBiomeType(row.X, row.Y);
        const actualElev       = GameplayMap.getElevation(row.X, row.Y);
        const actualTerrainStr = terrainToStr[actualTerrainIdx] || ("terrain#" + actualTerrainIdx);
        const actualBiomeStr   = biomeToStr[actualBiomeIdx]     || ("biome#"   + actualBiomeIdx);

        const tileIsWater = (actualTerrainIdx === globals.g_CoastTerrain || actualTerrainIdx === globals.g_OceanTerrain);

        if (wonderNeedsWater !== tileIsWater) {
            // Wrong domain — terrain override cannot help; revert secondary pre-conditions
            for (let k = 0; k < secondaryOverrides.length; k++) {
                const ov = secondaryOverrides[k];
                TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
            }
            if (NW_VERBOSE) console.log("   - " + row.FeatureType + " SKIPPED at (" + row.X + ", " + row.Y + ") domain mismatch");
            nwStatusMap.get(row.FeatureType).tries.push({ x: row.X, y: row.Y, dir: -1, pass: "anchor", reason: "domain:" + (tileIsWater ? "water" : "land") + "≠" + (wonderNeedsWater ? "water" : "land") });
            continue;
        }

        iElevation = GameplayMap.getElevation(row.X, row.Y);
        for (let di = 0; di < dirList.length; di++) {
            const d = dirList[di];
            const footprintTiles = getFootprintTiles(row.X, row.Y, placementClass, d);
            if (!footprintTiles || footprintTiles.length === 0) continue;

            // Pass-2 override transaction: convert the whole expected footprint before trying placement,
            // but keep land/water domain boundaries intact.
            const overrides = [];
            let skippedDomainMismatch = 0;
            for (let fi = 0; fi < footprintTiles.length; fi++) {
                const ft = footprintTiles[fi];
                const key = ft.x + "," + ft.y;
                if (secondarySet.has(key)) continue; // already pre-conditioned above
                const curTerrain = GameplayMap.getTerrainType(ft.x, ft.y);
                const curBiome = GameplayMap.getBiomeType(ft.x, ft.y);
                const curIsWater = (curTerrain === globals.g_CoastTerrain || curTerrain === globals.g_OceanTerrain);
                if (curIsWater !== wonderNeedsWater) {
                    skippedDomainMismatch++;
                    continue;
                }
                overrides.push({ x: ft.x, y: ft.y, origTerrain: curTerrain, origBiome: curBiome });
                if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined) {
                    TerrainBuilder.setTerrainType(ft.x, ft.y, terrainFromStr[requiredTerrain]);
                }
                if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined) {
                    TerrainBuilder.setBiomeType(ft.x, ft.y, biomeFromStr[requiredBiome]);
                }
            }

            // Also override anchor terrain/biome to match requirements, not just footprint tiles.
            const anchorOrigT = GameplayMap.getTerrainType(row.X, row.Y);
            const anchorOrigB = GameplayMap.getBiomeType(row.X, row.Y);
            const needAnchorOvr = (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && anchorOrigT !== terrainFromStr[requiredTerrain])
                || (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && anchorOrigB !== biomeFromStr[requiredBiome]);
            if (needAnchorOvr) {
                if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && anchorOrigT !== terrainFromStr[requiredTerrain])
                    TerrainBuilder.setTerrainType(row.X, row.Y, terrainFromStr[requiredTerrain]);
                if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && anchorOrigB !== biomeFromStr[requiredBiome])
                    TerrainBuilder.setBiomeType(row.X, row.Y, biomeFromStr[requiredBiome]);
            }
            const anchorSignatureRecord = buildCandidateSignatureRecord("anchorP2", row.X, row.Y, d, null, footprintTiles, overrides, secondaryOverrides, requiredTerrain, requiredBiome, wonderNeedsWater, skippedDomainMismatch);
            if (postOverrideVerbose && nwStatusMap.get(row.FeatureType).anchorSignature == null) {
                nwStatusMap.get(row.FeatureType).anchorSignature = anchorSignatureRecord;
                logNWCandidateSignature("anchorSig", row.FeatureType, anchorSignatureRecord, postOverrideVerbose);
            }
            const featureParam = { Feature: eFeature, Direction: d, Elevation: iElevation };
            if (TerrainBuilder.canHaveFeatureParam(row.X, row.Y, featureParam)) {
                TerrainBuilder.setFeatureType(row.X, row.Y, featureParam);
                if (GameplayMap.getFeatureType(row.X, row.Y) === eIndex) {
                    placedFeatureHashes.add(eFeature);
                    numPlaced++;
                    placed = true;
                    logNWCandidateSignature("winnerSig", row.FeatureType, anchorSignatureRecord, postOverrideVerbose);
                    // Revert footprint overrides + secondary tiles that are NOT part of the placed NW
                    let revertedCount = 0;
                    for (let k = 0; k < overrides.length; k++) {
                        const ov = overrides[k];
                        if (!GameplayMap.isNaturalWonder(ov.x, ov.y)) {
                            TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                            TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                            revertedCount++;
                        }
                    }
                    for (let k = 0; k < secondaryOverrides.length; k++) {
                        const ov = secondaryOverrides[k];
                        if (!GameplayMap.isNaturalWonder(ov.x, ov.y)) {
                            TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                            TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                            revertedCount++;
                        }
                    }
                    const dmNote = skippedDomainMismatch > 0 ? " mismatchSkip=" + skippedDomainMismatch : "";
                    if (NW_VERBOSE) console.log("   - " + row.FeatureType + " (GameplayMap.getFeatureType = " + GameplayMap.getFeatureType(row.X, row.Y) + ") placed at (" + row.X + ", " + row.Y + ") dir=" + d + " [footprint:" + footprintTiles.length + dmNote + "]");
                    const _fp2 = logNWPlacedFootprint(row.X, row.Y, row.FeatureType, nwStatusMap.get(row.FeatureType).tiles, footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater, NW_VERBOSE);
                    nwStatusMap.get(row.FeatureType).placed = { x: row.X, y: row.Y, dir: d, pass: "P2", forced: false, footprint: _fp2.tiles, incomplete: _fp2.incomplete, signature: _fp2.signature };
                    break;
                }
                if (anchorEngineUnknown == null) {
                    anchorEngineUnknown = captureEngineUnknown(row.X, row.Y, eIndex, typeTagSet, "P2", d, footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater);
                }
            }

            // Revert this direction attempt before trying another direction.
            if (needAnchorOvr) {
                TerrainBuilder.setTerrainType(row.X, row.Y, anchorOrigT);
                TerrainBuilder.setBiomeType(row.X, row.Y, anchorOrigB);
            }
            for (let k = 0; k < overrides.length; k++) {
                const ov = overrides[k];
                TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
            }
        }
        if (!placed && !hasWaterfallTag) {
            // --- Pass 3: forced placement — bypass canHaveFeatureParam, verify via getFeatureType ---
            // Use getFeatureType(ax,ay) === eIndex (DB row index), NOT isNaturalWonder:
            // isNaturalWonder returns true for ANY NW on that tile, giving false positives if another
            // NW was placed there via range-based search. getFeatureType identifies the specific NW.
            const forcedElevation = (minElev > 0 && iElevation < minElev) ? minElev : iElevation;
            for (let di = 0; di < dirList.length; di++) {
                const d = dirList[di];
                const footprintTiles = getFootprintTiles(row.X, row.Y, placementClass, d);
                if (!footprintTiles || footprintTiles.length === 0) continue;

                const overrides = [];
                for (let fi = 0; fi < footprintTiles.length; fi++) {
                    const ft = footprintTiles[fi];
                    const key = ft.x + "," + ft.y;
                    if (secondarySet.has(key)) continue;
                    const curTerrain = GameplayMap.getTerrainType(ft.x, ft.y);
                    const curBiome = GameplayMap.getBiomeType(ft.x, ft.y);
                    const curIsWater = (curTerrain === globals.g_CoastTerrain || curTerrain === globals.g_OceanTerrain);
                    if (curIsWater !== wonderNeedsWater) continue;
                    overrides.push({ x: ft.x, y: ft.y, origTerrain: curTerrain, origBiome: curBiome });
                    if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined) {
                        TerrainBuilder.setTerrainType(ft.x, ft.y, terrainFromStr[requiredTerrain]);
                    }
                    if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined) {
                        TerrainBuilder.setBiomeType(ft.x, ft.y, biomeFromStr[requiredBiome]);
                    }
                }

                // Also override anchor terrain/biome (forced pass).
                const anchorOrigT = GameplayMap.getTerrainType(row.X, row.Y);
                const anchorOrigB = GameplayMap.getBiomeType(row.X, row.Y);
                const needAnchorOvr = (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && anchorOrigT !== terrainFromStr[requiredTerrain])
                    || (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && anchorOrigB !== biomeFromStr[requiredBiome]);
                if (needAnchorOvr) {
                    if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && anchorOrigT !== terrainFromStr[requiredTerrain])
                        TerrainBuilder.setTerrainType(row.X, row.Y, terrainFromStr[requiredTerrain]);
                    if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && anchorOrigB !== biomeFromStr[requiredBiome])
                        TerrainBuilder.setBiomeType(row.X, row.Y, biomeFromStr[requiredBiome]);
                }
                const featureParam = { Feature: eFeature, Direction: d, Elevation: forcedElevation };
                TerrainBuilder.setFeatureType(row.X, row.Y, featureParam);
                if (GameplayMap.getFeatureType(row.X, row.Y) === eIndex) {
                    placedFeatureHashes.add(eFeature);
                    numPlaced++;
                    placed = true;
                    const forcedAnchorSignatureRecord = buildCandidateSignatureRecord("anchorP3", row.X, row.Y, d, null, footprintTiles, overrides, secondaryOverrides, requiredTerrain, requiredBiome, wonderNeedsWater, 0);
                    logNWCandidateSignature("winnerSig", row.FeatureType, forcedAnchorSignatureRecord, postOverrideVerbose);
                    // Revert footprint overrides + secondary tiles that are NOT part of the placed NW
                    let revertedCount = 0;
                    for (let k = 0; k < overrides.length; k++) {
                        const ov = overrides[k];
                        if (!GameplayMap.isNaturalWonder(ov.x, ov.y)) {
                            TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                            TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                            revertedCount++;
                        }
                    }
                    for (let k = 0; k < secondaryOverrides.length; k++) {
                        const ov = secondaryOverrides[k];
                        if (!GameplayMap.isNaturalWonder(ov.x, ov.y)) {
                            TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                            TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                            revertedCount++;
                        }
                    }
                    if (NW_VERBOSE) console.log("   - " + row.FeatureType + " FORCED at (" + row.X + ", " + row.Y + ") dir=" + d + " [cluster:" + overrides.length + "]");
                    const _fp3 = logNWPlacedFootprint(row.X, row.Y, row.FeatureType, nwStatusMap.get(row.FeatureType).tiles, footprintTiles, requiredTerrain, requiredBiome, wonderNeedsWater, NW_VERBOSE);
                    nwStatusMap.get(row.FeatureType).placed = { x: row.X, y: row.Y, dir: d, pass: "P3", forced: true, footprint: _fp3.tiles, incomplete: _fp3.incomplete, signature: _fp3.signature };
                    break;
                }

                if (needAnchorOvr) {
                    TerrainBuilder.setTerrainType(row.X, row.Y, anchorOrigT);
                    TerrainBuilder.setBiomeType(row.X, row.Y, anchorOrigB);
                }
                for (let k = 0; k < overrides.length; k++) {
                    const ov = overrides[k];
                    TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                    TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                }
            }
        }
        if (!placed) {
            // Revert pre-conditioned secondary tiles.
            for (let k = 0; k < secondaryOverrides.length; k++) {
                const ov = secondaryOverrides[k];
                TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
            }
            const _anchorReason = collectFailReason(row.X, row.Y, typeTagSet, requiredTerrain, requiredBiome, minElev, hasWaterfallTag, wonderNeedsWater);
            // If terrain/biome already matched but engine still rejected, label it engine:unknown (not plain engine-reject)
            let _anchorLabel = _anchorReason;
            if (!_anchorReason) {
                const tIdx2 = GameplayMap.getTerrainType(row.X, row.Y);
                const bIdx2 = GameplayMap.getBiomeType(row.X, row.Y);
                const tNames2 = ["TERRAIN_MOUNTAIN","TERRAIN_HILL","TERRAIN_FLAT","TERRAIN_COAST","TERRAIN_OCEAN","TERRAIN_NAVIGABLE_RIVER"];
                const bNames2 = ["BIOME_TUNDRA","BIOME_GRASSLAND","BIOME_PLAINS","BIOME_TROPICAL","BIOME_DESERT","BIOME_MARINE"];
                const tMatch = !requiredTerrain || (tNames2[tIdx2] === requiredTerrain);
                const bMatch = !requiredBiome  || (bNames2[bIdx2] === requiredBiome);
                _anchorLabel = (tMatch && bMatch) ? (anchorEngineUnknown ? anchorEngineUnknown.reason : buildEngineUnknownReason(row.X, row.Y, eIndex, typeTagSet)) : (hasWaterfallTag ? "WATERFALL:noForced" : "engine-reject");
            }
            // Store searchRadius on entry so the summary block can report it
            const searchRadius = (row.SearchRadius !== undefined && row.SearchRadius !== null) ? row.SearchRadius : 0;
            nwStatusMap.get(row.FeatureType).searchRadius = searchRadius;
            nwStatusMap.get(row.FeatureType).tries.push({ x: row.X, y: row.Y, dir: anchorEngineUnknown ? anchorEngineUnknown.dir : "all", pass: anchorEngineUnknown ? anchorEngineUnknown.pass : "anchor", reason: _anchorLabel, detail: anchorEngineUnknown ? anchorEngineUnknown.detail : undefined });
            if (NW_VERBOSE) {
                const anchorFp = getFootprintTiles(row.X, row.Y, placementClass, dirList[0]);
                logNWDiagnostic(row.X, row.Y, typeTagSet, minElev, requiredTerrain, requiredBiome, anchorFp);
                if (anchorEngineUnknown && anchorEngineUnknown.detail) {
                    console.log("     diag: " + anchorEngineUnknown.detail);
                } else {
                        console.log("     diag: anchor " + buildCompactFootprintSignature(anchorFp, requiredTerrain, requiredBiome, wonderNeedsWater));
                }
            }
            if (searchRadius > 0) {
                const iWidth  = GameplayMap.getGridWidth();
                const iHeight = GameplayMap.getGridHeight();
                // Collect candidates sorted by hex distance
                const candidates = [];
                for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        const cx = ((row.X + dx) % iWidth + iWidth) % iWidth;
                        const cy = row.Y + dy;
                        if (cy < 0 || cy >= iHeight) continue;
                        const dist = GameplayMap.getPlotDistance(row.X, row.Y, cx, cy);
                        if (dist > 0 && dist <= searchRadius) candidates.push({ x: cx, y: cy, dist });
                    }
                }
                candidates.sort((a, b) => a.dist - b.dist);
                if (NW_VERBOSE) console.log("     range: " + candidates.length + " candidates (radius " + searchRadius + ")");
                const NW_MAX_TRIES = 20;
                let storedRangeFails = 0;
                for (let ci = 0; ci < candidates.length && !placed; ci++) {
                    let cEngineUnknown = null;
                    const cx = candidates[ci].x;
                    const cy = candidates[ci].y;
                    const dist = candidates[ci].dist;
                    // Domain check
                    const cTIdx = GameplayMap.getTerrainType(cx, cy);
                    const cIsWater = (cTIdx === globals.g_CoastTerrain || cTIdx === globals.g_OceanTerrain);
                    if (cIsWater !== wonderNeedsWater) continue;
                    // TypeTag pre-filters (only what JS can check)
                    if (hasWaterfallTag && !GameplayMap.isRiver(cx, cy)) continue;
                    if (minElev > 0 && GameplayMap.getElevation(cx, cy) < minElev) continue;
                    if (typeTagSet.has("NOTADJACENTTORIVER") && GameplayMap.isAdjacentToRivers(cx, cy, 1)) continue;
                    const cBIdx = GameplayMap.getBiomeType(cx, cy);
                    const cElev = GameplayMap.getElevation(cx, cy);
                    // Pass 1
                    let cPlaced = false;
                    for (let di = 0; di < dirList.length && !cPlaced; di++) {
                        const d = dirList[di];
                        if (TerrainBuilder.canHaveFeatureParam(cx, cy, { Feature: eFeature, Direction: d, Elevation: cElev })) {
                            const cFootprint = getFootprintTiles(cx, cy, placementClass, d);
                            TerrainBuilder.setFeatureType(cx, cy, { Feature: eFeature, Direction: d, Elevation: cElev });
                            if (GameplayMap.getFeatureType(cx, cy) === eIndex) {
                                placedFeatureHashes.add(eFeature);
                                numPlaced++; placed = true; cPlaced = true;
                                const winnerSignatureRecord = buildCandidateSignatureRecord("rangeP1", cx, cy, d, dist, cFootprint, null, null, requiredTerrain, requiredBiome, wonderNeedsWater, 0);
                                logNWCandidateSignature("winnerSig", row.FeatureType, winnerSignatureRecord, postOverrideVerbose);
                                logNWAnchorWinnerSignature(row.FeatureType, nwStatusMap.get(row.FeatureType).anchorSignature, winnerSignatureRecord, postOverrideVerbose);
                                if (NW_VERBOSE) console.log("   - " + row.FeatureType + " placed at (" + cx + "," + cy + ") dir=" + d + " [range P1, dist=" + dist + "]");
                                const _rfp1 = logNWPlacedFootprint(cx, cy, row.FeatureType, nwStatusMap.get(row.FeatureType).tiles, cFootprint, requiredTerrain, requiredBiome, wonderNeedsWater, NW_VERBOSE);
                                nwStatusMap.get(row.FeatureType).placed = { x: cx, y: cy, dir: d, pass: "rangeP1", forced: false, footprint: _rfp1.tiles, incomplete: _rfp1.incomplete, dist, signature: _rfp1.signature };
                            } else if (cEngineUnknown == null) {
                                cEngineUnknown = captureEngineUnknown(cx, cy, eIndex, typeTagSet, "rangeP1", d, cFootprint, requiredTerrain, requiredBiome, wonderNeedsWater);
                            }
                        }
                    }
                    if (cPlaced) break;
                    const cElev2 = GameplayMap.getElevation(cx, cy);
                    for (let di = 0; di < dirList.length && !cPlaced; di++) {
                        const d = dirList[di];
                        const cFootprint = getFootprintTiles(cx, cy, placementClass, d);
                        if (!cFootprint || cFootprint.length === 0) continue;
                        const cOvs = [];
                        let cSkippedDomainMismatch = 0;
                        for (let fi = 0; fi < cFootprint.length; fi++) {
                            const ft = cFootprint[fi];
                            const cCurT = GameplayMap.getTerrainType(ft.x, ft.y);
                            const cCurB = GameplayMap.getBiomeType(ft.x, ft.y);
                            const cCurW = (cCurT === globals.g_CoastTerrain || cCurT === globals.g_OceanTerrain);
                            if (cCurW !== wonderNeedsWater) {
                                cSkippedDomainMismatch++;
                                continue;
                            }
                            cOvs.push({ x: ft.x, y: ft.y, origTerrain: cCurT, origBiome: cCurB });
                            if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined)
                                TerrainBuilder.setTerrainType(ft.x, ft.y, terrainFromStr[requiredTerrain]);
                            if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined)
                                TerrainBuilder.setBiomeType(ft.x, ft.y, biomeFromStr[requiredBiome]);
                        }
                        // Also override anchor terrain/biome for this range candidate.
                        const cAnchorOrigT = GameplayMap.getTerrainType(cx, cy);
                        const cAnchorOrigB = GameplayMap.getBiomeType(cx, cy);
                        const needCAnchorOvr = (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && cAnchorOrigT !== terrainFromStr[requiredTerrain])
                            || (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && cAnchorOrigB !== biomeFromStr[requiredBiome]);
                        if (needCAnchorOvr) {
                            if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && cAnchorOrigT !== terrainFromStr[requiredTerrain])
                                TerrainBuilder.setTerrainType(cx, cy, terrainFromStr[requiredTerrain]);
                            if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && cAnchorOrigB !== biomeFromStr[requiredBiome])
                                TerrainBuilder.setBiomeType(cx, cy, biomeFromStr[requiredBiome]);
                        }
                        const winnerSignatureRecord = buildCandidateSignatureRecord("rangeP2", cx, cy, d, dist, cFootprint, cOvs, null, requiredTerrain, requiredBiome, wonderNeedsWater, cSkippedDomainMismatch);
                        if (TerrainBuilder.canHaveFeatureParam(cx, cy, { Feature: eFeature, Direction: d, Elevation: cElev2 })) {
                            TerrainBuilder.setFeatureType(cx, cy, { Feature: eFeature, Direction: d, Elevation: cElev2 });
                            if (GameplayMap.getFeatureType(cx, cy) === eIndex) {
                                placedFeatureHashes.add(eFeature);
                                numPlaced++; placed = true; cPlaced = true;
                                let cRev = 0;
                                for (let k = 0; k < cOvs.length; k++) {
                                    const ov = cOvs[k];
                                    if (!GameplayMap.isNaturalWonder(ov.x, ov.y)) {
                                        TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                                        TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                                        cRev++;
                                    }
                                }
                                logNWCandidateSignature("winnerSig", row.FeatureType, winnerSignatureRecord, postOverrideVerbose);
                                logNWAnchorWinnerSignature(row.FeatureType, nwStatusMap.get(row.FeatureType).anchorSignature, winnerSignatureRecord, postOverrideVerbose);
                                if (NW_VERBOSE) console.log("   - " + row.FeatureType + " placed at (" + cx + "," + cy + ") dir=" + d + " [range P2 footprint=" + cFootprint.length + ", dist=" + dist + "]");
                                const _rfp2 = logNWPlacedFootprint(cx, cy, row.FeatureType, nwStatusMap.get(row.FeatureType).tiles, cFootprint, requiredTerrain, requiredBiome, wonderNeedsWater, NW_VERBOSE);
                                nwStatusMap.get(row.FeatureType).placed = { x: cx, y: cy, dir: d, pass: "rangeP2", forced: false, footprint: _rfp2.tiles, incomplete: _rfp2.incomplete, dist, signature: _rfp2.signature };
                            } else if (cEngineUnknown == null) {
                                cEngineUnknown = captureEngineUnknown(cx, cy, eIndex, typeTagSet, "rangeP2", d, cFootprint, requiredTerrain, requiredBiome, wonderNeedsWater);
                            }
                        }
                        if (!cPlaced) {
                            if (needCAnchorOvr) {
                                TerrainBuilder.setTerrainType(cx, cy, cAnchorOrigT);
                                TerrainBuilder.setBiomeType(cx, cy, cAnchorOrigB);
                            }
                            for (let k = 0; k < cOvs.length; k++) {
                                const ov = cOvs[k];
                                TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                                TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                            }
                        }
                    }
                    if (!cPlaced && !hasWaterfallTag) {
                        // Pass 3 forced
                        const cFElev = (minElev > 0 && cElev2 < minElev) ? minElev : cElev2;
                        for (let di = 0; di < dirList.length && !cPlaced; di++) {
                            const d = dirList[di];
                            const cFootprint = getFootprintTiles(cx, cy, placementClass, d);
                            if (!cFootprint || cFootprint.length === 0) continue;
                            const cOvs = [];
                            for (let fi = 0; fi < cFootprint.length; fi++) {
                                const ft = cFootprint[fi];
                                const cCurT = GameplayMap.getTerrainType(ft.x, ft.y);
                                const cCurB = GameplayMap.getBiomeType(ft.x, ft.y);
                                const cCurW = (cCurT === globals.g_CoastTerrain || cCurT === globals.g_OceanTerrain);
                                if (cCurW !== wonderNeedsWater) continue;
                                cOvs.push({ x: ft.x, y: ft.y, origTerrain: cCurT, origBiome: cCurB });
                                if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined)
                                    TerrainBuilder.setTerrainType(ft.x, ft.y, terrainFromStr[requiredTerrain]);
                                if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined)
                                    TerrainBuilder.setBiomeType(ft.x, ft.y, biomeFromStr[requiredBiome]);
                            }
                            // Also override anchor terrain/biome for forced range candidate.
                            const cFAnchorOrigT = GameplayMap.getTerrainType(cx, cy);
                            const cFAnchorOrigB = GameplayMap.getBiomeType(cx, cy);
                            const needCFAnchorOvr = (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && cFAnchorOrigT !== terrainFromStr[requiredTerrain])
                                || (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && cFAnchorOrigB !== biomeFromStr[requiredBiome]);
                            if (needCFAnchorOvr) {
                                if (requiredTerrain !== null && terrainFromStr[requiredTerrain] !== undefined && cFAnchorOrigT !== terrainFromStr[requiredTerrain])
                                    TerrainBuilder.setTerrainType(cx, cy, terrainFromStr[requiredTerrain]);
                                if (requiredBiome !== null && biomeFromStr[requiredBiome] !== undefined && cFAnchorOrigB !== biomeFromStr[requiredBiome])
                                    TerrainBuilder.setBiomeType(cx, cy, biomeFromStr[requiredBiome]);
                            }
                            TerrainBuilder.setFeatureType(cx, cy, { Feature: eFeature, Direction: d, Elevation: cFElev });
                            if (GameplayMap.getFeatureType(cx, cy) === eIndex) {
                                placedFeatureHashes.add(eFeature);
                                numPlaced++; placed = true; cPlaced = true;
                                const winnerSignatureRecord = buildCandidateSignatureRecord("rangeP3", cx, cy, d, dist, cFootprint, cOvs, null, requiredTerrain, requiredBiome, wonderNeedsWater, 0);
                                logNWCandidateSignature("winnerSig", row.FeatureType, winnerSignatureRecord, postOverrideVerbose);
                                logNWAnchorWinnerSignature(row.FeatureType, nwStatusMap.get(row.FeatureType).anchorSignature, winnerSignatureRecord, postOverrideVerbose);
                                let cRev = 0;
                                for (let k = 0; k < cOvs.length; k++) {
                                    const ov = cOvs[k];
                                    if (!GameplayMap.isNaturalWonder(ov.x, ov.y)) {
                                        TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                                        TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                                        cRev++;
                                    }
                                }
                                if (NW_VERBOSE) console.log("   - " + row.FeatureType + " FORCED at (" + cx + "," + cy + ") dir=" + d + " [range P3 footprint=" + cFootprint.length + ", dist=" + dist + "]");
                                const _rfp3 = logNWPlacedFootprint(cx, cy, row.FeatureType, nwStatusMap.get(row.FeatureType).tiles, cFootprint, requiredTerrain, requiredBiome, wonderNeedsWater, NW_VERBOSE);
                                nwStatusMap.get(row.FeatureType).placed = { x: cx, y: cy, dir: d, pass: "rangeP3", forced: true, footprint: _rfp3.tiles, incomplete: _rfp3.incomplete, dist, signature: _rfp3.signature };
                            }
                            if (!cPlaced) {
                                if (needCFAnchorOvr) {
                                    TerrainBuilder.setTerrainType(cx, cy, cFAnchorOrigT);
                                    TerrainBuilder.setBiomeType(cx, cy, cFAnchorOrigB);
                                }
                                for (let k = 0; k < cOvs.length; k++) {
                                    const ov = cOvs[k];
                                    TerrainBuilder.setTerrainType(ov.x, ov.y, ov.origTerrain);
                                    TerrainBuilder.setBiomeType(ov.x, ov.y, ov.origBiome);
                                }
                            }
                        }
                    }
                    if (!cPlaced) {
                        if (storedRangeFails < NW_MAX_TRIES) {
                            const _rFail = collectFailReason(cx, cy, typeTagSet, requiredTerrain, requiredBiome, minElev, hasWaterfallTag, wonderNeedsWater);
                            let _rLabel = _rFail;
                            if (!_rFail) {
                                const rTIdx = GameplayMap.getTerrainType(cx, cy);
                                const rBIdx = GameplayMap.getBiomeType(cx, cy);
                                const _tNames = ["TERRAIN_MOUNTAIN","TERRAIN_HILL","TERRAIN_FLAT","TERRAIN_COAST","TERRAIN_OCEAN","TERRAIN_NAVIGABLE_RIVER"];
                                const _bNames = ["BIOME_TUNDRA","BIOME_GRASSLAND","BIOME_PLAINS","BIOME_TROPICAL","BIOME_DESERT","BIOME_MARINE"];
                                const rTMatch = !requiredTerrain || (_tNames[rTIdx] === requiredTerrain);
                                const rBMatch = !requiredBiome  || (_bNames[rBIdx] === requiredBiome);
                                _rLabel = (rTMatch && rBMatch) ? (cEngineUnknown ? cEngineUnknown.reason : buildEngineUnknownReason(cx, cy, eIndex, typeTagSet)) : "engine-reject";
                            }
                            // cEngineUnknown is only set when canHaveFeatureParam=true but setFeatureType failed.
                            // If canHaveFeatureParam returned false for all dirs (e.g. a non-anchor footprint tile
                            // has wrong terrain/biome), cEngineUnknown is still null and detail would be undefined.
                            // Synthesize detail by snapshotting the footprint so !t/!b flags reveal the blocker.
                            if (!cEngineUnknown && _rLabel.startsWith("engine:unknown")) {
                                let synthDetail = null;
                                for (let di = 0; di < dirList.length; di++) {
                                    const diagFP = getFootprintTiles(cx, cy, placementClass, dirList[di]);
                                    if (diagFP && diagFP.length > 0) {
                                        synthDetail = "noCanHaveFeature|dir=" + dirList[di] + "|" + buildCompactFootprintSignature(diagFP, requiredTerrain, requiredBiome, wonderNeedsWater);
                                        break;
                                    }
                                }
                                if (synthDetail) {
                                    cEngineUnknown = { reason: _rLabel, detail: synthDetail, pass: "rangePrecheck", dir: dirList[0] };
                                }
                            }
                            nwStatusMap.get(row.FeatureType).tries.push({ x: cx, y: cy, dir: cEngineUnknown ? cEngineUnknown.dir : "all", pass: cEngineUnknown ? cEngineUnknown.pass : "range", dist, reason: _rLabel, detail: cEngineUnknown ? cEngineUnknown.detail : undefined });
                            if (_rLabel.startsWith("engine:unknown") && NW_VERBOSE) {
                                const rf = getFootprintTiles(cx, cy, placementClass, dirList[0]);
                                logNWDiagnostic(cx, cy, typeTagSet, minElev, requiredTerrain, requiredBiome, rf);
                                if (cEngineUnknown && cEngineUnknown.detail) {
                                    console.log("     diag: " + cEngineUnknown.detail + "|dist=" + dist);
                                } else {
                                    console.log("     diag: range d=" + dist + " " + buildCompactFootprintSignature(rf, requiredTerrain, requiredBiome, wonderNeedsWater));
                                }
                            }
                            storedRangeFails++;
                        }
                    }
                }
                if (!placed) {
                    if (NW_VERBOSE) console.log("   - " + row.FeatureType + " SKIPPED [range exhausted within radius " + searchRadius + "]");
                }
            }
        }
    }
    console.log("   - total placed : " + numPlaced);

    // --- [NW Summary] compact one-line-per-NW report ---
    let nwPlacedCount = 0, nwSkippedCount = 0;
    const pcLogMap = new Map(); // placementClass+dir -> {example, footprint}
    const summaryLines = [];
    nwStatusMap.forEach((entry, featureType) => {
        const shortName = featureType.replace("FEATURE_", "");
        const pc = entry.placementClass;
        if (entry.placed) {
            nwPlacedCount++;
            const p = entry.placed;
            const fpStr = p.footprint && p.footprint.length > 0 ? p.footprint.join("") : "(" + p.x + "," + p.y + ")";
            const passLabel = p.pass + (p.forced ? "!" : "") + (p.dist ? " d=" + p.dist : "");
            // Build diff: what failed before the eventual success
            let diffStr = "";
            if (entry.tries.length === 0) {
                diffStr = "anchor-ok";
            } else {
                // Aggregate reasons across all failed tries
                const reasonCounts = {};
                for (const t of entry.tries) {
                    const key = t.reason || "?";
                    reasonCounts[key] = (reasonCounts[key] || 0) + 1;
                }
                const reasonParts = Object.keys(reasonCounts).map(r => reasonCounts[r] > 1 ? r + "x" + reasonCounts[r] : r);
                const relocated = (p.pass && p.pass.indexOf("range") === 0) ? " [relocated]" : "";
                diffStr = "tried:" + entry.tries.length + " [" + reasonParts.join(", ") + "] -> " + passLabel + relocated;
            }
            summaryLines.push("  [NW] " + shortName + " | " + pc + " dir=" + p.dir + " | " + fpStr + (p.incomplete ? " [!" + p.footprint.length + "/" + entry.tiles + "t]" : "") + " | " + diffStr);
            const placedUnknowns = entry.tries.filter(t => t.reason && t.reason.startsWith("engine:unknown"));
            if (placedUnknowns.length > 0) {
                const firstUnknown = placedUnknowns[0];
                if (firstUnknown.detail) {
                    summaryLines.push("    [diag] first-engine-unknown " + firstUnknown.detail);
                }
            }
            // PlacementClass log: one example per (pc, dir) combination
            const pcKey = pc + "_" + p.dir;
            if (!pcLogMap.has(pcKey)) {
                pcLogMap.set(pcKey, { pc, dir: p.dir, example: shortName, anchor: "(" + p.x + "," + p.y + ")", footprint: fpStr, tiles: entry.tiles });
            }
        } else {
            nwSkippedCount++;
            // Summarise all failed-try reasons
            const reasonCounts = {};
            for (const t of entry.tries) {
                const key = t.reason || "?";
                reasonCounts[key] = (reasonCounts[key] || 0) + 1;
            }
            const reasonParts = Object.keys(reasonCounts).map(r => reasonCounts[r] > 1 ? r + "x" + reasonCounts[r] : r);
            // engine:unknown tries — emit verbose diag
            const unknowns = entry.tries.filter(t => t.reason && t.reason.startsWith("engine:unknown"));
            for (const t of unknowns) {
                console.log("  [NW-diag] " + shortName + " " + t.pass + " at (" + t.x + "," + t.y + ") reason=" + t.reason + " — verbose:");
                logNWDiagnostic(t.x, t.y, nwTypeTagsMap[featureType] || new Set(), nwMinElevMap[featureType] || 0, null, null);
                if (t.detail) console.log("  [NW-diag] " + shortName + " detail: " + t.detail);
            }
            const radStr = entry.searchRadius > 0 ? " radius=" + entry.searchRadius : " radius=0";
            summaryLines.push("  [NW] " + shortName + " | " + pc + " | SKIPPED" + radStr + " | " + entry.tries.length + " tries: [" + reasonParts.join(", ") + "]");
        }
    });
    console.log("[NW Summary - " + nwPlacedCount + " placed, " + nwSkippedCount + " skipped]");
    for (const line of summaryLines) console.log(line);

    // --- [PlacementClass Log] shape/footprint discovery across this run ---
    if (pcLogMap.size > 0) {
        console.log("[PlacementClass Log]");
        pcLogMap.forEach((v) => {
            console.log("  " + v.pc + " dir=" + v.dir + " [" + v.tiles + "t] | ex:" + v.example + " anchor=" + v.anchor + " footprint=" + v.footprint);
        });
    }

    // --- Post-placement scan: verify NWs on map ---
    // GameplayMap.getFeatureType() returns a DB row index ($index, e.g. 28 for VALLEY_OF_FLOWERS),
    // NOT a hash (Database.makeHash output). During map gen, reads committed state so may lag;
    // isNaturalWonder is used here (blob-counting only, no identity check needed).
    {
        const mapW = GameplayMap.getGridWidth();
        const mapH = GameplayMap.getGridHeight();
        // Flood-fill all connected NW tiles → set of all NW-tile "x,y" keys + blob count
        let nwBlobCount = 0;
        const nwTileSet = new Set();
        for (let sy = 0; sy < mapH; sy++) {
            for (let sx = 0; sx < mapW; sx++) {
                if (!GameplayMap.isNaturalWonder(sx, sy)) continue;
                const key = sx + "," + sy;
                if (nwTileSet.has(key)) continue;
                nwBlobCount++;
                const q = [{ x: sx, y: sy }];
                nwTileSet.add(key);
                while (q.length > 0) {
                    const cur = q.shift();
                    const loc = GameplayMap.getLocationFromIndex(GameplayMap.getIndexFromXY(cur.x, cur.y));
                    for (let d = 0; d < 6; d++) {
                        const a = GameplayMap.getAdjacentPlotLocation(loc, d);
                        if (a.x < 0 || a.y < 0) continue;
                        const aKey = a.x + "," + a.y;
                        if (nwTileSet.has(aKey)) continue;
                        if (!GameplayMap.isNaturalWonder(a.x, a.y)) continue;
                        nwTileSet.add(aKey);
                        q.push({ x: a.x, y: a.y });
                    }
                }
            }
        }
        // Per-NW status check
        const surprises = [], losses = [];
        nwStatusMap.forEach((entry, ft) => {
            const short = ft.replace("FEATURE_", "");
            if (entry.placed) {
                if (!nwTileSet.has(entry.placed.x + "," + entry.placed.y))
                    losses.push(short + " [placed at (" + entry.placed.x + "," + entry.placed.y + ") but tile not on map]");
            } else if (entry.tries.length > 0) {
                // Skipped: check if anchor tile silently got an NW (P3 placed-but-undetected scenario)
                const ax = entry.tries[0].x, ay = entry.tries[0].y;
                if (nwTileSet.has(ax + "," + ay))
                    surprises.push(short + " [SKIPPED but anchor (" + ax + "," + ay + ") has NW — P3 placed without detection]");
            }
        });
        if (nwBlobCount !== nwPlacedCount) surprises.push(nwBlobCount + " blobs vs " + nwPlacedCount + " recorded");
        if (surprises.length > 0 || losses.length > 0) {
            console.log("[NW Post-scan: " + nwBlobCount + " blob(s) on map — DISCREPANCIES]");
            for (const s of surprises) console.log("  + " + s);
            for (const l of losses)    console.log("  - " + l);
        } else {
            console.log("[NW Post-scan: " + nwBlobCount + " on map, matches records]");
        }
    }

    return { count: numPlaced, placedFeatureHashes };
}

console.log("Loaded ynamp-natural-wonders.js");
