console.log("Generating using script regional-earth-massive.js");

import { GetMap } from '/ged-ynamp/maps/giant-earth-map/giant-earth-data.js';
import { getConfiguredEarthMapContext } from '/ged-ynamp/maps/earth-map-context.js';
import { generateYnAMP } from '/ged-ynamp/maps/ynamp-map-loading.js';

function requestMapData(initParams) {
    initParams.wrapX = true;   // not implemented ? (re-tested 19 apr 2026)
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
    let importedMap = GetMap();
    let mapContext = getConfiguredEarthMapContext(undefined, undefined, importedMap);
    if (!mapContext) {
        console.log("RegionalEarthMassive: invalid or unresolved configured Earth context.");
        return;
    }

    generateYnAMP(mapContext.mapName, importedMap, { sourceMap: importedMap, mapContext });
}

engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);