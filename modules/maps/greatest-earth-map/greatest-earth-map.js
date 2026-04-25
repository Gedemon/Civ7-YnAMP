// greatest-earth-map.js
/**
 * greatest-earth-map
 * 
 */
console.log("loading script greatest-earth-map.js");
import { generateYnAMP } from '/ged-ynamp/maps/ynamp-map-loading.js';
import { GetMap } from '/ged-ynamp/maps/greatest-earth-map/greatest-earth-data.js';

function requestMapData(initParams) {
    console.log(initParams.width);
    console.log(initParams.height);
    console.log(initParams.topLatitude);
    console.log(initParams.bottomLatitude);
    console.log(initParams.wrapX);
    console.log(initParams.wrapY);
    console.log(initParams.mapSize);
    engine.call("SetMapInitData", initParams);
}
function generateMap() {
    const mapName = 'GreatestEarthMap';
    generateYnAMP(mapName, GetMap());
}

// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("Loaded greatest-earth-map.js");
