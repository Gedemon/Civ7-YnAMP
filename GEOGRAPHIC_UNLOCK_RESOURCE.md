# YnAMP Geographic Unlock (by Resource)

Design notes for geography-driven civilization unlocks on Earth TSL maps.

Last reviewed: 2026-04-23  
YnAMP version: 1.0.16  
Verified against: Civ7 v1.3.2

## Current direction

Status summary:

- `Confirmed now`: pass 1 Earth regional resource placement for realism.
- `Implemented now`: testing-phase regional resource expansion, same-family removed-plot replacement with last-pass global staple fallback, and `GeographicUnlockMode` setup-screen scaffold.
- `Deferred`: actual shell/gameplay DB unlock rewiring.
- `Explicitly rejected`: globally broadening `CivilizationUnlocks` or `LeaderUnlocks`.
- `Still blocked`: plot-property driven unlock logic.

The working model is now split into two passes:

1. Pass 1 focuses on realistic real-world resource placement only.
2. Pass 2 adds a separate geographic unlock mode and only then may tighten placement rules for the subset of resources used as geographic gates.

---

## 1. Pass 1: realistic placement only

Pass 1 has one job: make Earth resource distribution more believable without changing civilization availability.

Current rules for pass 1:

- Keep resource placement realism independent from any unlock system.
- Let imported Earth map resources stand as the base layer when present.
- Reconcile only the clearly regional resources first.
- Do not make resources artificially scarce just to force unlock outcomes yet.
- Do not touch civilization availability in shell or gameplay scope in this pass.

Current control surface:

- `RegionalResourceMode`
  - `Off`
  - `Curated Regional Rules`

`RegionalResourceMode` is now explicitly placement-only.

---

## 2. First in-game confirmation

The first placement slice is confirmed by `Scripting.log` on 2026-04-21.

Observed results:

- `RegionalResourcePlacement: mode=curated map=GiantEarth rules=4 removed=92 added=1`
- `RegionalResourcePlacement: mode=curated map=GreatestEarthMap rules=4 removed=66 added=15`
- `RegionalResourcePlacement: mode=curated unlockMode=none map=GreatestEarthMap rules=6 removed=99 added=16`

These lines remain the baseline comparison from before the 2026-04-23 testing-phase expansion.

Notes:

- The Regional Earth crop currently logs against its Giant Earth source context, so the first line corresponds to the cropped Regional Earth test run.
- The first two lines correspond to the original four-resource slice.
- The later Greatest Earth line corresponds to the broader six-resource Antiquity-active run with the unlock scaffold still inert.
- `rules=6` in Antiquity is expected because `RESOURCE_TEA` is only valid in Exploration and Modern in the source XML, so it should not contribute to an Antiquity rule count.
- Non-zero `removed` and `added` values confirm both halves of the pass executed: cleanup of out-of-region placements and backfill of missing deposits.

Interpretation: the resource pass is live and running at the correct place in map generation.

---

## 3. Placement architecture

The current architecture is intentionally layered: quota backfill stays first, and same-plot replacement only runs as a final cleanup step for removed plots that remain empty.

1. Run base `generateResources(iWidth, iHeight)`.
2. If the map uses imported Earth resource data, let YnAMP apply that data through `ynamp.placeResources(...)`.
3. Run `applyRegionalResourcePlacement(...)`.
4. Remove curated resources that fall outside their allowed Earth regions.
5. Backfill missing deposits on valid empty plots inside target regions.
6. If removed plots are still empty, try same-family on-plot replacements in this order: active regional resources, active multi-area resources, then global staples as the last fallback.

Important implementation detail:

- Imported Earth maps already overwrite the base generator's resources.
- Because of that, the regional pass has to run after `placeResources()`, not only after `generateResources()`.

Current runtime logging also includes the selected `GeographicUnlockMode`, but that mode does not yet change placement behavior.

Current runtime logging now also separates deposit-target backfill from same-plot replacement and reports when the last-pass global fallback is used.

---

## 4. Resource model

The phase-1 planning model now distinguishes between three practical buckets.

- `Regional`: one region or a small set of geographically adjacent regions; best future unlock candidates.
- `Multi-area`: limited to several world areas or hemispheres, but not one coherent regional cluster; still good realism resources and the best replacement pool if a current regional candidate must be dropped.
- `Global`: staples or widely distributed resources; keep them out of the current curated shortlist.

### A. Regional core candidates

These are the cleanest fit for the future unlock side because their Earth footprint is both recognizable to the player and narrow enough to anchor a geographic civilization choice.

Current regional core:

- `RESOURCE_CAMELS`: North Africa, Arabia, Iran-Turan desert belt
- `RESOURCE_DATES`: North Africa, Arabia, Mesopotamia oasis belt
- `RESOURCE_SILK`: China, Tarim, Transoxiana, North India silk-road belt
- `RESOURCE_TEA`: China, Assam, Himalayan rim, mainland Southeast Asia

Testing-phase regional additions now active in the live pass:

- `RESOURCE_LAPIS_LAZULI`: Afghanistan-Iran highlands
- `RESOURCE_CLOVES`: Maluku and maritime Indonesia
- `RESOURCE_LLAMAS`: Andean highlands and adjacent plateaus

Notes:

- `RESOURCE_TEA` remains part of the long-term regional core, but it is Exploration/Modern only and should not affect Antiquity rule counts.
- These are still the best long-term candidates for a later geography-first unlock layer.

### B. Multi-area edge cases and replacement pool

These resources are still geographically limited enough to improve Earth realism, but they span multiple disconnected world areas and are therefore weaker future unlock gates than the regional core.

Current multi-area resources still relevant to the shortlist:

- `RESOURCE_IVORY`: Sub-Saharan Africa and the Indian elephant belt
- `RESOURCE_JADE`: East Asia with a Central American outlier
- `RESOURCE_DYES`: Mediterranean, Middle East, Indian Ocean, and Southeast Asian coasts
- `RESOURCE_PEARLS`: Gulf, Indian Ocean, South China Sea, Indonesia, and Australia

Same-type replacement pool from the full matrix:

- Fishing-boat family: `RESOURCE_DYES`, `RESOURCE_CRABS`, `RESOURCE_WHALES`
- Quarry family: `RESOURCE_GYPSUM`, `RESOURCE_LIMESTONE`, `RESOURCE_KAOLIN`
- Camp family: `RESOURCE_WILD_GAME`
- Warm-trade family: `RESOURCE_INCENSE`, `RESOURCE_COCOA`, `RESOURCE_SPICES`, `RESOURCE_SUGAR`, `RESOURCE_WINE`, `RESOURCE_FURS`, `RESOURCE_COFFEE`, `RESOURCE_RUBBER`

Notes:

- These are valid realism resources even if they are less clean for a future strict geographic unlock mode.
- Replacement should stay in the same improvement family when possible and only then broaden by class or footprint.
- Testing phase keeps `RESOURCE_PEARLS` active alongside `RESOURCE_DYES`; the coastal balance question now moves to log review instead of pre-emptive demotion.

### C. Global staples kept out of the shortlist

Keep these out of the current curated pass:

- `RESOURCE_HORSES`
- `RESOURCE_IRON`
- `RESOURCE_SALT`
- `RESOURCE_GOLD` (do not use `RESOURCE_GOLD_DISTANT_LANDS`)
- `RESOURCE_SILVER` (do not use `RESOURCE_SILVER_DISTANT_LANDS`)
- `RESOURCE_FISH`
- `RESOURCE_HIDES`
- `RESOURCE_RICE`
- `RESOURCE_CRABS`
- `RESOURCE_WOOL`

Reason:

- They are too widespread or too staple-like for hard regional placement.
- They can still receive soft deposit bias later if needed.
- They are poor primary candidates for future geographic unlocks.

Testing-phase exception:

- they are now allowed only as the last-pass same-family replacement for removed plots that still remain empty after regional and multi-area replacement checks.

The planning matrix in section 12 is now the source of truth for deciding whether a resource stays in the phase-1 shortlist, moves to the replacement pool, or remains out of scope.

---

## 5. Pass 2: geographic unlock modes

Pass 2 introduces a separate Earth-scoped setup option:

- `GeographicUnlockMode`
  - `No Unlock`
  - `Add Unlock`
  - `Strict Unlock`

This option must remain separate from `RegionalResourceMode`.

### No Unlock

- Keeps pass 1 behavior only.
- Realistic resource placement may still run.
- No civilization unlock changes are applied.

### Add Unlock

- Keeps the game's existing unlock graph.
- Adds geography-based unlock paths on top.
- The preferred gameplay-side bridge is still `REQUIREMENT_PLAYER_HAS_RESOURCE` for qualifying regional resources.

### Strict Unlock

- Limits civilization availability to geography-based unlocks plus explicitly preserved nearby original unlocks.
- Removes other non-geographic unlock sources such as leader-driven or reward-driven availability.
- Is subtractive by design.

Strict mode must not be implemented by broadly exposing more candidates in shell scope. That would defeat the purpose of the mod.

---

## 6. Geographic filtering rule for strict mode

Strict mode still needs an explicit definition of "close geographically".

Recommended rule:

- same region,
- or same superregion,
- or an explicitly whitelisted adjacent-region pair stored in data.

This should be data-driven, not an opaque heuristic in JS.

That rule will decide which original unlocks survive in strict mode before non-geographic unlock sources are removed.

---

## 7. Placement impact in pass 2

Only pass 2 unlock modes may justify stricter placement rules for gate resources.

Target behavior:

- `No Unlock`: keep realism-first placement only.
- `Add Unlock`: allow extra guarantees or exclusions only for the subset of resources used as geographic gates.
- `Strict Unlock`: permit the strongest tightening of gate-resource placement, because unlock availability is intended to be geography-led.

This means the current realism-first placement rules should not be over-tuned for scarcity until the unlock mode actually uses them.

---

## 8. Constraints and rejected paths

### Do not broaden shell unlock visibility globally

The earlier idea of broadening `CivilizationUnlocks` and `LeaderUnlocks` globally is no longer acceptable.

Reason:

- it would make too many civilizations available to everyone,
- it would weaken or destroy the mod's geographic purpose,
- and it would make `Strict Unlock` impossible to reason about.

Shell/gameplay changes in pass 2 must stay selective by mode and geography.

### Why fake civ-marker resources are not the primary plan

The earlier marker-resource approach remains a fallback only.

Why it lost priority:

- It duplicates resources the player never sees as part of the world model.
- It makes placement less realistic.
- It does not help the parallel goal of making Earth resource distribution itself more believable.

### Why plot-property matching is still blocked

`REQUIREMENT_PLOT_PROPERTY_MATCHES` remains non-viable for this feature.

Still missing:

- a documented argument contract,
- a general plot-property write API in JS,
- a clean player-scope aggregation path from plot state to unlock state.

That keeps plot-property matching in the research bucket.

---

## 9. Current data tables

The current placement pass is driven by existing YnAMP tables:

- `ResourceRegionExclusive`
- `ResourceRegionExclude`
- `ResourceRegionDeposit`

Current use:

- `Exclusive`: hard allowed-region list
- `Exclude`: hard blocked-region list
- `Deposit`: minimum backfill targets for specific regions or deposit subregions

This is sufficient for the current placement-first phase without adding a new schema.

The testing-phase same-plot replacement pass still uses this schema unchanged; improvement-family matching is derived at runtime from game data instead of from a new replacement table.

---

## 10. Current implementation state

Implemented now:

- realistic Earth regional resource placement,
- testing-phase activation of `RESOURCE_PEARLS`, `RESOURCE_LAPIS_LAZULI`, `RESOURCE_CLOVES`, and `RESOURCE_LLAMAS`,
- same-family removed-plot replacement after deposit-target backfill,
- last-pass global staple fallback for removed plots that still remain empty,
- runtime confirmation of the first placement pass,
- setup-screen `GeographicUnlockMode` option scaffold,
- runtime logging of the selected unlock mode for future branching,
- runtime counters for same-plot replacement hits, misses, and global fallback usage.

Not implemented yet:

- shell/config DB filtering for the three unlock modes,
- gameplay DB requirement rewiring,
- selective removal of leader/reward/non-geographic unlock paths in strict mode,
- mode-aware tightening of placement for gate resources.

---

## 11. Next steps

Placement side:

- complete and maintain the full resource matrix below,
- use the new replacement diagnostics to compare removed-versus-restored counts against the 2026-04-21 baseline,
- review whether `RESOURCE_IVORY`, `RESOURCE_JADE`, and `RESOURCE_PEARLS` still deserve to stay active after the first testing-phase logs,
- runtime-check Greatest Earth, Giant Earth, Regional Earth, and one later-age run where both Tea and Cloves are age-valid,
- only then retune deposit counts, exclusivity, replacement priority, and any edge-case exclusions.

Unlock side remains notes only for now:

- map target civilizations to accepted regional resources,
- define the data-driven region adjacency rule used by strict mode,
- wire the three unlock modes selectively instead of broadening visibility globally,
- tighten placement only for the gate resources actually used by `Add Unlock` and `Strict Unlock`.

This file now treats realistic regional resource placement as pass 1, and geographic civilization availability as a separate pass 2 layered on top of it.

---

## 12. Resource planning matrix

Planning rules:

- Tables are grouped by first active age, not repeated once per age they continue to exist in.
- `A`, `E`, `M` below mean Antiquity, Exploration, and Modern.
- `A/E/M*` means no explicit valid-age row was found for that variant, so phase-1 planning treats it as an all-age variant.
- `None / passive` means no explicit improvement mapping was found in `Constructible_ValidResources` or `District_FreeConstructibles`.
- The `Class` column uses the first-active-age source XML definition. Later age modules can change economic handling without changing the phase-1 placement bucket.
- `Planning notes` are for realism and replacement planning only. They do not imply current unlock implementation.

Implementation status as of 2026-04-25:

- `modules/data/resource-regions.xml` now implements all matrix resources marked `Regional` or `Multi-area` in `ResourceRegionExclusive` and `ResourceRegionDeposit`.
- Those two XML tables are ordered by first active age, then by resource name, and use `Resource` as the first field.
- Matrix resources marked `Global` remain intentionally excluded from those two tables.

### A. Antiquity-start resources

| Resource | Class | Ages | Improvement | Bucket | Likely Earth footprint | Planning notes |
| --- | --- | --- | --- | --- | --- | --- |
| `RESOURCE_CAMELS` | City | A/E | Camp | Regional | North Africa, Arabia, Iran-Turan deserts | High unlock value. Keep in shortlist. |
| `RESOURCE_COTTON` | Bonus | A/E/M | Plantation | Multi-area | Warm river plains in India, Egypt, Sahel, and the Americas | Low unlock value. Soft-bias fallback only. |
| `RESOURCE_DATES` | Bonus | A/E | Plantation | Regional | North Africa, Arabia, Mesopotamia oasis belt | High unlock value. Keep in shortlist. |
| `RESOURCE_DYES` | Bonus | A/E | Fishing Boat | Multi-area | Warm and enclosed coasts around the Mediterranean, Indian Ocean, and Southeast Asia | Primary active fishing-family fallback in testing phase. |
| `RESOURCE_FISH` | Bonus | A/E/M | Fishing Boat | Global | Productive coasts and inland waters worldwide | No unlock value. Keep out of shortlist. |
| `RESOURCE_GOLD` | Empire | A/E/M | Mine | Global | Mountain and hill belts worldwide | Low unlock value. Too staple-like for hard regional rules. |
| `RESOURCE_GOLD_DISTANT_LANDS` | Empire | A/E/M* | Mine | Global | Distant-lands gold belts, same geography as the main gold variant | Low unlock value. Variant only. |
| `RESOURCE_GYPSUM` | City | A/E | Quarry | Multi-area | Arid sedimentary belts in North Africa, the Middle East, Iberia, and the Americas | Low unlock value. Possible dry-zone replacement. |
| `RESOURCE_HIDES` | Bonus | A | Camp | Global | Pastoral and frontier biomes worldwide | No unlock value. Avoid for curated pass. |
| `RESOURCE_HORSES` | Empire | A/E/M | Pasture | Global | Steppe and temperate grasslands worldwide | Medium unlock value in theory, but too broad for phase 1. |
| `RESOURCE_INCENSE` | City | A/E | Plantation | Multi-area | Arabia, the Horn of Africa, India, and mainland Southeast Asia | Medium unlock value. Strong warm-trade replacement candidate. |
| `RESOURCE_IRON` | Empire | A/E | Mine | Global | Hill and ore belts worldwide | Medium unlock value in theory, but too broad for hard exclusivity. |
| `RESOURCE_IVORY` | Empire | A/E/M | Camp | Multi-area | Sub-Saharan Africa and the Indian elephant belt | Medium unlock value. Current shortlist edge case. |
| `RESOURCE_JADE` | City | A/E | Quarry | Multi-area | China and mainland East Asia with a Central American outlier | Medium unlock value. Current shortlist edge case. |
| `RESOURCE_KAOLIN` | City | A/E/M | Quarry | Multi-area | East Asia, Mediterranean clay belts, and scattered American deposits | Low unlock value. Technical replacement only. |
| `RESOURCE_LAPIS_LAZULI` | City | A | None / passive | Regional | Afghanistan-Iran highlands with minor outliers | Medium unlock value. Strong geography, but no mapped improvement. Active in testing phase. |
| `RESOURCE_MARBLE` | Empire | A/E/M | Quarry | Multi-area | Mediterranean, Anatolia, Balkans, India, and scattered quarry belts | Low unlock value. Good realism filler, not a gate. |
| `RESOURCE_PEARLS` | City | A/E/M | Fishing Boat | Multi-area | Gulf, Indian Ocean, South China Sea, Indonesia, and Australia | Kept active for the testing phase alongside Dyes; reevaluate after logs. |
| `RESOURCE_SALT` | City | A | Mine | Global | Inland basins, salt flats, and desert margins worldwide | Medium unlock value in theory, but too broad. |
| `RESOURCE_SILK` | City | A/E/M | Plantation | Regional | China, Tarim, Transoxiana, and North India silk-road belt | High unlock value. Keep in shortlist. |
| `RESOURCE_SILVER` | Empire | A/E/M | Mine | Global | Hill and mountain belts worldwide | Low unlock value. Too common for hard regional use. |
| `RESOURCE_SILVER_DISTANT_LANDS` | Empire | A/E/M* | Mine | Global | Distant-lands silver belts, same geography as the main silver variant | Low unlock value. Variant only. |
| `RESOURCE_WINE` | Empire | A/E/M | Plantation | Multi-area | Mediterranean, Caucasus, western Europe, and secondary New World belts | Medium unlock value. Good fallback, weak strict gate. |
| `RESOURCE_WOOL` | Bonus | A | Pasture | Global | Temperate pastoral belts worldwide | No unlock value. Avoid for curated pass. |
| `RESOURCE_MANGOS` | City | A/E | Plantation | Multi-area | Tropical lowlands and coastal tropics (Mesoamerica, SE Asia, Amazon fringe) | Low unlock value. Good tropical realism resource. |
| `RESOURCE_CLAY` | Bonus | A/E | Clay Pit Resource | Global | Floodplains, marshes, oasis margins, and sedimentary basins | Technical building material; realism filler, not a gate. |
| `RESOURCE_FLAX` | City | A/E | Plantation | Multi-area | Temperate river plains and grasslands | Textile feedstock; replacement candidate for plantation-like belts. |
| `RESOURCE_RUBIES` | Bonus | A/E | Mine Resource | Multi-area | Gem-bearing hill belts in tropical and arid uplands | Luxury-like; low unlock value, good realism filler. |
| `RESOURCE_RICE` | Empire | A/E/M | Plantation | Global | Wet lowlands, marsh and mangrove coasts (primarily Asia, plus tropical pockets) | Staple-like resource. Keep out of the curated shortlist even where geography is plausible. |
| `RESOURCE_LIMESTONE` | Empire | A/E/M | Quarry | Multi-area | Sedimentary outcrops and quarry belts near coasts and uplifts | Strong same-family Jade fallback after Gypsum. |
| `RESOURCE_TIN` | Bonus | A/E/M | Mine Resource | Multi-area | Tin-producing hill belts in several continents | Historic metal; not a strong regional gate. |
| `RESOURCE_LLAMAS` | Bonus | A/E/M | Pasture | Regional | Andean highlands and adjacent plateaus | Strong regional candidate for South America. Active in testing phase. |
| `RESOURCE_HARDWOOD` | Empire | A/E/M | Woodcutter Resource | Global | Heavy-timber belts from boreal to tropical forests | Useful realism filler, but too broad for the curated shortlist. |
| `RESOURCE_WILD_GAME` | Bonus | A/E | Camp | Multi-area | Forest and grassland hunting grounds | Broadest camp-family fallback if Ivory ever needs replacement. |
| `RESOURCE_CRABS` | Bonus | A/E/M | Fishing Boat | Global | Coastal and navigable-river zones | Too broad for the default shortlist. Technical same-family marine fallback only. |
| `RESOURCE_COWRIE` | Bonus | A/E/M | Fishing Boat | Multi-area | Warm coastal waters (historically Indo-Pacific) | Marine luxury/middle-plate realism; not a gate. |
| `RESOURCE_TURTLES` | Bonus | A/E | Fishing Boat | Multi-area | Tropical and warm-temperate coasts | Marine coastal realism resource. |

### B. Exploration-start resources

| Resource | Class | Ages | Improvement | Bucket | Likely Earth footprint | Planning notes |
| --- | --- | --- | --- | --- | --- | --- |
| `RESOURCE_CLOVES` | City | E | None / passive | Regional | Maluku and maritime Indonesia | High unlock value. Active in testing phase. |
| `RESOURCE_COCOA` | Empire | E/M | Woodcutter Resource | Multi-area | Mesoamerica, Amazon fringe, Gulf of Guinea, and Indonesia | Medium unlock value. Tropical replacement candidate. |
| `RESOURCE_FURS` | Empire | E/M | Camp | Multi-area | Boreal North America and northern Eurasia | Low unlock value. Cold-climate replacement candidate. |
| `RESOURCE_NITER` | Empire | E/M | Mine | Global | Dry plains, floodplains, desert margins, and steppe belts across many continents | Medium unlock value in theory, but too broad for phase 1. |
| `RESOURCE_SPICES` | Empire | E/M | Woodcutter Resource | Multi-area | India, Sri Lanka, Southeast Asia, East Africa, and tropical archipelagos | Medium unlock value. Strong warm-climate fallback. |
| `RESOURCE_SUGAR` | Empire | E/M | Plantation | Multi-area | Tropical lowlands and floodplains in the Caribbean, Brazil, India, and Southeast Asia | Low unlock value. Good plantation fallback. |
| `RESOURCE_TEA` | Empire | E/M | Plantation | Regional | China, Assam, Himalayan rim, and mainland Southeast Asia | High unlock value. Keep in shortlist once age is active. |
| `RESOURCE_TRUFFLES` | City | E/M | Camp | Multi-area | Temperate forest belts in western Europe, the Balkans, Anatolia, and East Asia | Low unlock value. Luxury filler only. |
| `RESOURCE_PITCH` | Bonus | E/M | Woodcutter Resource | Multi-area | Taiga, forested plains and mixed woodlands used historically for tar/shipwright resources | Industrial or shipbuilding filler; realism candidate, not a strict gate. |
| `RESOURCE_WHALES` | Bonus | E/M | Fishing Boat | Multi-area | Cold and temperate coasts in the North Atlantic, North Pacific, and Southern Ocean | Low unlock value. Marine replacement only. |

### C. Modern-start resources

| Resource | Class | Ages | Improvement | Bucket | Likely Earth footprint | Planning notes |
| --- | --- | --- | --- | --- | --- | --- |
| `RESOURCE_COFFEE` | Bonus | M | Plantation | Multi-area | Ethiopian-Arabian highlands plus tropical America and Southeast Asia | Medium unlock value. Strong plantation replacement. |
| `RESOURCE_CITRUS` | Bonus | M | Plantation | Multi-area | Mediterranean and subtropical belts on several continents | Low unlock value. Fallback only. |
| `RESOURCE_COAL` | Empire | M | Mine | Global | Industrial ore belts across most continents | Low unlock value. Keep out of regional shortlist. |
| `RESOURCE_NICKEL` | City | M | None / passive | Multi-area | Canada, Russia, New Caledonia, and Indonesia ore belts | Low unlock value. No mapped improvement. |
| `RESOURCE_OIL` | Empire | M | Oil Rig | Multi-area | Middle East, Caspian, North Africa, the Americas, and Russia | Medium unlock value. Strong geography, but modern only. |
| `RESOURCE_QUININE` | Bonus | M | Woodcutter Resource | Multi-area | Tropical forest and savanna belts in the Andes, Africa, and South Asia | Low unlock value. Health-themed filler. |
| `RESOURCE_RUBBER` | Empire | M | Woodcutter Resource | Multi-area | Amazon, Congo, and mainland or insular Southeast Asia | Medium unlock value. Good tropical industrial fallback. |
| `RESOURCE_TOBACCO` | Bonus | M | Plantation | Multi-area | The Americas plus secondary warm-temperate belts elsewhere | Low unlock value. Fallback only. |