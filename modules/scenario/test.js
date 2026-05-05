// test.js
/**
 * 
 * 
 */

const DEBUG = true;

function logGetSet(location) {
    console.log("[YnAMP "+location+"] On Game Started");
    
    if (typeof GameTutorial === "undefined") {
      console.log("[YnAMP "+location+"] GameTutorial unavailable");
    } else {
      console.log("[Ynamp "+location+"] GameTutorial.setProperty = " + GameTutorial.setProperty + ", GameTutorial.getProperty = " + GameTutorial.getProperty)
    }
    
    if (typeof Game === "undefined") {
      console.log("[YnAMP "+location+"] Game unavailable");
    } else {
      console.log("[Ynamp "+location+"] Game.setProperty = " + Game.setProperty + ", Game.getProperty = " + Game.getProperty)
    }
    
    if (typeof Automation === "undefined") {
      console.log("[YnAMP "+location+"] Automation unavailable");
    } else {
      console.log("[Ynamp "+location+"] Automation.setParameter = " + Automation.setParameter + ", Automation.getParameter = " + Automation.getParameter)
    }
}

console.log("Loading YNAMP test.js");
function requestInitializationParameters(initParams) {
    // Gedemon <<<<
    console.log("**** YNAMP TEST requestInitializationParameters ****");
    // Gedemon >>>>/
    //engine.call("SetAgeInitializationParameters", initParams);
}
function generateTransition() {

  console.log("*** YNAMP TEST generateTransition PRE ***");
  if (DEBUG) {
    logGetSet("generateTransition");
  }

}

function requestMapData(initParams) {
  console.log("*** YNAMP TEST requestMapData ***");
  if (DEBUG) {
    logGetSet("requestMapData");
  }
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