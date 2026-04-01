// test.js
/**
 * 
 * 
 */
import { MapDims } from '/base-standard/scripts/kd-tree.js';

console.log("Loading YNAMP test.js");
function requestInitializationParameters(initParams) {
    // Gedemon <<<<
    console.log("**** YNAMP - requestInitializationParameters ****");
    // Gedemon >>>>/
    //engine.call("SetAgeInitializationParameters", initParams);
}
function generateTransition() {

    // Gedemon <<<<
    console.log("*** YNAMP generateTransition ***");
    // Gedemon >>>>
}

function requestMapData(initParams) {
    console.log("*** YNAMP requestMapData ***");
}
function generateMap() {
    console.log("*** YNAMP generateMap ***");
    // kd-tree.js MapDims only defines indices 0-4 (the 5 base game sizes).
    // continents-voronoi.js calls voronoiMap.init(mapInfo.$index), and continents.js
    // looks up MapDims[mapSize] using that row index — NOT the hash from getMapSize().
    // Patch using mapInfo.$index as the key so the lookup succeeds.
    const uiMapSize = GameplayMap.getMapSize();
    const mapInfo = GameInfo.Maps.lookup(uiMapSize);
    if (mapInfo && MapDims[mapInfo.$index] === undefined) {
        MapDims[mapInfo.$index] = { x: mapInfo.GridWidth, y: mapInfo.GridHeight };
        console.log(`*** YNAMP patched MapDims[${mapInfo.$index}] = { x: ${mapInfo.GridWidth}, y: ${mapInfo.GridHeight} } (${mapInfo.MapSizeType})`);
    }
}

// Register listeners.
engine.on('RequestAgeInitializationParameters', requestInitializationParameters);
engine.on('GenerateAgeTransition', generateTransition);

// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("Loaded YNAMP test.js");