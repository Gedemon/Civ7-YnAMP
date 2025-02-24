// greatest-earth-map.js
/**
 * greatest-earth-map
 * 
 */
console.log("loading script greatest-earth-map.js");
import { generateYnAMP } from '/ged-ynamp/maps/ynamp-map-loading.js';
import { generateYnAMP2 } from '/ged-ynamp/maps/ynamp-map-loading.js';
import { GetMap } from '/ged-ynamp/maps/greatest-earth-map/greatest-earth-data.js';
//import { GetMap2 } from '/ged-ynamp/maps/greatest-earth-map/greatest-earth-data2.js'; // EXPERIMENTAL: Data saved directly in Civ7 format

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
	let genParameters = {
        westStart: 1,
        westEnd: 31,
        eastStart: 32,
        eastEnd: 102
    };
    let importedMap = GetMap();
    //let importedMap2 = GetMap2();
    generateYnAMP2(mapName, importedMap, null/*importedMap2*/, genParameters); // Passing null will not use the data in Civ7 format
}

// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("Loaded greatest-earth-map.js");
