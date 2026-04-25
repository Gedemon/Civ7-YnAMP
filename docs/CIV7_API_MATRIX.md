# Civ7 API Matrix

Source-backed matrix for the Civ7 scripting surface relevant to YnAMP map work.

Last reviewed: 2026-04-19  
YnAMP version: 1.0.14  
Verified against: Civ7 v1.3.2

This document separates the scripting surface by context. That matters because Civ7 exposes different objects in App UI / FireTuner than it does in pure Tuner or MapGen scripts, and some native bindings are callable without being enumerable.

## Evidence classes

- `runtime-confirmed`: observed directly in runtime logs or probes.
- `shipped-use`: used by Firaxis shipped `.js` or `.ltp` files.
- `string-inferred`: visible in executable or dump strings but not yet runtime-confirmed in the current context.
- `native-only`: visible as an engine command or schema concept, but no confirmed JS entrypoint in the reviewed files.

## Context boundaries

| Context | Primary surface | Typical use |
|---|---|---|
| `App UI / FireTuner` | `WorldBuilder`, `WorldBuilder.MapPlots`, `g_TunerInput.panels`, `Visibility`, `MapConstructibles`, `Game.PlayerOperations` | In-game tuner actions and world editing from panels |
| `Pure Tuner` | Dumped globals, builder libraries, gameplay libraries | Research and low-level inspection outside normal App UI |
| `MapGen scripts` | `TerrainBuilder`, `ResourceBuilder`, `FertilityBuilder`, `GameplayMap`, `FractalBuilder`, `AreaBuilder` | Map generation and scripted terrain/resource placement |

## App UI / FireTuner

| Symbol | Likely signature | Mutates state | Evidence | Sources | Notes |
|---|---|---:|---|---|---|
| `WorldBuilder` | object root | No | `runtime-confirmed`, `string-inferred` | `Logs/UI.log` root dump at 2026-04-19 15:43:16; `References/stringsCiv7TOTexe.txt:88562-88565` | Runtime enumeration is incomplete. Current dump sees `MapPlots` and `isActive`; strings additionally suggest hidden `startBlock` and `endBlock`. |
| `WorldBuilder.isActive` | boolean property | No | `runtime-confirmed` | `Logs/UI.log` root dump at 2026-04-19 15:43:16 | Confirmed visible from App UI root dump. |
| `WorldBuilder.MapPlots` | object property | No | `runtime-confirmed`, `string-inferred` | `Logs/UI.log` root dump at 2026-04-19 15:43:16; `References/stringsCiv7TOTexe.txt:88553-88561` | Callable native binding with zero enumerable own-properties in current runtime. |
| `WorldBuilder.MapPlots.setAllRevealed` | `(playerId, revealed) -> bool?` | Yes | `runtime-confirmed`, `shipped-use`, `string-inferred` | `Logs/UI.log` probe at 2026-04-19 16:06:16; `Base/Platforms/Windows/Config/TunerPanels/Map.ltp:31-45`; `Mods/ynamp/modules/ui/tuner/ynamp-firetuner.js:325-338`; `References/stringsCiv7TOTexe.txt:88559`; `References/stringsCiv7TOTexe.txt:135352` | Confirmed callable in App UI. |
| `WorldBuilder.MapPlots.setRevealed` | `(playerId, loc, revealed) -> bool?` | Yes | `runtime-confirmed`, `string-inferred` | `Logs/UI.log` signature probe at 2026-04-19 18:41:35; `References/stringsCiv7TOTexe.txt:88558`; `References/stringsCiv7TOTexe.txt:135351` | Signature probe reported `setRevealed` as a native function; runtime mutating semantics still require cautious confirmation before use. |
| `WorldBuilder.MapPlots.setFeature` | `(featureType, loc[, direction]) -> bool?` | Yes | `runtime-confirmed`, `shipped-use`, `string-inferred` | `Logs/UI.log` probe at 2026-04-19 16:06:16; `Base/modules/base-standard/ui/tuner-input/tuner-input.js:48`; `References/stringsCiv7TOTexe.txt:88555`; `References/stringsCiv7TOTexe.txt:135348` | Shipped App UI uses the 2-argument form; strings imply an optional direction parameter exists in the native wrapper. |
| `WorldBuilder.MapPlots.setTerrain` | `(terrainType, loc) -> bool?` | Yes | `runtime-confirmed`, `shipped-use`, `string-inferred` | `Logs/UI.log` probe at 2026-04-19 16:06:16; `Base/modules/base-standard/ui/tuner-input/tuner-input.js:52`; `References/stringsCiv7TOTexe.txt:88554`; `References/stringsCiv7TOTexe.txt:135347` | Editor-wrapper API, not the same contract as `TerrainBuilder.setTerrainType`. |
| `WorldBuilder.MapPlots.setResource` | `(resourceType, loc, amount) -> bool?` | Yes | `runtime-confirmed`, `shipped-use`, `string-inferred` | `Logs/UI.log` probe at 2026-04-19 16:06:16; `Base/modules/base-standard/ui/tuner-input/tuner-input.js:56-61`; `References/stringsCiv7TOTexe.txt:88557`; `References/stringsCiv7TOTexe.txt:135350` | Editor-wrapper API, not the same contract as `ResourceBuilder.setResourceType`. |
| `WorldBuilder.MapPlots.setFertility` | `(fertilityType, loc) -> bool?` | Yes | `runtime-confirmed`, `shipped-use`, `string-inferred` | `Logs/UI.log` probe at 2026-04-19 16:06:16; `Base/modules/base-standard/ui/tuner-input/tuner-input.js:64`; `References/stringsCiv7TOTexe.txt:88556`; `References/stringsCiv7TOTexe.txt:135349` | Editor-wrapper API, not the same contract as `FertilityBuilder.setFertilityType`. |
| `WorldBuilder.MapPlots.setOwnership` | `(playerId, loc) -> bool?` | Yes | `runtime-confirmed`, `shipped-use`, `string-inferred` | `Logs/UI.log` probe at 2026-04-19 16:06:16; `Base/modules/base-standard/ui/tuner-input/tuner-input.js:96`; `References/stringsCiv7TOTexe.txt:88560`; `References/stringsCiv7TOTexe.txt:135353` | Used for both assignment and clearing with `PlayerIds.NO_PLAYER`. |
| `WorldBuilder.MapPlots.setBiome` | `(biomeType, loc) -> bool?` | Yes | `runtime-confirmed`, `shipped-use`, `string-inferred` | `Logs/UI.log` probe at 2026-04-19 16:06:16; `Base/modules/base-standard/ui/tuner-input/tuner-input.js:104`; `References/stringsCiv7TOTexe.txt:88561`; `References/stringsCiv7TOTexe.txt:135354` | Wrapper layer for editor usage. |
| `Visibility.revealAllPlots` | `(playerId) -> void` | Yes | `shipped-use` | `Base/Platforms/Windows/Config/TunerPanels/Map.ltp:46-59` | Alternate visibility path used by Firaxis. Separate from `WorldBuilder.MapPlots.setAllRevealed`. |
| `Game.PlayerOperations.sendRequest` | `(localPlayerId, opName, args) -> void` | Yes | `shipped-use` | `Base/modules/base-standard/ui/tuner-input/tuner-input.js:15-46`, `Base/modules/base-standard/ui/tuner-input/tuner-input.js:67-93`, `Base/modules/base-standard/ui/tuner-input/tuner-input.js:118-206` | Used by App UI tuner for units, towns, districts, improvements, and destruction requests. |
| `MapConstructibles.addRoute` | `(x, y, routeHash) -> void` | Yes | `shipped-use` | `Base/modules/base-standard/ui/tuner-input/tuner-input.js:100-103` | Separate constructible path, not a `MapPlots` method. |
| `MapConstructibles.removeRoute` | `(x, y) -> void` | Yes | `shipped-use` | `Base/modules/base-standard/ui/tuner-input/tuner-input.js:163-166` | Route removal path. |
| `MapConstructibles.addDiscoveryType` | `(discoveryHash, x, y) -> void` | Yes | `shipped-use` | `Base/modules/base-standard/ui/tuner-input/tuner-input.js:107-113` | Discovery placement path. |
| `MapConstructibles.addIndependentType` | `(x, y) -> void` | Yes | `shipped-use` | `Base/modules/base-standard/ui/tuner-input/tuner-input.js:114-116` | Independent placement path. |

## Pure Tuner and MapGen

| Symbol | Likely signature | Mutates state | Evidence | Sources | Notes |
|---|---|---:|---|---|---|
| `TerrainBuilder.setTerrainType` | `(x, y, terrainType)` | Yes | `shipped-use`, `string-inferred` | `References/dump this (Tuner context).txt:853-859`; `Base/modules/base-standard/maps/*.js`; `Mods/ynamp/MODDING NOTES.md:170` | Core map-generation terrain setter. |
| `TerrainBuilder.setBiomeType` | `(x, y, biomeType)` | Yes | `shipped-use`, `string-inferred` | `References/dump this (Tuner context).txt:853-859`; `Base/modules/base-standard/maps/feature-biome-generator.js`; `Mods/ynamp/modules/maps/ynamp-natural-wonders.js` | Map-generation biome setter. |
| `TerrainBuilder.setFeatureType` | `(x, y, featureParam)` | Yes | `shipped-use`, `string-inferred` | `References/dump this (Tuner context).txt:853-859`; `Base/modules/base-standard/maps/natural-wonder-generator.js`; `Mods/ynamp/modules/maps/ynamp-natural-wonders.js` | Uses the mapscript `featureParam` shape, not the App UI `MapPlots.setFeature` wrapper contract. |
| `TerrainBuilder.setLandmassRegionId` | `(x, y, landmassId)` | Yes | `shipped-use` | `Mods/ynamp/MODDING NOTES.md:170`; multiple base map scripts | Core map-generation landmass tagging setter. |
| `TerrainBuilder.addPlotTag` | `(x, y, tag)` | Yes | `shipped-use` | `Mods/ynamp/MODDING NOTES.md:170`; base map scripts | Additive plot tag setter. |
| `TerrainBuilder.setPlotTag` | `(x, y, tag)` | Yes | `shipped-use` | base map scripts and dumped tuner context | Replaces existing tag. |
| `ResourceBuilder.setResourceType` | `(x, y, resourceType)` | Yes | `shipped-use`, `string-inferred` | `References/dump this (Tuner context).txt:825`; `Base/modules/base-standard/maps/resource-generator.js`; `Mods/ynamp/modules/maps/ynamp-utilities.js` | Core mapscript resource setter. Separate from `WorldBuilder.MapPlots.setResource`. |
| `FertilityBuilder.setFertilityType` | `(x, y, fertilityType)` | Yes | `string-inferred` | `References/dump this (Tuner context).txt:118` | Tuner-context fertility setter naming differs from App UI wrapper. |
| `GameplayMap.getTerrainType` | `(x, y) -> terrainType` | No | `shipped-use` | `Mods/ynamp/MODDING NOTES.md:170-181`; base map scripts | Getter side of the builder/getter split. |
| `GameplayMap.getFeatureType` | `(x, y) -> featureType` | No | `shipped-use` | `Mods/ynamp/MODDING NOTES.md:170-181`; base map scripts | Getter side of the builder/getter split. |
| `GameplayMap.getLandmassRegionId` | `(x, y) -> landmassId` | No | `shipped-use` | `Mods/ynamp/MODDING NOTES.md:170-181`; base map scripts | Do not call a non-existent `TerrainBuilder` getter here. |
| `GameplayMap.getIndexFromXY` | `(x, y) -> plotIndex` | No | `shipped-use` | `References/civ7_mapscript_api.md`; base map scripts | Useful bridge between coordinate and serialized plot tables. |
| `GameplayMap.getLocationFromIndex` | `(plotIndex) -> {x, y}` | No | `shipped-use` | `References/civ7_mapscript_api.md`; base map scripts | Inverse coordinate lookup helper. |
| `FractalBuilder.create` | `(id, width, height, grain, flags)` | Yes | `shipped-use` | `References/dump this (Tuner context).txt:118-130`; base map scripts | Core terrain-generation primitive. |
| `AreaBuilder.recalculateAreas` | `() -> void` | Yes | `shipped-use` | `References/civ7_mapscript_api.md`; base map scripts | Rebuilds area groupings after terrain changes. |

## WorldBuilder persistence mapping

| JS or native command | Schema target | Evidence | Notes |
|---|---|---|---|
| `WorldBuilder.MapPlots.setTerrain` / `CommandSetTerrain` | `Plots.TerrainType` | `Base/Assets/schema/worldbuilder/schema-worldbuilder-map.sql:55-66`; `References/stringsCiv7TOTexe.txt:134626` | Strong schema and native-command alignment. |
| `WorldBuilder.MapPlots.setBiome` / `CommandSetBiome` | `Plots.BiomeType` | `Base/Assets/schema/worldbuilder/schema-worldbuilder-map.sql:55-66`; `References/stringsCiv7TOTexe.txt:134629` | Strong schema and native-command alignment. |
| `WorldBuilder.MapPlots.setFeature` / `CommandSetFeature` | `PlotFeatures.FeatureType` | `Base/Assets/schema/worldbuilder/schema-worldbuilder-map.sql:103-107`; `References/stringsCiv7TOTexe.txt:134627` | App UI wrapper vs mapscript setter contract differs. |
| `WorldBuilder.MapPlots.setResource` / `CommandSetResource` | `PlotResources.ResourceType`, `PlotResources.ResourceCount` | `Base/Assets/schema/worldbuilder/schema-worldbuilder-map.sql:96-101`; `References/stringsCiv7TOTexe.txt:134630` | Resource amount is part of the editor wrapper signature. |
| `WorldBuilder.MapPlots.setOwnership` / `CommandSetOwnership` | `PlotOwners.Owner`, plus related owner fields | `Base/Assets/schema/worldbuilder/schema-worldbuilder-map.sql:124-130`; `References/stringsCiv7TOTexe.txt:134633` | The command likely affects more than just `Owner`, but ownership persistence clearly lives here. |
| `WorldBuilder.MapPlots.setRevealed` / `setAllRevealed` / `CommandSetRevealed` | `RevealedPlots` | `Base/Assets/schema/worldbuilder/schema-worldbuilder-map.sql:138-142`; `References/stringsCiv7TOTexe.txt:134632` | Signature probe confirms `setRevealed` exists; exercise caution when invoking (use sandbox/test map). |


## Misuse guardrails

- Do not assume the App UI `WorldBuilder.MapPlots` wrapper is the same contract as the mapscript builders.
- `WorldBuilder.MapPlots.setFeature(featureType, loc[, direction])` is not the same API as `TerrainBuilder.setFeatureType(x, y, featureParam)`.
- `WorldBuilder.MapPlots.setResource(resourceType, loc, amount)` is not the same API as `ResourceBuilder.setResourceType(x, y, resourceType)`.
- `WorldBuilder.MapPlots.setFertility(fertilityType, loc)` is not the same API as `FertilityBuilder.setFertilityType(x, y, fertilityType)`.
- For map generation, prefer builder setters plus `GameplayMap` getters. For in-game tuner editing, prefer the `WorldBuilder` wrapper surface used by shipped panels.
- Do not treat `Object.getOwnPropertyNames()` as a complete discovery mechanism for Civ7 native scripting libraries.
