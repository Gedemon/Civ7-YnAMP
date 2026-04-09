// ynamp-mapsize-patch.js
//
// Patches MapDims for custom YnAMP map sizes so voronoi/kd-tree map scripts work.
//
// kd-tree.js MapDims only defines indices 0-4 (the 5 base game sizes).
// continents-voronoi.js calls voronoiMap.init(mapInfo.$index), and continents.js
// looks up MapDims[mapSize] using that row index — NOT the hash from getMapSize().
// Patch using mapInfo.$index as the key so the lookup succeeds for any custom size.

console.log("Loading ynamp-mapsize-patch.js");

import { MapDims } from '/base-standard/scripts/kd-tree.js';

function generateMap() {
    const uiMapSize = GameplayMap.getMapSize();
    const mapInfo = GameInfo.Maps.lookup(uiMapSize);
    if (mapInfo && MapDims[mapInfo.$index] === undefined) {
        MapDims[mapInfo.$index] = { x: mapInfo.GridWidth, y: mapInfo.GridHeight };
        console.log(`[YnAMP] Patched MapDims[${mapInfo.$index}] = { x: ${mapInfo.GridWidth}, y: ${mapInfo.GridHeight} } (${mapInfo.MapSizeType})`);
    }
}

engine.on('GenerateMap', generateMap);

console.log("Loaded ynamp-mapsize-patch.js");
