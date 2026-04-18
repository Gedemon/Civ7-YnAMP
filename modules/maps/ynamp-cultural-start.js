// ynamp-cultural-start.js
//
// Patches GenerateMap to run start position shuffles after assignStartPositions
// completes on any standard generated map. Four options are provided:
//
// START_POSITION_RELATIVE_DISTANCE
//   Uses GiantEarth TSL coordinates as real-world geographic anchors. Pairs of civs
//   that are historically close together are penalized for being far apart on the map.
//   Score formula: sum over all pairs of actualDist * (CULTURAL_WEIGHT / tslDist)
//   [+ OVERSEA_PENALTY if on different landmass regions]. Minimizing clusters nearby civs.
//
// START_POSITION_REGION  ("Cultural Region (Terra)")
//   Two-phase shuffle using ContinentsRegion and CulturalRegion DB tables:
//   Phase 1 (two-continent maps): groups civs by SuperRegion and forces EURASIA civs
//     onto the homeland regionID and AMERICAS civs onto the distant-lands regionID.
//     OCEANIA civs are placed on islands in either region. Overflow is resolved by
//     finding new slots with findFallbackStartPlot restricted to the target regionID.
//   Phase 2: within each regionID independently, runs brute-force pairwise swaps scored
//     by CULTURE_GROUP_RELATIVE_POSITION (same-group civs cluster, adjacent groups nearby).
//     On single-continent maps Phase 1 is skipped and Phase 2 runs globally.
//   Note: designed for Terra-style maps; civ count per hemisphere will be unbalanced.
//
// START_POSITION_RELATIVE_DISTANCE_TERRA  ("Relative Distance (Terra)")
//   Phase 1: same SuperRegion hemisphere split as START_POSITION_REGION.
//   Phase 2: within each hemisphere independently, runs relative-distance swaps using
//     GiantEarth TSL anchors (no oversea penalty since civs are already separated).
//   On single-continent maps falls back to global START_POSITION_RELATIVE_DISTANCE.
//   Note: designed for Terra-style maps; civ count per hemisphere will be unbalanced.
//
// START_POSITION_REGION_BALANCED  ("Cultural Region (Balanced)")
//   Like START_POSITION_REGION but redistributes entire CultureGroups across hemispheres
//   to keep civ counts as equal as possible. All civs in the same CultureGroup stay
//   together. Groups farthest from EURO (ASIAN first, then AFRICAN, MIDEAST, MEDIT) are
//   moved to the smaller continent first when the eurasia side is too heavy, and vice versa.
//   OCEANIA fills the lighter hemisphere. Phase 2 intra-region swaps still run.
//   On single-continent maps falls back to global culture-group swaps.
//
// Hook mechanism:
//   Our GenerateMap listener fires BEFORE the selected map script's listener (MapGenScripts
//   are loaded first). We wrap FertilityBuilder.recalculate — the last meaningful call in
//   every base-game and YnAMP-Continents map script, always after assignStartPositions —
//   to inject the shuffle at the right moment. The wrapper self-removes after one use.
//
// Note: generateDiscoveries() is called by base-game maps before FertilityBuilder.recalculate,
//   so discoveries will reflect pre-shuffle start positions. This is a known limitation.

import { isValidPlot, findFallbackStartPlot } from '/ged-ynamp/maps/ynamp-utilities.js';

console.log("Loading ynamp-cultural-start.js");

// ── Constants ────────────────────────────────────────────────────────────────

// The canonical map whose StartPosition entries are used as real-world geographic anchors.
const CANONICAL_MAP_NAME     = "GiantEarth";
// Fallback coordinate for civs with no GiantEarth TSL entry (center of the Giant Earth map).
const DEFAULT_CULTURAL_COORD = { X: 90, Y: 46 };
// Weight applied to pairs whose TSL distance is 1 (closest possible).
// At tslDist 1 → coefficient 50/1 = 50 (≈ Civ6 same-group ×5 amplified).
// At tslDist 10 → coefficient 5 (≈ Civ6 SAME_GROUP_WEIGHT for neighboring cultures).
// At tslDist 100+ → coefficient < 0.5 (distant continents contribute little).
const CULTURAL_WEIGHT        = 50;
// Extra distance added when two start plots lie on different landmass regions (Relative Distance only).
const OVERSEA_PENALTY        = 50;
// Number of brute-force swap passes. More passes → better placement but longer init.
const BRUTE_FORCE_TRIES      = 5;

// ── Region option constants ───────────────────────────────────────────────────

// Relative ordering of culture groups used for inter-group scoring.
// Smaller absolute difference → groups are considered "adjacent" (placed nearby).
// Same group → SAME_GROUP_WEIGHT applied directly (no division).
const CULTURE_GROUP_RELATIVE_POSITION = {
    ETHNICITY_EURO:    0,
    ETHNICITY_MEDIT:   1,
    ETHNICITY_MIDEAST: 3,
    ETHNICITY_AFRICAN: 5,
    ETHNICITY_ASIAN:   10,
    ETHNICITY_OCEANIA: 15,
    ETHNICITY_NAM:     18,
    ETHNICITY_SOUTHAM: 20,
};
// Weight for pairs in the same culture group (mirrors CULTURAL_WEIGHT scale).
const SAME_GROUP_WEIGHT     = 50;
// Threshold for classifying a map as single-continent: one regionID holds this fraction of land.
const SINGLE_CONTINENT_THRESHOLD = 0.9;
// Default fallback values for civs with no GiantEarth TSL or no matching ContinentsRegion row.
const DEFAULT_SUPER_REGION   = "EURASIA";
const DEFAULT_CULTURE_GROUP  = "ETHNICITY_EURO";
// Minimum distance for fallback plots assigned during SuperRegion phase.
const REGION_MIN_DISTANCE    = 8;

// ── Option / map detection ────────────────────────────────────────────────────

function isRelativeDistanceEnabled() {
    const val = Configuration.getMapValue("StartPosition");
    if (val == null) return false;
    const valNum = Number(BigInt.asIntN(32, BigInt(val)));
    const hash   = Number(BigInt.asIntN(32, BigInt(Database.makeHash("START_POSITION_RELATIVE_DISTANCE"))));
    return valNum === hash;
}

function isRegionEnabled() {
    const val = Configuration.getMapValue("StartPosition");
    if (val == null) return false;
    const valNum = Number(BigInt.asIntN(32, BigInt(val)));
    const hash   = Number(BigInt.asIntN(32, BigInt(Database.makeHash("START_POSITION_REGION"))));
    return valNum === hash;
}

function isRelativeDistanceTerraEnabled() {
    const val = Configuration.getMapValue("StartPosition");
    if (val == null) return false;
    const valNum = Number(BigInt.asIntN(32, BigInt(val)));
    const hash   = Number(BigInt.asIntN(32, BigInt(Database.makeHash("START_POSITION_RELATIVE_DISTANCE_TERRA"))));
    return valNum === hash;
}

function isRegionBalancedEnabled() {
    const val = Configuration.getMapValue("StartPosition");
    if (val == null) return false;
    const valNum = Number(BigInt.asIntN(32, BigInt(val)));
    const hash   = Number(BigInt.asIntN(32, BigInt(Database.makeHash("START_POSITION_REGION_BALANCED"))));
    return valNum === hash;
}

// ── TSL / civ helpers ─────────────────────────────────────────────────────────

function buildTSLCoordMap() {
    const coordMap = {};
    for (let i = 0; i < GameInfo.StartPosition.length; ++i) {
        const row = GameInfo.StartPosition[i];
        // Use first (usually Antiquity) entry per civ in the canonical map.
        if (row.MapName === CANONICAL_MAP_NAME && !coordMap[row.Civilization]) {
            coordMap[row.Civilization] = { X: row.X, Y: row.Y };
        }
    }
    return coordMap;
}

function getCivTypeName(iPlayer) {
    const everAlive = Players.getEverAlive()[iPlayer];
    if (!everAlive) return null;
    const civRow = GameInfo.Civilizations.lookup(everAlive.civilizationType);
    if (!civRow) return null;
    return civRow.CivilizationType;
}

function getTSLCoord(civTypeName, coordMap) {
    return coordMap[civTypeName] || DEFAULT_CULTURAL_COORD;
}

// ── Score functions ───────────────────────────────────────────────────────────

// Contribution of one pair (p1, p2) to the global score.
// Higher score = worse placement; minimizing groups nearby civs together.
// overseaPenalty defaults to OVERSEA_PENALTY; pass 0 when civs are already hemisphere-separated.
function calculatePairScore(p1, p2, coordMap, iWidth, overseaPenalty = OVERSEA_PENALTY) {
    const plot1 = StartPositioner.getStartPosition(p1);
    const plot2 = StartPositioner.getStartPosition(p2);
    if (plot1 < 0 || plot2 < 0) return 0;

    const x1 = plot1 % iWidth, y1 = Math.floor(plot1 / iWidth);
    const x2 = plot2 % iWidth, y2 = Math.floor(plot2 / iWidth);

    const civ1 = getCivTypeName(p1);
    const civ2 = getCivTypeName(p2);
    if (!civ1 || !civ2) return 0;

    const tsl1 = getTSLCoord(civ1, coordMap);
    const tsl2 = getTSLCoord(civ2, coordMap);

    // Actual map distance, plus oversea penalty when on different landmass regions.
    let actualDist = GameplayMap.getPlotDistance(x1, y1, x2, y2);
    if (overseaPenalty > 0 &&
            GameplayMap.getLandmassRegionId(x1, y1) !== GameplayMap.getLandmassRegionId(x2, y2)) {
        actualDist += overseaPenalty;
    }

    // Geographic proximity on Giant Earth. The closer the TSL, the more we
    // penalize the pair for being far apart on the game map.
    const tslDist = Math.max(1, GameplayMap.getPlotDistance(tsl1.X, tsl1.Y, tsl2.X, tsl2.Y));
    return actualDist * (CULTURAL_WEIGHT / tslDist);
}

function calculateCulturalScore(aliveMajorIds, coordMap, iWidth) {
    let score = 0;
    for (let i = 0; i < aliveMajorIds.length; i++) {
        for (let j = i + 1; j < aliveMajorIds.length; j++) {
            score += calculatePairScore(aliveMajorIds[i], aliveMajorIds[j], coordMap, iWidth);
        }
    }
    return score;
}

// ── Core shuffle ──────────────────────────────────────────────────────────────

function runCulturalDistanceShuffle() {
    console.log("[YnAMP Cultural] ─── Cultural Distance Shuffle ───────────────");
    const aliveMajorIds = Players.getAliveMajorIds();
    if (aliveMajorIds.length < 2) {
        console.log("[YnAMP Cultural] Skipping: fewer than 2 players.");
        return;
    }

    const iWidth   = GameplayMap.getGridWidth();
    const coordMap = buildTSLCoordMap();

    // Log which TSL anchors are being used (warn on fallback).
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const civ = getCivTypeName(aliveMajorIds[i]);
        if (civ) {
            const coord = coordMap[civ];
            if (coord) {
                console.log("[YnAMP Cultural]  " + civ + " TSL anchor: (" + coord.X + ", " + coord.Y + ")");
            } else {
                console.log("[YnAMP Cultural]  " + civ + " TSL anchor: DEFAULT fallback (" + DEFAULT_CULTURAL_COORD.X + ", " + DEFAULT_CULTURAL_COORD.Y + ")");
            }
        }
    }

    const initialScore = calculateCulturalScore(aliveMajorIds, coordMap, iWidth);
    let currentScore   = initialScore;
    console.log("[YnAMP Cultural] Initial score: " + initialScore.toFixed(1));

    for (let pass = 0; pass < BRUTE_FORCE_TRIES; pass++) {
        console.log("[YnAMP Cultural] Pass " + (pass + 1) + "/" + BRUTE_FORCE_TRIES);
        for (let i = 0; i < aliveMajorIds.length; i++) {
            const p1    = aliveMajorIds[i];
            let plot1   = StartPositioner.getStartPosition(p1);
            if (plot1 < 0) continue;

            for (let j = i + 1; j < aliveMajorIds.length; j++) {
                const p2    = aliveMajorIds[j];
                const plot2 = StartPositioner.getStartPosition(p2);
                if (plot2 < 0) continue;

                // Try the swap.
                StartPositioner.setStartPosition(plot2, p1);
                StartPositioner.setStartPosition(plot1, p2);

                const swapScore = calculateCulturalScore(aliveMajorIds, coordMap, iWidth);
                if (swapScore < currentScore) {
                    currentScore = swapScore;
                    plot1 = plot2;  // p1 is now at plot2; update so next j uses its real position
                    console.log("[YnAMP Cultural]   Swapped " +
                        (getCivTypeName(p1) || ("player" + p1)) + " <-> " +
                        (getCivTypeName(p2) || ("player" + p2)) +
                        " (score " + currentScore.toFixed(1) + ")");
                } else {
                    // Revert — no improvement.
                    StartPositioner.setStartPosition(plot1, p1);
                    StartPositioner.setStartPosition(plot2, p2);
                }
            }
        }
    }

    console.log("[YnAMP Cultural] Initial: " + initialScore.toFixed(1) +
                " -> Final: " + currentScore.toFixed(1) +
                " (delta: " + (currentScore - initialScore).toFixed(1) + ")");
    console.log("[YnAMP Cultural] ────────────────────────────────────────────");
}

// ── Region option implementation ──────────────────────────────────────────────

// Build region→superRegion lookup from DB table ContinentsRegion.
function buildRegionToSuperRegionMap() {
    const map = {};
    const rows = GameInfo.ContinentsRegion;
    if (!rows) return map;
    for (let i = 0; i < rows.length; i++) map[rows[i].Region] = rows[i].SuperRegion;
    return map;
}

// Build region→cultureGroup lookup from DB table CulturalRegion.
function buildRegionToCultureGroupMap() {
    const map = {};
    const rows = GameInfo.CulturalRegion;
    if (!rows) return map;
    for (let i = 0; i < rows.length; i++) map[rows[i].Region] = rows[i].CultureGroup;
    return map;
}

// Given a Giant-Earth TSL coordinate (from coordMap), find which GiantEarth RegionPosition
// rectangle contains it and return the Region string, or null if none matches.
function getTSLRegion(tslCoord) {
    const rows = GameInfo.RegionPosition;
    if (!rows) return null;
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (row.MapName !== CANONICAL_MAP_NAME) continue;
        if (tslCoord.X >= row.X && tslCoord.X < row.X + row.Width &&
            tslCoord.Y >= row.Y && tslCoord.Y < row.Y + row.Height) {
            return row.Region;
        }
    }
    return null;
}

// Build profile map: playerId → { superRegion, cultureGroup } for all alive majors.
function buildCivProfileMap(aliveMajorIds) {
    const coordMap         = buildTSLCoordMap();
    const regionToSuper    = buildRegionToSuperRegionMap();
    const regionToCulture  = buildRegionToCultureGroupMap();
    const profiles         = new Map();

    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid  = aliveMajorIds[i];
        const civ  = getCivTypeName(pid);
        const tsl  = civ ? (coordMap[civ] || DEFAULT_CULTURAL_COORD) : DEFAULT_CULTURAL_COORD;
        const region = getTSLRegion(tsl);
        const superRegion   = (region && regionToSuper[region])   || DEFAULT_SUPER_REGION;
        const cultureGroup  = (region && regionToCulture[region]) || DEFAULT_CULTURE_GROUP;
        profiles.set(pid, { superRegion, cultureGroup });
        console.log("[YnAMP Region]  " + (civ || ("player" + pid)) +
            " region=" + (region || "none") +
            " superRegion=" + superRegion +
            " cultureGroup=" + cultureGroup);
    }
    return profiles;
}

// Returns true if the map is effectively a single continent (one regionID holds ≥90% of land).
function detectSingleContinent(iWidth, iHeight) {
    const regionCount = {};
    let total = 0;
    for (let y = 0; y < iHeight; y++) {
        for (let x = 0; x < iWidth; x++) {
            if (GameplayMap.isWater(x, y)) continue;
            total++;
            const rid = GameplayMap.getLandmassRegionId(x, y);
            regionCount[rid] = (regionCount[rid] || 0) + 1;
        }
    }
    if (total === 0) return true;
    for (const rid in regionCount) {
        if (regionCount[rid] / total >= SINGLE_CONTINENT_THRESHOLD) {
            console.log("[YnAMP Region] Single-continent detected: regionId=" + rid +
                " (" + ((regionCount[rid] / total * 100).toFixed(1)) + "% of land)");
            return true;
        }
    }
    return false;
}

// Phase 1: Move civs to their correct regionID based on SuperRegion.
// EURASIA → homeland regionID (majority of current EURASIA starts).
// AMERICAS → the other regionID.
// OCEANIA  → either regionID (filled last into any remaining slot).
function assignCivsBySuperRegion(aliveMajorIds, civProfiles, iWidth, iHeight) {
    console.log("[YnAMP Region] ─── Phase 1: SuperRegion hemisphere assignment ───");

    // Collect current regionId per player.
    const playerRegionId = new Map();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid   = aliveMajorIds[i];
        const plot  = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) { playerRegionId.set(pid, -1); continue; }
        const x = plot % iWidth, y = Math.floor(plot / iWidth);
        playerRegionId.set(pid, GameplayMap.getLandmassRegionId(x, y));
    }

    // Determine which regionId is "homeland" for EURASIA by majority vote.
    const eurasiaVotes = {};
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid = aliveMajorIds[i];
        if ((civProfiles.get(pid) || {}).superRegion !== "EURASIA") continue;
        const rid = playerRegionId.get(pid);
        if (rid < 0) continue;
        eurasiaVotes[rid] = (eurasiaVotes[rid] || 0) + 1;
    }
    let eurasiaRegionId = -1;
    let bestVotes = -1;
    for (const rid in eurasiaVotes) {
        if (eurasiaVotes[rid] > bestVotes || (eurasiaVotes[rid] === bestVotes && Number(rid) < eurasiaRegionId)) {
            bestVotes = eurasiaVotes[rid];
            eurasiaRegionId = Number(rid);
        }
    }

    // Collect all distinct regionIds from current starts.
    const allRegionIds = new Set();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const rid = playerRegionId.get(aliveMajorIds[i]);
        if (rid >= 0) allRegionIds.add(rid);
    }

    let americasRegionId = -1;
    for (const rid of allRegionIds) {
        if (rid !== eurasiaRegionId) { americasRegionId = rid; break; }
    }

    if (eurasiaRegionId < 0 || americasRegionId < 0) {
        console.log("[YnAMP Region] Phase 1 skipped: could not determine two distinct regionIDs " +
            "(eurasiaRid=" + eurasiaRegionId + " americasRid=" + americasRegionId + ")");
        return;
    }
    console.log("[YnAMP Region] EURASIA → regionId=" + eurasiaRegionId +
        "  AMERICAS → regionId=" + americasRegionId);

    // Group players by target regionId.
    const wantedInRegion = { [eurasiaRegionId]: [], [americasRegionId]: [], oceania: [] };
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid    = aliveMajorIds[i];
        const super_ = (civProfiles.get(pid) || {}).superRegion || DEFAULT_SUPER_REGION;
        if (super_ === "EURASIA")  wantedInRegion[eurasiaRegionId].push(pid);
        else if (super_ === "AMERICAS") wantedInRegion[americasRegionId].push(pid);
        else wantedInRegion.oceania.push(pid);
    }

    // Build the usedPlots set.
    const usedPlots = new Set();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const plot = StartPositioner.getStartPosition(aliveMajorIds[i]);
        if (isValidPlot(plot)) usedPlots.add(plot);
    }

    // Pool of available plots per regionId (all current starts on that regionId).
    const plotPoolByRegion = { [eurasiaRegionId]: [], [americasRegionId]: [] };
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid  = aliveMajorIds[i];
        const plot = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) continue;
        const x = plot % iWidth, y = Math.floor(plot / iWidth);
        const rid = GameplayMap.getLandmassRegionId(x, y);
        if (plotPoolByRegion[rid]) plotPoolByRegion[rid].push(plot);
    }

    // Assign OCEANIA civs to whichever region has effective surplus slots.
    // "Effective surplus" = pool size minus civs leaving that region minus civs already
    // assigned to stay — so plots vacated by cross-region movers don't count as free slots.
    for (const pid of wantedInRegion.oceania) {
        const poolE = plotPoolByRegion[eurasiaRegionId];
        const poolA = plotPoolByRegion[americasRegionId];
        // Count how many civs currently on each region are being sent to the OTHER region.
        let crossLeavingEurasia = 0, crossLeavingAmericas = 0;
        for (let i = 0; i < aliveMajorIds.length; i++) {
            const p = aliveMajorIds[i];
            const origRid = playerRegionId.get(p);
            if (origRid === eurasiaRegionId  && wantedInRegion[americasRegionId].indexOf(p) >= 0) crossLeavingEurasia++;
            if (origRid === americasRegionId && wantedInRegion[eurasiaRegionId].indexOf(p)  >= 0) crossLeavingAmericas++;
        }
        const effectiveSurplusE = poolE.length - crossLeavingEurasia  - wantedInRegion[eurasiaRegionId].length;
        const effectiveSurplusA = poolA.length - crossLeavingAmericas - wantedInRegion[americasRegionId].length;
        // Put OCEANIA where there is more effective surplus; tie → eurasia.
        if (effectiveSurplusA > effectiveSurplusE) {
            wantedInRegion[americasRegionId].push(pid);
        } else {
            wantedInRegion[eurasiaRegionId].push(pid);
        }
    }

    // For each target regionId, ensure the pool has enough slots; grow with fallbacks if not.
    // This runs AFTER OCEANIA assignment so pool sizes match the final wantedInRegion counts.
    for (const rid of [eurasiaRegionId, americasRegionId]) {
        const needed = wantedInRegion[rid].length;
        const pool   = plotPoolByRegion[rid];
        while (pool.length < needed) {
            const fb = findFallbackStartPlot(-1, usedPlots, iWidth, iHeight, REGION_MIN_DISTANCE, rid);
            if (!isValidPlot(fb)) {
                console.log("[YnAMP Region] WARNING: could not find enough fallback plots in regionId=" + rid);
                break;
            }
            pool.push(fb);
            usedPlots.add(fb);
            const fx = fb % iWidth, fy = Math.floor(fb / iWidth);
            console.log("[YnAMP Region]  Fallback plot added for regionId=" + rid + " at (" + fx + "," + fy + ")");
        }
    }

    // Now swap civs to their target regions.
    for (const rid of [eurasiaRegionId, americasRegionId]) {
        const pool   = plotPoolByRegion[rid];
        const wanted = wantedInRegion[rid];
        let poolIdx  = 0;
        for (let i = 0; i < wanted.length; i++) {
            const pid        = wanted[i];
            const currentRid = playerRegionId.get(pid);
            if (currentRid === rid) continue;   // already on correct region
            // Find a pool slot from this regionId not already used by a correctly-placed civ.
            while (poolIdx < pool.length) {
                const targetPlot = pool[poolIdx++];
                const tx = targetPlot % iWidth, ty = Math.floor(targetPlot / iWidth);
                if (GameplayMap.getLandmassRegionId(tx, ty) !== rid) continue;
                // Check if another civ already owns this plot and is also assigned to this region.
                // Only check wantedInRegion — NOT playerRegionId — so that plots vacated by a
                // civ being moved away (e.g. Maya's original regionId=1 spot) are not wrongly
                // treated as reserved and wasted as fallback slots.
                let ownerFound = false;
                for (let j = 0; j < aliveMajorIds.length; j++) {
                    const other = aliveMajorIds[j];
                    if (other === pid) continue;
                    if (StartPositioner.getStartPosition(other) === targetPlot &&
                            wantedInRegion[rid].indexOf(other) >= 0) {
                        ownerFound = true;
                        break;
                    }
                }
                if (ownerFound) continue;

                const oldPlot = StartPositioner.getStartPosition(pid);
                StartPositioner.setStartPosition(targetPlot, pid);
                playerRegionId.set(pid, rid);
                console.log("[YnAMP Region]  Moved " + (getCivTypeName(pid) || ("player" + pid)) +
                    " from plot " + oldPlot + " → " + targetPlot +
                    " (regionId " + rid + ")");
                break;
            }
        }
    }
    console.log("[YnAMP Region] Phase 1 complete.");
}

// Phase 2: Score a pair of players by their culture groups and actual map distance.
// Same group → pairScore = actualDist * SAME_GROUP_WEIGHT (penalise distance heavily).
// Diff group → pairScore = actualDist / relDiff (closer groups tolerate more distance).
// No oversea penalty — civs are assumed to already be on their correct hemisphere.
function calculateRegionPairScore(p1, p2, civProfiles, iWidth) {
    const plot1 = StartPositioner.getStartPosition(p1);
    const plot2 = StartPositioner.getStartPosition(p2);
    if (!isValidPlot(plot1) || !isValidPlot(plot2)) return 0;

    const x1 = plot1 % iWidth, y1 = Math.floor(plot1 / iWidth);
    const x2 = plot2 % iWidth, y2 = Math.floor(plot2 / iWidth);
    const actualDist = GameplayMap.getPlotDistance(x1, y1, x2, y2);

    const g1 = (civProfiles.get(p1) || {}).cultureGroup || DEFAULT_CULTURE_GROUP;
    const g2 = (civProfiles.get(p2) || {}).cultureGroup || DEFAULT_CULTURE_GROUP;

    if (g1 === g2) {
        return actualDist * SAME_GROUP_WEIGHT;
    }
    const pos1   = CULTURE_GROUP_RELATIVE_POSITION[g1] !== undefined ? CULTURE_GROUP_RELATIVE_POSITION[g1] : 10;
    const pos2   = CULTURE_GROUP_RELATIVE_POSITION[g2] !== undefined ? CULTURE_GROUP_RELATIVE_POSITION[g2] : 10;
    const relDiff = Math.max(1, Math.abs(pos1 - pos2));
    return actualDist / relDiff;
}

function calculateRegionScore(playerIds, civProfiles, iWidth) {
    let score = 0;
    for (let i = 0; i < playerIds.length; i++) {
        for (let j = i + 1; j < playerIds.length; j++) {
            score += calculateRegionPairScore(playerIds[i], playerIds[j], civProfiles, iWidth);
        }
    }
    return score;
}

// Run brute-force swap passes for a given set of players (optionally restricted to one regionId).
function runCultureGroupSwaps(playerIds, civProfiles, iWidth, label) {
    if (playerIds.length < 2) return;
    const initialScore = calculateRegionScore(playerIds, civProfiles, iWidth);
    let currentScore   = initialScore;
    console.log("[YnAMP Region] " + label + " initial score: " + initialScore.toFixed(1));

    for (let pass = 0; pass < BRUTE_FORCE_TRIES; pass++) {
        for (let i = 0; i < playerIds.length; i++) {
            const p1    = playerIds[i];
            let plot1   = StartPositioner.getStartPosition(p1);
            if (!isValidPlot(plot1)) continue;
            for (let j = i + 1; j < playerIds.length; j++) {
                const p2    = playerIds[j];
                const plot2 = StartPositioner.getStartPosition(p2);
                if (!isValidPlot(plot2)) continue;

                StartPositioner.setStartPosition(plot2, p1);
                StartPositioner.setStartPosition(plot1, p2);
                const swapScore = calculateRegionScore(playerIds, civProfiles, iWidth);
                if (swapScore < currentScore) {
                    currentScore = swapScore;
                    plot1 = plot2;  // p1 is now at plot2; update so next j uses its real position
                    console.log("[YnAMP Region]   Swapped " +
                        (getCivTypeName(p1) || ("player" + p1)) + " <-> " +
                        (getCivTypeName(p2) || ("player" + p2)) +
                        " (score " + currentScore.toFixed(1) + ")");
                } else {
                    StartPositioner.setStartPosition(plot1, p1);
                    StartPositioner.setStartPosition(plot2, p2);
                }
            }
        }
    }
    console.log("[YnAMP Region] " + label +
        " initial: " + initialScore.toFixed(1) +
        " → final: " + currentScore.toFixed(1));
}

function logFinalRegionPlacements(aliveMajorIds, civProfiles, iWidth) {
    console.log("[YnAMP Region] ─── Final cultural placements ───");
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid = aliveMajorIds[i];
        const civ = getCivTypeName(pid) || ("player" + pid);
        const plot = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) {
            console.log("[YnAMP Region]  " + civ + " | INVALID_START | superRegion=" +
                ((civProfiles.get(pid) || {}).superRegion || "UNKNOWN") +
                " | cultureGroup=" + ((civProfiles.get(pid) || {}).cultureGroup || "UNKNOWN"));
            continue;
        }
        const x = plot % iWidth;
        const y = Math.floor(plot / iWidth);
        const regionId = GameplayMap.getLandmassRegionId(x, y);
        const profile = civProfiles.get(pid) || {};
        console.log("[YnAMP Region]  " + civ +
            " | (" + x + "," + y + ") | regionId=" + regionId +
            " | superRegion=" + (profile.superRegion || "UNKNOWN") +
            " | cultureGroup=" + (profile.cultureGroup || "UNKNOWN"));
    }
    console.log("[YnAMP Region] ───────────────────────────────────────");
}

// Top-level Region shuffle orchestrator.
function runRegionShuffle() {
    console.log("[YnAMP Region] ═══ Cultural Region Shuffle ════════════════════");
    const aliveMajorIds = Players.getAliveMajorIds();
    if (aliveMajorIds.length < 2) {
        console.log("[YnAMP Region] Skipping: fewer than 2 players.");
        return;
    }
    const iWidth  = GameplayMap.getGridWidth();
    const iHeight = GameplayMap.getGridHeight();

    const civProfiles = buildCivProfileMap(aliveMajorIds);

    if (detectSingleContinent(iWidth, iHeight)) {
        // Single continent (e.g. Pangaea): skip hemisphere assignment, score everyone together.
        console.log("[YnAMP Region] Single-continent map — running global culture-group swaps.");
        runCultureGroupSwaps(aliveMajorIds, civProfiles, iWidth, "global");
        logFinalRegionPlacements(aliveMajorIds, civProfiles, iWidth);
    } else {
        // Phase 1: force civs to their correct hemisphere regionId.
        assignCivsBySuperRegion(aliveMajorIds, civProfiles, iWidth, iHeight);

        // Phase 2: fine-tune within each regionId independently.
        console.log("[YnAMP Region] ─── Phase 2: intra-region culture-group swaps ───");
        // Collect distinct regionIds.
        const regionGroups = new Map();
        for (let i = 0; i < aliveMajorIds.length; i++) {
            const pid  = aliveMajorIds[i];
            const plot = StartPositioner.getStartPosition(pid);
            if (!isValidPlot(plot)) continue;
            const x   = plot % iWidth, y = Math.floor(plot / iWidth);
            const rid = GameplayMap.getLandmassRegionId(x, y);
            if (!regionGroups.has(rid)) regionGroups.set(rid, []);
            regionGroups.get(rid).push(pid);
        }
        for (const [rid, players] of regionGroups) {
            runCultureGroupSwaps(players, civProfiles, iWidth, "regionId=" + rid);
        }
        logFinalRegionPlacements(aliveMajorIds, civProfiles, iWidth);
    }
    console.log("[YnAMP Region] ════════════════════════════════════════════════");
}

// ── Relative Distance (Terra) option ─────────────────────────────────────────

// Runs brute-force swap passes for a given player subset using relative-distance scoring.
// No oversea penalty — assumes civs are already on their correct hemisphere.
function runPerRegionRelativeDistanceShuffle(regionPlayerIds, coordMap, iWidth, label) {
    if (regionPlayerIds.length < 2) return;

    function calcScore() {
        let s = 0;
        for (let i = 0; i < regionPlayerIds.length; i++) {
            for (let j = i + 1; j < regionPlayerIds.length; j++) {
                s += calculatePairScore(regionPlayerIds[i], regionPlayerIds[j], coordMap, iWidth, 0);
            }
        }
        return s;
    }

    const initialScore = calcScore();
    let currentScore   = initialScore;
    console.log("[YnAMP TerraRelDist] " + label + " initial score: " + initialScore.toFixed(1));

    for (let pass = 0; pass < BRUTE_FORCE_TRIES; pass++) {
        for (let i = 0; i < regionPlayerIds.length; i++) {
            const p1  = regionPlayerIds[i];
            let plot1 = StartPositioner.getStartPosition(p1);
            if (!isValidPlot(plot1)) continue;
            for (let j = i + 1; j < regionPlayerIds.length; j++) {
                const p2    = regionPlayerIds[j];
                const plot2 = StartPositioner.getStartPosition(p2);
                if (!isValidPlot(plot2)) continue;

                StartPositioner.setStartPosition(plot2, p1);
                StartPositioner.setStartPosition(plot1, p2);
                const swapScore = calcScore();
                if (swapScore < currentScore) {
                    currentScore = swapScore;
                    plot1 = plot2;
                    console.log("[YnAMP TerraRelDist]   Swapped " +
                        (getCivTypeName(p1) || ("player" + p1)) + " <-> " +
                        (getCivTypeName(p2) || ("player" + p2)) +
                        " (score " + currentScore.toFixed(1) + ")");
                } else {
                    StartPositioner.setStartPosition(plot1, p1);
                    StartPositioner.setStartPosition(plot2, p2);
                }
            }
        }
    }
    console.log("[YnAMP TerraRelDist] " + label +
        " initial: " + initialScore.toFixed(1) +
        " → final: " + currentScore.toFixed(1));
}

// Relative Distance (Terra) orchestrator.
// Phase 1: SuperRegion hemisphere split (same as Cultural Region Terra).
// Phase 2: within each hemisphere, relative-distance swaps with no oversea penalty.
function runRelativeDistanceTerraShhuffle() {
    console.log("[YnAMP TerraRelDist] ═══ Relative Distance Terra Shuffle ══════════");
    const aliveMajorIds = Players.getAliveMajorIds();
    if (aliveMajorIds.length < 2) {
        console.log("[YnAMP TerraRelDist] Skipping: fewer than 2 players.");
        return;
    }

    const iWidth  = GameplayMap.getGridWidth();
    const iHeight = GameplayMap.getGridHeight();
    const coordMap = buildTSLCoordMap();

    // Log TSL anchors.
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const civ = getCivTypeName(aliveMajorIds[i]);
        if (civ) {
            const coord = coordMap[civ];
            if (coord) {
                console.log("[YnAMP TerraRelDist]  " + civ + " TSL anchor: (" + coord.X + ", " + coord.Y + ")");
            } else {
                console.log("[YnAMP TerraRelDist]  " + civ + " TSL anchor: DEFAULT fallback (" +
                    DEFAULT_CULTURAL_COORD.X + ", " + DEFAULT_CULTURAL_COORD.Y + ")");
            }
        }
    }

    if (detectSingleContinent(iWidth, iHeight)) {
        console.log("[YnAMP TerraRelDist] Single-continent map — falling back to global relative-distance shuffle.");
        runCulturalDistanceShuffle();
        return;
    }

    // Phase 1: hemisphere assignment.
    const civProfiles = buildCivProfileMap(aliveMajorIds);
    assignCivsBySuperRegion(aliveMajorIds, civProfiles, iWidth, iHeight);

    // Phase 2: per-region relative-distance swaps.
    console.log("[YnAMP TerraRelDist] ─── Phase 2: per-region relative-distance swaps ───");
    const regionGroups = new Map();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid  = aliveMajorIds[i];
        const plot = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) continue;
        const x   = plot % iWidth, y = Math.floor(plot / iWidth);
        const rid = GameplayMap.getLandmassRegionId(x, y);
        if (!regionGroups.has(rid)) regionGroups.set(rid, []);
        regionGroups.get(rid).push(pid);
    }
    for (const [rid, players] of regionGroups) {
        runPerRegionRelativeDistanceShuffle(players, coordMap, iWidth, "regionId=" + rid);
    }
    console.log("[YnAMP TerraRelDist] ════════════════════════════════════════════════");
}

// ── Cultural Region (Balanced) option ────────────────────────────────────────

// Determines which landmass regionIds correspond to EURASIA and AMERICAS hemispheres
// by majority vote among EURASIA-superRegion civs' current start plots.
// Returns { eurasiaRegionId, americasRegionId } or null if two distinct IDs can't be found.
function detectHemisphereRegionIds(aliveMajorIds, civProfiles, iWidth) {
    const eurasiaVotes = {};
    const allRegionIds = new Set();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid  = aliveMajorIds[i];
        const plot = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) continue;
        const x   = plot % iWidth, y = Math.floor(plot / iWidth);
        const rid = GameplayMap.getLandmassRegionId(x, y);
        allRegionIds.add(rid);
        if ((civProfiles.get(pid) || {}).superRegion === "EURASIA") {
            eurasiaVotes[rid] = (eurasiaVotes[rid] || 0) + 1;
        }
    }
    let eurasiaRegionId = -1, bestVotes = -1;
    for (const rid in eurasiaVotes) {
        if (eurasiaVotes[rid] > bestVotes ||
                (eurasiaVotes[rid] === bestVotes && Number(rid) < eurasiaRegionId)) {
            bestVotes = eurasiaVotes[rid];
            eurasiaRegionId = Number(rid);
        }
    }
    let americasRegionId = -1;
    for (const rid of allRegionIds) {
        if (rid !== eurasiaRegionId) { americasRegionId = rid; break; }
    }
    if (eurasiaRegionId < 0 || americasRegionId < 0) {
        console.log("[YnAMP Balanced] Could not determine two distinct regionIDs " +
            "(eurasiaRid=" + eurasiaRegionId + " americasRid=" + americasRegionId + ")");
        return null;
    }
    return { eurasiaRegionId, americasRegionId };
}

// Builds a Map<playerId, regionId> that assigns each civ to a hemisphere while keeping
// all civs in the same CultureGroup on the same side and balancing total civ counts.
//
// Algorithm:
//   1. Initial: EURASIA super-groups → eurasiaRegionId; AMERICAS → americasRegionId.
//   2. Assign OCEANIA groups to the lighter side (tie → eurasia).
//   3. Balance loop: if eurasia-heavy, move EURASIA-superRegion groups sorted by
//      CULTURE_GROUP_RELATIVE_POSITION descending (ASIAN=10, AFRICAN=5, MIDEAST=3, MEDIT=1;
//      EURO=0 is never moved). Only move if groupCount < imbalance (avoids overshoot).
//      Mirror logic for americas-heavy.
function buildBalancedGroupAssignment(aliveMajorIds, civProfiles, eurasiaRegionId, americasRegionId) {
    // Count civs per cultureGroup and record each group's superRegion.
    const groupCount    = {};   // cultureGroup → civ count
    const groupSuper    = {};   // cultureGroup → superRegion (first seen)
    const groupToRegion = {};   // cultureGroup → assigned regionId

    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid     = aliveMajorIds[i];
        const profile = civProfiles.get(pid) || {};
        const cg      = profile.cultureGroup || DEFAULT_CULTURE_GROUP;
        const sr      = profile.superRegion   || DEFAULT_SUPER_REGION;
        groupCount[cg] = (groupCount[cg] || 0) + 1;
        if (groupSuper[cg] === undefined) groupSuper[cg] = sr;
    }

    // Initial assignment: EURASIA → eurasiaRegionId, AMERICAS → americasRegionId.
    let eurasiaCount = 0, americasCount = 0;
    for (const cg in groupCount) {
        const sr = groupSuper[cg];
        if (sr === "EURASIA") {
            groupToRegion[cg] = eurasiaRegionId;
            eurasiaCount += groupCount[cg];
        } else if (sr === "AMERICAS") {
            groupToRegion[cg] = americasRegionId;
            americasCount += groupCount[cg];
        }
        // OCEANIA left unassigned for now.
    }

    // Assign OCEANIA to the lighter side (tie → eurasia).
    for (const cg in groupCount) {
        if (groupSuper[cg] !== "OCEANIA") continue;
        if (americasCount < eurasiaCount) {
            groupToRegion[cg] = americasRegionId;
            americasCount += groupCount[cg];
        } else {
            groupToRegion[cg] = eurasiaRegionId;
            eurasiaCount += groupCount[cg];
        }
        console.log("[YnAMP Balanced] OCEANIA group " + cg + " assigned to " +
            (groupToRegion[cg] === eurasiaRegionId ? "EURASIA" : "AMERICAS") +
            " (eurasiaCount=" + eurasiaCount + " americasCount=" + americasCount + ")");
    }

    // Candidate groups for moving, sorted by relative position descending (farthest from EURO first).
    const eurasiaGroups = Object.keys(groupToRegion)
        .filter(cg => groupToRegion[cg] === eurasiaRegionId &&
                      groupSuper[cg] === "EURASIA" &&
                      cg !== "ETHNICITY_EURO")
        .sort((a, b) => (CULTURE_GROUP_RELATIVE_POSITION[b] || 0) -
                        (CULTURE_GROUP_RELATIVE_POSITION[a] || 0));
    const americasGroups = Object.keys(groupToRegion)
        .filter(cg => groupToRegion[cg] === americasRegionId && groupSuper[cg] === "AMERICAS")
        .sort((a, b) => (CULTURE_GROUP_RELATIVE_POSITION[b] || 0) -
                        (CULTURE_GROUP_RELATIVE_POSITION[a] || 0));

    // Move EURASIA groups → AMERICAS while eurasia-heavy.
    let imbalance = eurasiaCount - americasCount;
    for (let k = 0; k < eurasiaGroups.length && imbalance > 1; k++) {
        const cg = eurasiaGroups[k];
        if (groupCount[cg] < imbalance) {
            groupToRegion[cg] = americasRegionId;
            eurasiaCount  -= groupCount[cg];
            americasCount += groupCount[cg];
            imbalance = eurasiaCount - americasCount;
            console.log("[YnAMP Balanced] Moved " + cg + " (n=" + groupCount[cg] + ") → AMERICAS" +
                " (eurasiaCount=" + eurasiaCount + " americasCount=" + americasCount + ")");
        }
    }

    // Move AMERICAS groups → EURASIA while americas-heavy.
    imbalance = americasCount - eurasiaCount;
    for (let k = 0; k < americasGroups.length && imbalance > 1; k++) {
        const cg = americasGroups[k];
        if (groupCount[cg] < imbalance) {
            groupToRegion[cg] = eurasiaRegionId;
            americasCount -= groupCount[cg];
            eurasiaCount  += groupCount[cg];
            imbalance = americasCount - eurasiaCount;
            console.log("[YnAMP Balanced] Moved " + cg + " (n=" + groupCount[cg] + ") → EURASIA" +
                " (eurasiaCount=" + eurasiaCount + " americasCount=" + americasCount + ")");
        }
    }

    console.log("[YnAMP Balanced] Final: eurasiaCount=" + eurasiaCount +
        " americasCount=" + americasCount);

    // Build playerId → targetRegionId map.
    const playerTargetRegion = new Map();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid = aliveMajorIds[i];
        const cg  = (civProfiles.get(pid) || {}).cultureGroup || DEFAULT_CULTURE_GROUP;
        // If a group has no explicit assignment (edge case), fall back to eurasia.
        playerTargetRegion.set(pid,
            groupToRegion[cg] !== undefined ? groupToRegion[cg] : eurasiaRegionId);
    }
    return playerTargetRegion;
}

// Physically moves civs to their target regionId determined by buildBalancedGroupAssignment.
// Mirrors assignCivsBySuperRegion but without the EURASIA/AMERICAS/OCEANIA branching
// (already resolved); target per player comes from playerTargetRegion.
function assignCivsByGroupAssignment(aliveMajorIds, playerTargetRegion, iWidth, iHeight) {
    console.log("[YnAMP Balanced] ─── Phase 1: group assignment hemisphere move ───");

    // Collect current regionId per player.
    const playerRegionId = new Map();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid  = aliveMajorIds[i];
        const plot = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) { playerRegionId.set(pid, -1); continue; }
        const x = plot % iWidth, y = Math.floor(plot / iWidth);
        playerRegionId.set(pid, GameplayMap.getLandmassRegionId(x, y));
    }

    // Collect distinct target regionIds.
    const targetRegionIds = new Set();
    for (const rid of playerTargetRegion.values()) {
        if (rid !== undefined && rid >= 0) targetRegionIds.add(rid);
    }

    // Build usedPlots set and pool of available plots per regionId.
    const usedPlots = new Set();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const plot = StartPositioner.getStartPosition(aliveMajorIds[i]);
        if (isValidPlot(plot)) usedPlots.add(plot);
    }

    const plotPoolByRegion = {};
    for (const rid of targetRegionIds) plotPoolByRegion[rid] = [];
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid  = aliveMajorIds[i];
        const plot = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) continue;
        const x = plot % iWidth, y = Math.floor(plot / iWidth);
        const rid = GameplayMap.getLandmassRegionId(x, y);
        if (plotPoolByRegion[rid]) plotPoolByRegion[rid].push(plot);
    }

    // Group players by target regionId.
    const wantedInRegion = {};
    for (const rid of targetRegionIds) wantedInRegion[rid] = [];
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid       = aliveMajorIds[i];
        const targetRid = playerTargetRegion.get(pid);
        if (targetRid !== undefined && wantedInRegion[targetRid]) {
            wantedInRegion[targetRid].push(pid);
        }
    }

    // Grow pool with fallback plots if needed.
    for (const rid of targetRegionIds) {
        const needed = wantedInRegion[rid].length;
        const pool   = plotPoolByRegion[rid];
        while (pool.length < needed) {
            const fb = findFallbackStartPlot(-1, usedPlots, iWidth, iHeight, REGION_MIN_DISTANCE, rid);
            if (!isValidPlot(fb)) {
                console.log("[YnAMP Balanced] WARNING: could not find enough fallback plots in regionId=" + rid);
                break;
            }
            pool.push(fb);
            usedPlots.add(fb);
            const fx = fb % iWidth, fy = Math.floor(fb / iWidth);
            console.log("[YnAMP Balanced]  Fallback plot added for regionId=" + rid +
                " at (" + fx + "," + fy + ")");
        }
    }

    // Swap civs to target regions.
    for (const rid of targetRegionIds) {
        const pool   = plotPoolByRegion[rid];
        const wanted = wantedInRegion[rid];
        let poolIdx  = 0;
        for (let i = 0; i < wanted.length; i++) {
            const pid        = wanted[i];
            const currentRid = playerRegionId.get(pid);
            if (currentRid === rid) continue;   // already on the correct region
            while (poolIdx < pool.length) {
                const targetPlot = pool[poolIdx++];
                const tx = targetPlot % iWidth, ty = Math.floor(targetPlot / iWidth);
                if (GameplayMap.getLandmassRegionId(tx, ty) !== rid) continue;
                // Skip plots already reserved by another civ assigned to this region.
                let ownerFound = false;
                for (let j = 0; j < aliveMajorIds.length; j++) {
                    const other = aliveMajorIds[j];
                    if (other === pid) continue;
                    if (StartPositioner.getStartPosition(other) === targetPlot &&
                            wantedInRegion[rid].indexOf(other) >= 0) {
                        ownerFound = true;
                        break;
                    }
                }
                if (ownerFound) continue;
                const oldPlot = StartPositioner.getStartPosition(pid);
                StartPositioner.setStartPosition(targetPlot, pid);
                playerRegionId.set(pid, rid);
                console.log("[YnAMP Balanced]  Moved " + (getCivTypeName(pid) || ("player" + pid)) +
                    " from plot " + oldPlot + " → " + targetPlot +
                    " (regionId " + rid + ")");
                break;
            }
        }
    }
    console.log("[YnAMP Balanced] Phase 1 complete.");
}

// Top-level Cultural Region (Balanced) shuffle orchestrator.
function runRegionBalancedShuffle() {
    console.log("[YnAMP Balanced] ═══ Cultural Region Balanced Shuffle ══════════════");
    const aliveMajorIds = Players.getAliveMajorIds();
    if (aliveMajorIds.length < 2) {
        console.log("[YnAMP Balanced] Skipping: fewer than 2 players.");
        return;
    }

    const iWidth  = GameplayMap.getGridWidth();
    const iHeight = GameplayMap.getGridHeight();
    const civProfiles = buildCivProfileMap(aliveMajorIds);

    if (detectSingleContinent(iWidth, iHeight)) {
        console.log("[YnAMP Balanced] Single-continent map — running global culture-group swaps.");
        runCultureGroupSwaps(aliveMajorIds, civProfiles, iWidth, "global");
        logFinalRegionPlacements(aliveMajorIds, civProfiles, iWidth);
        console.log("[YnAMP Balanced] ════════════════════════════════════════════════");
        return;
    }

    const hemispheres = detectHemisphereRegionIds(aliveMajorIds, civProfiles, iWidth);
    if (!hemispheres) {
        console.log("[YnAMP Balanced] WARNING: falling back to global culture-group swaps.");
        runCultureGroupSwaps(aliveMajorIds, civProfiles, iWidth, "global");
        logFinalRegionPlacements(aliveMajorIds, civProfiles, iWidth);
        console.log("[YnAMP Balanced] ════════════════════════════════════════════════");
        return;
    }

    const { eurasiaRegionId, americasRegionId } = hemispheres;
    console.log("[YnAMP Balanced] EURASIA → regionId=" + eurasiaRegionId +
        "  AMERICAS → regionId=" + americasRegionId);

    const playerTargetRegion = buildBalancedGroupAssignment(
        aliveMajorIds, civProfiles, eurasiaRegionId, americasRegionId);
    assignCivsByGroupAssignment(aliveMajorIds, playerTargetRegion, iWidth, iHeight);

    // Phase 2: intra-region culture-group swaps.
    console.log("[YnAMP Balanced] ─── Phase 2: intra-region culture-group swaps ───");
    const regionGroups = new Map();
    for (let i = 0; i < aliveMajorIds.length; i++) {
        const pid  = aliveMajorIds[i];
        const plot = StartPositioner.getStartPosition(pid);
        if (!isValidPlot(plot)) continue;
        const x   = plot % iWidth, y = Math.floor(plot / iWidth);
        const rid = GameplayMap.getLandmassRegionId(x, y);
        if (!regionGroups.has(rid)) regionGroups.set(rid, []);
        regionGroups.get(rid).push(pid);
    }
    for (const [rid, players] of regionGroups) {
        runCultureGroupSwaps(players, civProfiles, iWidth, "regionId=" + rid);
    }
    logFinalRegionPlacements(aliveMajorIds, civProfiles, iWidth);
    console.log("[YnAMP Balanced] ════════════════════════════════════════════════════");
}

// ── GenerateMap patch ─────────────────────────────────────────────────────────

function generateMap() {
    const relDist      = isRelativeDistanceEnabled();
    const region       = isRegionEnabled();
    const relDistTerra = isRelativeDistanceTerraEnabled();
    const balanced     = isRegionBalancedEnabled();
    if (!relDist && !region && !relDistTerra && !balanced) return;

    if (relDist)      console.log("[YnAMP Cultural] START_POSITION_RELATIVE_DISTANCE detected.");
    if (region)       console.log("[YnAMP Cultural] START_POSITION_REGION detected.");
    if (relDistTerra) console.log("[YnAMP Cultural] START_POSITION_RELATIVE_DISTANCE_TERRA detected.");
    if (balanced)     console.log("[YnAMP Cultural] START_POSITION_REGION_BALANCED detected.");
    console.log("[YnAMP Cultural] Patching FertilityBuilder.recalculate...");

    // FertilityBuilder.recalculate() is the last call in every base-game and
    // YnAMP-Continents map script, always after assignStartPositions has set all
    // major player start positions. We wrap it to inject the shuffle at that point.
    // The wrapper is self-removing: it restores the original on first invocation.
    const _originalRecalculate = FertilityBuilder.recalculate;
    FertilityBuilder.recalculate = function() {
        // Restore immediately so any subsequent recalculate calls in the same session
        // go directly to the original function.
        FertilityBuilder.recalculate = _originalRecalculate;
        // Run the appropriate shuffle while start positions are assigned but
        // before assignAdvancedStartRegions (which respects the shuffled positions).
        if (relDist)      runCulturalDistanceShuffle();
        if (region)       runRegionShuffle();
        if (relDistTerra) runRelativeDistanceTerraShhuffle();
        if (balanced)     runRegionBalancedShuffle();
        // Call the restored original.
        FertilityBuilder.recalculate();
    };
}

engine.on('GenerateMap', generateMap);
console.log("Loaded ynamp-cultural-start.js");
