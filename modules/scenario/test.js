// test.js
/**
 * 
 * 
 */
console.log("Loading YNAMP test.js");
function requestInitializationParameters(initParams) {
    // Gedemon <<<<
    console.log("**** YNAMP - requestInitializationParameters ****");
....// Gedemon >>>>/
    //engine.call("SetAgeInitializationParameters", initParams);
}
function generateTransition() {

    // Gedemon <<<<
    console.log("*** YNAMP generateTransition ***");
....// Gedemon >>>>
}

function requestMapData(initParams) {
    console.log("*** YNAMP requestMapData ***");
}
function generateMap() {
    console.log("*** YNAMP generateMap ***");
}

// Register listeners.
engine.on('RequestAgeInitializationParameters', requestInitializationParameters);
engine.on('GenerateAgeTransition', generateTransition);

// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("Loaded YNAMP test.js");