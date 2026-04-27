# YnAMP Maps

Active map list for the current Civ7 build of YnAMP.

Last reviewed: 2026-04-15  
YnAMP version: 1.0.14  
Verified against: Civ7 v1.3.2

## Active map scripts

| Map | Script | Type | Default size |
|---|---|---|---|
| Terra (YnAMP) | `modules/maps/terra-map/terra-ynamp.js` | Generated | YnAMP sizes |
| Greatest Earth Map (YnAMP) | `modules/maps/greatest-earth-map/greatest-earth-map.js` | Fixed geography / TSL | `MAPSIZE_GREATEST_EARTH` |
| Giant Earth Map (YnAMP) | `modules/maps/giant-earth-map/giant-earth-map.js` | Fixed geography / TSL | `MAPSIZE_GIANT` |

## Map details

### Terra (YnAMP)

- Purpose: Terra-style generated map using a Voronoi two-landmass setup.
- Main options:
  - `TerraLandmassRatio`
  - `TerraSpawnMode`
- Best use: homeland vs new-world style games.
- Notes: the current implementation documents this as the best target for Terra-oriented cultural-region start options.

### Greatest Earth Map (YnAMP)

- Purpose: compact fixed-geography Earth map.
- Grid: 104 x 64.
- Default players: 8.
- Natural wonders: 6 by map definition.
- Best use: TSL Earth play with a smaller footprint than Giant Earth.

### Giant Earth Map (YnAMP)

- Purpose: large fixed-geography Earth map.
- Grid: 180 x 94.
- Default players: 12.
- Natural wonders: 6 by map definition.
- Best use: TSL Earth play with more room and stronger regional separation.
- Limitation: the in-game text warns about missing tile textures beyond width 127.

## YnAMP map sizes

| Map size type | Grid | Default players | Typical use |
|---|---|---|---|
| `MAPSIZE_GREATEST_EARTH` | 104 x 64 | 8 | Greatest Earth only |
| `MAPSIZE_MASSIVE` | 128 x 80 | 12 | large generated maps |
| `MAPSIZE_GIANT` | 180 x 94 | 12 | Giant Earth and other very large layouts |
| `MAPSIZE_LUDICROUS` | 230 x 116 | 12 | experimental very large generated layouts |

## Custom options by map type

### Available on Earth maps

- `NWPlacementMode`
- `HomelandMode`

### Available on Terra

- `TerraLandmassRatio`
- `TerraSpawnMode`
- `HomelandMode`

### Available on supported generated maps

- `StartPosition` domain entries for relative-distance and cultural-region shuffles.