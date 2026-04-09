// test.js
/**
 * 
 * 
 */
console.log("Loading YNAMP test.js");
function requestInitializationParameters(initParams) {
    // Gedemon <<<<
    console.log("**** YNAMP TEST requestInitializationParameters ****");
    // Gedemon >>>>/
    //engine.call("SetAgeInitializationParameters", initParams);
}
function generateTransition() {

    // Gedemon <<<<
    console.log("*** YNAMP TEST generateTransition ***");
    // Gedemon >>>>
}

function requestMapData(initParams) {
    console.log("*** YNAMP TEST requestMapData ***");
}
function generateMap() {
    console.log("*** YNAMP TEST generateMap ***");
}

// Register listeners.
engine.on('RequestAgeInitializationParameters', requestInitializationParameters);
engine.on('GenerateAgeTransition', generateTransition);

// Register listeners.
engine.on('RequestMapInitData', requestMapData);
engine.on('GenerateMap', generateMap);

console.log("Loaded YNAMP test.js");