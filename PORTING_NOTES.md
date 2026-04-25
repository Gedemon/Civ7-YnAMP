# YnAMP Porting Notes

Reference for the Civ7 API changes that mattered while aligning YnAMP with the current base game.

Last reviewed: 2026-04-15  
YnAMP version: 1.0.14  
Verified against: Civ7 v1.3.2

This file is intentionally version-oriented. It should answer two questions quickly:

1. What changed in the base game?
2. Does YnAMP already account for that change?

---

## 1. Current alignment status

| Area | Current status | Note |
|---|---|---|
| Start-position API | Applied | YnAMP still uses supported rectangle and tile-array paths where appropriate |
| Landmass region IDs | Applied | docs and scripts must prefer region IDs over old east/west plot-tag assumptions |
| Resource generation changes | Applied | current notes assume the v1.3.2 signature and region-ID logic |
| Biome changes from v1.3.2 | Applied | inherited when using base-game biome generation |
| Aquatic feature changes | Applied by inheritance | YnAMP relies on current base-game feature generation |
| Future patch watch list | Open | see section 6 |

---

## 2. Base-game API evolution that affected YnAMP

### 2.1 Start positions

| Patch | Change | YnAMP impact |
|---|---|---|
| 1.0.1 | rectangle-based `assignStartPositions(...)` | still usable |
| 1.2.1 | `assignSingleContinentStartPositions(...)` | relevant to single-continent scripts, not required everywhere |
| 1.2.3 | early tile-array start APIs | transitional only |
| 1.2.5 | `assignStartPositionsFromTiles(playerRegions)` | relevant for Voronoi-based Terra workflows |
| 1.3.0 | `landmassRegionIdFilter` added to start-pick helpers | important for homeland/distant-land filtering |

Practical conclusion: YnAMP does not need to abandon rectangle-based start placement, but all newer homeland filtering logic should think in region IDs, not only plot tags.

### 2.2 Landmass region system

| Patch | Change | YnAMP impact |
|---|---|---|
| 1.2.4 | old hemisphere logic still centered on plot tags | legacy reference only |
| 1.3.0 | `GameplayMap.getLandmassRegionId()` and `TerrainBuilder.setLandmassRegionId()` introduced | required |
| 1.3.0 | resource generation switched to region IDs | critical |

Key rule: after Civ7 v1.3.0, setting only `PLOT_TAG_EAST_LANDMASS` or `PLOT_TAG_WEST_LANDMASS` is not enough for correct resource behavior.

### 2.3 Resource generation

| Patch | Change | YnAMP impact |
|---|---|---|
| 1.2.1 | Poisson scatter and flower-plot logic | background reference |
| 1.2.4 | `generateResources(iWidth, iHeight)` exact two-arg signature | historical note |
| 1.3.0 | region-ID based homeland tracking | required |
| 1.3.0 | `isResourceRequiredForAge(i, Game.age)` | required |
| 1.3.2 | optional third resource-generation argument | current signature |

### 2.4 Biomes and rainfall

`feature-biome-generator.js` changed materially in v1.3.2.

Current behavior summary:

```text
rainfall < 25 -> Desert
rainfall > 250 and not mountain -> Tropical
otherwise adjust effective latitude using rainfall and river proximity
```

YnAMP inherits this behavior as long as it uses base-game biome assignment instead of freezing an older custom implementation.

### 2.5 Rain shadow direction

In v1.3.2, row scan direction depends on latitude band:

- polar and mid-latitude bands: left to right.
- equatorial band: right to left.

Only `TERRAIN_MOUNTAIN` blocks rain in the current system.

### 2.6 Aquatic features

v1.3.0 replaced the old reef-only assumptions with broader aquatic feature generation.

Important notes:

- `addReefs` became `addAquaticFeatures` internally.
- placement logic now understands more water-placement classes.
- YnAMP benefits automatically when it calls the current base-game feature pass.

---

## 3. Current function signatures worth remembering

Status: `current as documented for v1.3.2`

```js
assignStartPositions(iNum1, iNum2, west, east, rows, cols, sectors)
assignSingleContinentStartPositions(iNumPlayers, primaryLandmass, rows, cols, sectors)
assignStartPositionsFromTiles(playerRegions)
chooseStartSectors(iNum1, iNum2, rows, cols, bHumanNearEquator)

generateResources(iWidth, iHeight, minMarineResourceTypesOverride = 3)

expandCoasts(iWidth, iHeight)
expandCoastsPlus(iWest, iEast, iHeight)
generateLakes(iWidth, iHeight, iTilesPerLake)

addNaturalWonders(iWidth, iHeight, iNumNaturalWonders, wonderEventActive = false, requestedWonders = [])

designateBiomes(iWidth, iHeight)
addFeatures(iWidth, iHeight)
```

---

## 4. Landmass region constants

```js
LandmassRegion.LANDMASS_REGION_ANY
LandmassRegion.LANDMASS_REGION_NONE
LandmassRegion.LANDMASS_REGION_DEFAULT
LandmassRegion.LANDMASS_REGION_EAST
LandmassRegion.LANDMASS_REGION_WEST
```

Operational meaning in YnAMP docs:

- `WEST`: homeland.
- `EAST`: distant lands.
- `DEFAULT`: unassigned tile, usually a problem if the system expects region-aware behavior.

---

## 5. Documentation rule for future ports

When a new Civ7 patch lands, update this file by topic rather than writing “done” or “implemented” without evidence.

Recommended format:

| Topic | Patch | YnAMP status | Evidence |
|---|---|---|---|
| Example | 1.3.4 | Partial | script X still uses old call shape |

This keeps the file useful as a maintenance tool instead of turning it into a historical note with no operational value.

---

## 6. Watch list for the next game update

Check these first after each Civ7 patch:

1. Start-position helper signatures and filtering parameters.
2. Resource-generator signature and homeland-region assumptions.
3. Biome thresholds and rain-shadow logic.
4. Natural wonder generation arguments and helper tables.
5. Players API additions or renamed methods used by YnAMP helper scripts.