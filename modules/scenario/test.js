// test.ts
/**
 * 
 * 
 */
console.log("Loading YNAMP test.ts");
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
// Register listeners.
engine.on('RequestAgeInitializationParameters', requestInitializationParameters);
engine.on('GenerateAgeTransition', generateTransition);
console.log("Loaded YNAMP test.ts");
