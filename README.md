# YnAMP for Civilization VII

Yet (not) Another Maps Pack for Civilization VII.


## What this mod adds

YnAMP extends Civ7 with larger map sizes, Earth maps with fixed geography, and custom map scripts built around the current Civ7 MapScript API.

Included content:

- Larger playable map sizes for custom scripts and Earth maps.
- Giant Earth and Greatest Earth maps with true-start support.
- Geographic Unlock for next-age Civilizations on TSL maps.
- Terra Map with Old World/New World civilization split.
- Terra Fractal and Continents Terra generated maps sharing Terra-style option surfaces.
- Custom start-position shuffles for cultural and Terra-style distribution.
- TSL natural wonder placement modes for Earth maps.

## Included maps

Active map scripts in the current build:

| Map | Type | Main use |
|---|---|---|
| Terra (YnAMP) | Generated | Two-landmass Terra-style Voronoi map |
| Terra Fractal (YnAMP) | Generated | Fractal Terra layout for explicit Old World / New World play |
| Continents Terra (YnAMP) | Generated | Compatibility clone of the current Terra Fractal behavior |
| Greatest Earth Map (YnAMP) | Fixed geography / TSL | Compact Earth map with true starts |
| Giant Earth Map (YnAMP) | Fixed geography / TSL | Large Earth map with true starts |
| Massive Regional Earth Map (YnAMP) | Fixed geography / TSL | "Colonization", "Old World", "Indo-Pacific" regions with true starts |

See [MAPS.md](MAPS.md) for dimensions, options, and map-specific notes.

## Installation

1. Place the mod in your Civ7 mods directory.
2. Start Civilization VII 
3. Check if YnAMP is enabled in the additional content / add-ons menu.
4. Start a new game and select one of the YnAMP map scripts.

Mod's folder path:

- Windows : `%localappdata%\Firaxis Games\Sid Meier's Civilization VII\Mods`
- Mac : `~/Library/Application Support/Civilization VII/Mods`
- Linux : `Home\My Games\Sid Meier's Civilization VII\Mods`

## How to use it

For Earth maps:

1. Select either Giant Earth Map or Greatest Earth Map.
2. Optional: configure Natural Wonders Placement on TSL Maps.

For generated maps:

1. Select Terra (YnAMP), Terra Fractal (YnAMP), or Continents Terra (YnAMP).
2. Choose one of the map sizes.
3. Optional: configure Region Tagging Mode and custom start-position options.
4. Terra exposes landmass ratio and spawn distribution options, while Terra Fractal and Continents Terra also expose ocean separation, distant islands, and fractal landmass-count options.


## Known limitations

- Civ7 engine doesn't render textures on tiles where x > 128 on larger map sizes.
- Some natural wonder footprint notes are still empirical and need more validation across repeated runs.
