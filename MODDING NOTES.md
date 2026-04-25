# YnAMP Modding Notes

Technical notes collected while porting and maintaining YnAMP on the Civ7 MapScript API.

Last reviewed: 2026-04-20  
YnAMP version: 1.0.14  
Verified against: Civ7 v1.3.2

This file mixes stable implementation guidance with a smaller amount of empirical research. Each section is marked as one of:

- `Stable`: verified against the current mod and base-game scripts.
- `Research`: accurate so far, but still based on observed behavior and repeat testing.
- `Experimental`: idea or pattern worth keeping, but not treated as shipped guidance.

For a context-separated scripting surface matrix, see `docs/CIV7_API_MATRIX.md`.

## Contents

1. Configuration parameters
2. Voronoi map classes
3. TerrainBuilder vs GameplayMap
4. Silent async crashes
5. Coordinate lookup workflow
6. Natural wonder placement
7. PlacementClass footprint notes
8. NW placement failure analysis
9. FireTuner unlock context separation

---

## 1. Configuration parameters

Status: `Stable`

### 1.1 Declaring parameters in config.xml

Setup-screen parameters are exposed through `Parameters` and `DomainValues` in `modules/config/config.xml`.

```xml
<Parameters>
  <Row ParameterID="MyOption"
       Name="LOC_MY_OPTION_NAME"
       Description="LOC_MY_OPTION_DESC"
       Domain="MyOptionDomain"
       Hash="0"
       DefaultValue="42"
       ConfigurationGroup="Map"
       ConfigurationKey="MyOption"
       GroupId="MapOptions"
       SortIndex="2010"/>
</Parameters>

<DomainValues>
  <Row Domain="MyOptionDomain" Value="42" Name="LOC_MY_OPTION_42_NAME" SortIndex="0"/>
  <Row Domain="MyOptionDomain" Value="10" Name="LOC_MY_OPTION_10_NAME" SortIndex="1"/>
</DomainValues>
```

Read the selected value from JavaScript with:

```js
const raw = Configuration.getMapValue("MyOption");
```

### 1.2 Per-map parameters

Add `Key1="Map"` and `Key2="<module-path>"` to show an option only for one map script.

```xml
<Row Key1="Map" Key2="{ged-ynamp}maps/terra-map/terra-ynamp.js"
     ParameterID="TerraLandmassRatio"
     .../>
```

YnAMP currently uses this pattern for:

- Terra landmass ratio.
- Terra spawn distribution.
- TSL natural wonder placement mode on Earth maps.

### 1.3 Hash="0" vs Hash="1"

Recommendation: use `Hash="0"` for custom options unless you have a strong reason not to.

#### Hash="0"

`Configuration.getMapValue()` returns the raw string from `DomainValues`.

```js
const raw = Configuration.getMapValue("MyOption");
const value = raw != null ? parseInt(raw, 10) : 33;
```

#### Hash="1"

`Configuration.getMapValue()` returns an unsigned 32-bit integer, while `Database.makeHash()` returns the signed 32-bit representation of the same hash. Direct comparisons fail for values above $2^{31}$.

Observed during Terra option work:

| Value string | Raw from getMapValue() | Database.makeHash() | Result |
|---|---|---|---|
| `TERRA_YNAMP_RATIO_1_3` | `3879194135` | `-415773161` | direct compare fails |
| `TERRA_YNAMP_RATIO_1_4` | `2419129985` | `-1875837311` | direct compare fails |
| `TERRA_YNAMP_RATIO_1_5` | `240413474` | `240413474` | direct compare works |

If you must use `Hash="1"`, normalize first:

```js
const rawValue = Configuration.getMapValue("MyOption");
const normalized = rawValue != null ? Number(BigInt.asIntN(32, BigInt(rawValue))) : null;
if (normalized === Database.makeHash("MY_VALUE")) {
  // ...
}
```

---

## 2. Voronoi map classes

Status: `Stable` for Terra; `Experimental` for broader reuse ideas.

### 2.1 Class hierarchy

```text
VoronoiMap
|- VoronoiContinents
|- VoronoiPangaea
`- UnifiedContinentsBase
   `- VoronoiShatteredSeas
```

### 2.2 UnifiedContinentsBase has no init()

`UnifiedContinentsBase` exposes `initInternal()` but not `init()`. Calling `voronoiMap.init(...)` on a raw `UnifiedContinentsBase` instance causes a `TypeError`, and because map generation runs in `async` code, that failure can look like a silent engine shutdown.

For a two-landmass Voronoi map, use `VoronoiContinents`.

### 2.3 Overriding landmass sizes after init()

Apply fixed ratios after `init()` and before `simulate()`:

```js
voronoiMap.init(mapInfo.$index);
const generatorSettings = voronoiMap.getGenerator().getSettings();
const totalSize = generatorSettings.landmass[0].size + generatorSettings.landmass[1].size;
generatorSettings.landmass[0].size = totalSize * sizeRatio;
generatorSettings.landmass[1].size = totalSize * (1 - sizeRatio);
voronoiMap.simulate();
```

### 2.4 Homeland and distant-land consolidation

Some Voronoi scripts internally collapse many generated landmasses into two gameplay buckets:

- `landmassId = 1`: homeland.
- `landmassId = 2`: distant lands.

That pattern is useful when a script must still feed Civ7 systems that expect a homeland-vs-distant-land split.

### 2.5 Continents++ overhaul note

Status: `Experimental`

The multi-landmass Voronoi approach is a plausible path for a future Continents++ overhaul, but it is not documented here as a current YnAMP feature. Treat it as a design note, not current implementation guidance.

---

## 3. TerrainBuilder vs GameplayMap

Status: `Stable`

Use `TerrainBuilder` for setters and `GameplayMap` for getters.

- `TerrainBuilder`: `setTerrainType`, `setLandmassRegionId`, `setFeatureType`, `addPlotTag`.
- `GameplayMap`: `getTerrainType`, `getLandmassRegionId`, `getFeatureType`, `isWater`.

Wrong:

```js
const id = TerrainBuilder.getLandmassRegionId(x, y);
```

Correct:

```js
const id = GameplayMap.getLandmassRegionId(x, y);
```

Calling a non-existent TerrainBuilder getter is one of the easiest ways to trigger a silent async crash.

---

## 4. Silent async crashes

Status: `Stable`

`generateMap` is `async`. Uncaught exceptions inside it can destroy the map generation context without producing a normal stack trace in `Scripting.log`.

Typical symptom:

```text
Destroying Context - MapGeneration
Destroying Context - Tuner
Shutting down V8-based script engine.
```

Best debugging pattern:

1. Add short `console.log` checkpoints before suspicious calls.
2. Regenerate the map.
3. The last visible checkpoint usually identifies the failing call boundary.

Common causes found in YnAMP:

- Wrong API object, for example using a getter on `TerrainBuilder`.
- Calling a method that does not exist on a chosen class.
- `null` dereference on `mapInfo`, lookup rows, or engine-returned objects.
- Type mismatch on native bindings.

---

## 5. Coordinate lookup workflow

Status: `Stable`

### 5.1 Reference dimensions

| Map | Dimensions |
|---|---|
| Giant Earth | 180 x 94 |
| Greatest Earth | 104 x 64 |

### 5.2 Best coordinate sources

Use these in order:

1. `giant-earth-city.xml` for dense named real-world anchors.
2. `StartPosition` rows in `giant-earth.xml` and `greatest-earth.xml`.
3. `giant-earth-data.js` and `greatest-earth-data.js` to validate actual tile contents.
4. Civ6 YnAMP Earth map data as a legacy cross-reference when Civ7 data is sparse.

### 5.3 Scaling between Earth maps

Approximate conversion from Giant Earth to Greatest Earth:

```text
GE_x ≈ round(giant_x * 104 / 180)
GE_y ≈ round(giant_y * 64 / 94)
```

This is only a first pass. Always verify the result against nearby TSL or city anchors because the coastlines and offsets do not scale linearly.

### 5.4 Terrain validation workflow

1. Find an initial coordinate from city XML or TSL data.
2. Inspect the corresponding tile in the map data file.
3. Compare the tile against the feature or wonder requirements.
4. Shift by one or two tiles and retest if the local terrain is close but not valid.

Avoid documenting a location as final until both the XML anchor and the underlying map data agree.

---

## 6. Natural wonder placement

Status: `Stable` for API guidance, `Research` for footprint interpretation.

### 6.1 Main sources

- `modules/data/tables.sql`: defines `NaturalWonderPosition`.
- Earth map XML files: anchor rows and optional tuning fields.
- Base-game `natural-wonder-generator.js`: reference placement behavior.
- `GameInfo.Feature_NaturalWonders`: natural wonder definitions.
- `GameInfo.Feature_ValidTerrains` and `GameInfo.Feature_ValidBiomes`: terrain and biome constraints.
- `GameInfo.TypeTags`: engine-side placement tags.
- `GameInfo.Features.MinimumElevation`: elevation restrictions.

### 6.2 Recommended validation order

1. Identify the wonder in `GameInfo.Feature_NaturalWonders`.
2. Read its valid terrain and biome rows.
3. Check placement tags in `GameInfo.TypeTags`.
4. Check minimum elevation.
5. Validate candidate anchors with `TerrainBuilder.canHaveFeatureParam(...)`.

### 6.3 Important API caveat

`GameplayMap.getFeatureType(x, y)` returns the feature row index, not the hashed `FeatureType`.

This is correct:

```js
GameplayMap.getFeatureType(x, y) === GameInfo.Features.lookup(row.FeatureType).$index
```

This is incorrect:

```js
GameplayMap.getFeatureType(x, y) === Database.makeHash(row.FeatureType)
```

Use `GameplayMap.isNaturalWonder(x, y)` for general blob detection or revert guards, not for identifying one specific wonder type.

### 6.4 Practical debug flow

1. Treat `SearchRadius` as a targeted tool, not a default fix. Raise it when the wonder is `WATERFALL`-tagged (to search for existing river+cliff geometry) or when land/water domain mismatch at the anchor/footprint is likely.
2. Regenerate and inspect `Scripting.log` diagnostics.
3. In `real-only` debugging, read the compact signature lines before comparing raw coordinates:
  - `anchorSig`: first rewritten anchor candidate in anchor Pass 2, logged before rollback.
  - `winnerSig`: signature of the candidate that actually placed.
  - `anchor-vs-winner`: one-line comparison between the two.
4. For non-waterfall wonders, remember that retry passes already pre-apply required terrain/biome on the expected footprint (same-domain tiles) before placement; if `anchorSig` shows a full rewrite and the candidate still fails, the remaining blocker is local topology or engine secondary-tile validation, not failed replacement.
5. Remove temporary search tuning after locking the final anchor.

---

## 7. PlacementClass footprint notes

Status: `Stable` for hex neighbor table and shape formulas. `Research` for engine secondary-tile validation (section 8).

The engine resolves multi-tile natural wonder footprints internally from `PlacementClass` plus `Direction`. After 14 games of log analysis, the underlying row-parity offset hex coordinate system is fully decoded, and exact footprint formulas are confirmed for all shapes and all directions observed in the log.

### 7.1 Row-parity hex neighbor table

The game uses a **row-parity offset coordinate system**. The neighbor in direction N from tile `(x, y)` is:

| dir | Even y (`y % 2 == 0`) | Odd y (`y % 2 == 1`) |
|---|---|---|
| 0 | `(x, y+1)` | `(x+1, y+1)` |
| 1 | `(x+1, y)` | `(x+1, y)` |
| 2 | `(x, y-1)` | `(x+1, y-1)` |
| 3 | `(x-1, y-1)` | `(x, y-1)` |
| 4 | `(x-1, y)` | `(x-1, y)` |
| 5 | `(x-1, y+1)` | `(x, y+1)` |

Directions 1 and 4 are the same regardless of row parity. All others shift by 1 in x depending on even/odd y.

This table is equivalent to `GameplayMap.getAdjacentPlotLocation(loc, dir)` applied once.

### 7.2 Shape formulas

Use `d_N(a)` to mean "the neighbor of `a` in direction N" per the table above, and `d_N²(a)` to mean applying it twice.

| PlacementClass | Footprint formula | Tile count |
|---|---|---|
| `ONE` | `{anchor}` | 1 |
| `TWO`, `TWOADJACENT` | `{anchor, d_N(anchor)}` | 2 |
| `THREETRIANGLE` | `{anchor, d_N(anchor), d_{(N+1) mod 6}(anchor)}` | 3 |
| `FOURADJACENT` | `{anchor, d_N(anchor), d_N²(anchor), d_N³(anchor)}` | 4 |
| `FOURPARALLELAGRM` | `{anchor, d_N(anchor), d_{(N+1) mod 6}(anchor), d_{(N+1) mod 6}(d_N(anchor))}` | 4 |
| `FOURL` | `{anchor, d_N(anchor), d_N²(anchor), d_{(N+1) mod 6}(anchor)}` | 4 |

The formulas handle row parity automatically because `d_N(a)` uses the parity of the tile it is applied to at each step.

**Verification examples (all cross-checked against log):**

`TWOADJACENT dir=5` anchor=(86,46), y=46 even → d_5=(85,47) → {(86,46),(85,47)} ✓  
`THREETRIANGLE dir=0` anchor=(61,17), y=17 odd → d_0=(62,18), d_1=(62,17) → {(61,17),(62,18),(62,17)} ✓  
`THREETRIANGLE dir=5` anchor=(55,48), y=48 even → d_5=(54,49), d_0=(55,49) → {(55,48),(54,49),(55,49)} ✓  
`FOURADJACENT dir=2` anchor=(101,18), y=18 even → d_2=(101,17), d_2(101,17)=(102,16), d_2(102,16)=(102,15) → {(101,18),(101,17),(102,16),(102,15)} ✓  
`FOURPARALLELAGRM dir=3` anchor=(61,38), y=38 even → d_3=(60,37), d_4=(60,38), d_4(60,37)=(59,37) → {(61,38),(60,37),(60,38),(59,37)} ✓  
`FOURPARALLELAGRM dir=0` anchor=(7,39), y=39 odd → d_0=(8,40), d_1=(8,39), d_1(8,40)=(9,40) → {(7,39),(8,40),(8,39),(9,40)} ✓  
`FOURL dir=0` anchor=(56,7), y=7 odd → d_0=(57,8), d_0(57,8)=(57,9), d_1=(57,7) → {(56,7),(57,8),(57,9),(57,7)} ✓  
`FOURL dir=1` anchor=(55,4), y=4 even → d_1=(56,4), d_1(56,4)=(57,4), d_2=(55,3) → {(55,4),(56,4),(57,4),(55,3)} ✓  

Note that two different anchors for the same wonder with the same direction may produce different absolute coordinates if the anchor y-parities differ (e.g., Mount Fuji dir=2 at y=49 vs y=48 above).

### 7.3 Confirmation coverage across 14 games

| PlacementClass | Confirmed dirs | Formula-only (unobserved) |
|---|---|---|
| `ONE` | all (dir is irrelevant, footprint is always just anchor) | — |
| `TWO` | 0 | 1, 2, 3, 4, 5 |
| `TWOADJACENT` | 0, 1, 2, 3, 4, 5 | — |
| `THREETRIANGLE` | 0, 1, 2, 3, 4, 5 | — |
| `FOURADJACENT` | 2 | 0, 1, 3, 4, 5 |
| `FOURPARALLELAGRM` | 0, 2, 3, 4, 5 | 1 |
| `FOURL` | 0, 1 | 2, 3, 4, 5 |
| `FOURCROSS` | — (not used in any shipped NW data) | — |

`TWOADJACENT` and `THREETRIANGLE` are fully confirmed across all 6 directions. `TWO` (Mapu a Vaea Blowholes) only ever places at dir=0 in observed data. `FOURADJACENT` (Barrier Reef) is pinned to dir=2 in the XML data and was never observed at another direction.

---

## 8. NW placement failure analysis

Status: `Research`

### 8.1 Multi-tile engine validation and compact signatures

The YnAMP JS code still calls `TerrainBuilder.canHaveFeatureParam(x, y, featureParam)` only on the **anchor tile**. Retry passes also still pre-apply required terrain and biome to the computed footprint before placement attempts, but only on same-domain tiles (land stays land, water stays water). The important change is observability: current `real-only` logging now records the first rewritten anchor candidate and the eventual winner with the same compact signature format.

This closes the earlier gap where older logs could show only the restored or rolled-back state. Those older `noCanHaveFeature|...` snapshots remain useful as rollback-side diagnostics, but they do **not** prove what the engine saw after the rewrite. Use the new signature lines for that question.

Current real-only signature lines:

- `anchorSig`: first Pass 2 anchor candidate after the footprint rewrite and before rollback.
- `winnerSig`: compact signature of the candidate that actually placed.
- `anchor-vs-winner`: one-line comparison between the rewritten anchor and the winner.
- `first-engine-unknown`: first compact signature attached to a summary-side `engine:unknown` failure.

Signature format:

```text
anchorP2 anchor=(76,41) dir=5 rewrite=3/3 sig:(76,41)=MTN/TROP (76,42)=MTN/TROP (77,42)=MTN/TROP
```

Interpretation:

- `rewrite=x/y`: number of footprint tiles whose terrain or biome actually changed before the engine call.
- `!t`, `!b`, `!d`: remaining terrain, biome, or land/water mismatch after the attempted rewrite.
- `!r`, `!ar`, `!c...`: the tile is on-river, adjacent to river, or has cliff-crossing edges.
- `{Wn,Rn,An}`: count of adjacent water tiles, adjacent on-river tiles, and adjacent tiles that are not on-river themselves but are adjacent to a river.

This makes the key distinction explicit:

- If `rewrite` covers the full footprint and the candidate still fails, the remaining blocker is engine-side topology or secondary-tile validation.
- If `rewrite` does not cover the full footprint, the remaining blocker is still visible at the JS/domain layer.

The underlying engine behavior is unchanged:

- A wonder with a terrain-valid anchor can still fail if any secondary tile is impassable, the wrong terrain type, or overlaps another feature.
- `engine:unknown` still means "JS-visible checks passed but C++ rejected the full footprint during placement." It is **not** evidence that the rewrite failed.
- This matters most for multi-tile shapes, but the same reasoning also explains why one-tile waterfall wonders can still fail after terrain and biome replacement.

### 8.2 Per-wonder failure analysis

The current compact signatures support exact anchor-versus-winner comparisons for the ordinary relocated wonders and stronger negative evidence for the waterfall wonders.

| Wonder | Verified anchor vs winner difference | Current interpretation |
|---|---|---|
| `GRAND_CANYON` | In both verified real-only runs, the anchor at `(8,47)` rewrites the full `FOURPARALLELAGRM` footprint to `FLAT/DESERT` and still fails. The same relocated winner places at `(10,44)` `dir=0` `dist=3`, also as a fully rewritten `FLAT/DESERT` footprint, but with a different local river/cliff signature. | The blocker is secondary-footprint topology, not failed terrain or biome replacement. |
| `MACHAPUCHARE` | The anchor repeatedly rewrites to a full `MTN/TROP` triangle and still fails. The same relocated winner places at `(69,41)` `dir=5` `dist=7` in both runs; unlike the dry anchor, the winner carries river-adjacent and cliff-bearing footprint tiles. | Replacement works at the anchor. The successful difference is local topology after relocation. |
| `VIHREN` | The anchor repeatedly rewrites to a full `MTN/PLAINS` triangle and still fails. The stable winner at `(54,48)` `dir=3` `dist=1` is only one tile away but reaches a different river/cliff/coast micro-topology. | Same rewritten footprint class, different local topology. |
| `GULLFOSS` | Rewritten `HILL/TUNDRA` waterfall candidates still fail, including river-touching ones. No winner appears in the two verified real-only runs. | Hill + tundra + river is still insufficient; the remaining blocker is likely waterfall orientation or cliff topology. |
| `IGUAZU_FALLS` | Rewritten `HILL/TROP` waterfall candidates still fail, including river-touching candidates and some cliff-bearing anchors. No winner appears in the two verified real-only runs. | Same conclusion as GULLFOSS: the hidden requirement is beyond simple hill/tropical/river matching. |
| `MAPU_A_VAEA_BLOWHOLES` | This does not participate in the relaxed-rule comparison. Failures remain dominated by preserved coast, shallow-water, and unresolved tag checks. | Keep this documented separately as the preserved-rule exception. |
| `VINICUNCA` | Current Greatest Earth anchor is `anchor-ok`; no relocated comparison is active at the present XML. | Use as a stable reference case, not as an active failure case. |

**Key observation on mode differences:** `real-and-random` and `real-only` do not share the same terrain seed, so seed-sensitive anchor cases still exist. The compact signatures above are therefore most trustworthy when comparing two `real-only` runs against each other rather than mixing modes.

### 8.3 Fix recommendations

Waterfall wonders still have a hard JS/API limit: YnAMP can move anchors and retune terrain or biome, but it cannot author new river edges or cliff crossings at placement time. If a candidate tile lacks the required river-plus-cliff geometry, placement cannot be fixed in script and must be solved either by upstream map generation or by choosing a better existing candidate through radius search.

Use the compact signatures as the first tuning tool:

- If `anchorSig` already shows a full rewrite, do **not** blame the terrain/biome override code.
- If `winnerSig` is nearby, compare it against `anchorSig` before changing XML coordinates.
- If only waterfall candidates keep failing after full rewrite, prioritize existing river/cliff geometry over more aggressive override logic.

Per-wonder guidance:

- **GRAND_CANYON**: treat this as a secondary-topology case. The anchor rewrite is already proven. Future anchor work should target the local signature around the stable winner, not the flat/desert override itself.
- **MACHAPUCHARE**: treat this as a relocation success case. The useful delta is now the dry anchor triangle versus the river- and cliff-bearing winning triangle.
- **VIHREN**: same as MACHAPUCHARE. The important shift is one tile of local topology, not a change in rewrite behavior.
- **GULLFOSS** and **IGUAZU_FALLS**: keep `SearchRadius` only as a way to probe more existing waterfall geometry. If fully rewritten candidates still fail, the remaining problem is map topology, not JS replacement.
- **MAPU_A_VAEA_BLOWHOLES**: keep documenting separately as a preserved-rule exception. Real-only intentionally does not strip its coast/shallow-water tags, so it should not be compared directly with the relaxed-rule wonders above.
- **VINICUNCA**: no immediate action is required. Keep it as an `anchor-ok` reference case for future signature comparisons.

---

## 9. FireTuner unlock context separation

Status: `Research`

The attempted FireTuner unlock automation prototype for civilization unlocks is currently blocked by a verified runtime split.

### 9.1 Observed split

Two different contexts each exposed only half of the required capability:

- The pure Tuner `.ltp` panel context could reach `Game.Unlocks.setForceUnlockedForPlayer(...)` and `Game.Unlocks.isUnlockedForPlayer(...)`, but persistent constructible-event listeners registered from inline panel actions never produced a usable callback path in testing.
- The YnAMP Tuner bridge runtime in `modules/ui/tuner/ynamp-firetuner.js` could load reliably and log to `UI.log`, and it exposed `Game.Unlocks.isUnlockedForPlayer(...)`, but runtime probing showed `Game.Unlocks.setForceUnlockedForPlayer` was not available there.

This blocks the original plan of "listen for constructible completion, then force-unlock a civilization" inside the current FireTuner architecture.

### 9.2 Verified evidence

Observed during the prototype:

- `Scripting.log` from the pure Tuner unlock test panel showed `engine.on` existed and the panel could arm, but no constructible event receipts ever reached the handler.
- `UI.log` from the Tuner bridge runtime showed `Game=true`, `Unlocks=true`, `isUnlockedForPlayer=true`, but `setForceUnlockedForPlayer=false`.

Practical result:

- The write-side unlock API and the event-listener path are currently split across different runtimes.

### 9.3 Current guidance

- Do not continue the failed FireTuner unlock prototype on the current code path without new engine evidence.
- Treat direct runtime unlock scripting as blocked for this workflow, even though individual pieces appear in isolation.
- Keep the fake geographic resource plus `MODIFIER_PLAYER_GRANT_UNLOCK` approach as the documented YnAMP path for geography-based civilization availability.
- If Firaxis later exposes stable gameplay events to a runtime that also provides `setForceUnlockedForPlayer`, revisit the experiment from a fresh branch.

### 9.4 Cross-context property bridge

Status: `Archived research`

YnAMP no longer uses a cross-context App UI bridge for cropped-map ice cleanup.

Current state:

- The earlier `Game.setProperty(...)` / `Game.getProperty(...)` experiment for post-load edge-ice metadata has been retired from the live cropped-map ice workflow.
- Cropped-map ice prevention is now handled entirely before gameplay starts through the hidden `DisableIceOnRegion` map configuration value, the `region-no-ice` action criteria in `ynamp.modinfo`, and the `data/options/region-no-ice.sql` database update.
- No live YnAMP runtime consumer currently depends on `YnAMP.PostLoadContext` for edge-ice cleanup decisions.

What remains useful from this research:

- `Game.getProperty(...)` was readable from the App UI runtime during testing.
- `GameplayMap.getProperty(...)` returned `null` in the same tests, so `Game` remains the more plausible bridge if a future UI feature needs post-load data.
- `GameTutorial.setProperty(...)` / `GameTutorial.getProperty(...)` are still plausible candidates for future investigation, but they are not part of the current ice-prevention implementation.

Current recommendation:

- Do not reintroduce a post-load bridge for cropped-map ice unless a future requirement cannot be handled by configuration or database changes.
- If a future cross-context feature needs one, keep the payload namespaced, versioned, and narrowly scoped, then validate save/load and age-transition behavior before treating it as production-ready.

### 9.5 Post-load feature-modification limitation

Status: `Confirmed limitation`

In testing, attempts to add or remove `FEATURE_ICE` (index 12) from the App UI post-load runtime were not reliable. `WorldBuilder.MapPlots.setFeature(...)` can modify some features (for example forests) in this context, but did not successfully remove or place `FEATURE_ICE` during verification: `UI.log` shows the post-load consumer discovered `dbIceFeatureIndex=12`, enumerated candidates, attempted removals (attempted == remaining), and left the same tiles unchanged without emitting an API-availability error.

Current YnAMP decision:

- The old `NoIceNorth` / `NoIceSouth` map-script cleanup path has been removed.
- Cropped-map ice prevention now relies on the hidden `DisableIceOnRegion` option and `region-no-ice.sql`, which changes `FEATURE_ICE` placement from `ICE` to `OPEN_WATERS` before feature generation.
- This keeps the fix in configuration and database rules instead of post-load feature mutation.

Recommendation: keep cropped-map ice prevention in pre-generation configuration/database logic. If UI-side feature modification is required in the future, implement a small capability probe and per-plot success/failure logging before performing destructive edits.