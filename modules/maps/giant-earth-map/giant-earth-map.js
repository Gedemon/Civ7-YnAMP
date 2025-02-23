// giant-earth-map.js
/**
 * Giant Earth Map
 * 
 */
console.log("loading script giant-earth-map.js");
import { generateYnAMP } from '/ged-ynamp/maps/ynamp-map-loading.js';
import { GetMap } from '/ged-ynamp/maps/giant-earth-map/giant-earth-data.js';

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
    const mapName = 'GiantEarthMap';
	let genParameters = {
        westStart: 1,
        westEnd: 110,
        eastStart: 113,
        eastEnd: 171
    };
    let importedMap = GetMap();
    generateYnAMP(mapName, importedMap, genParameters);
}

// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("loaded giant-earth-map.js");
//# 
