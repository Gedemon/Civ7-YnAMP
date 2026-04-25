// test.js
/**
 * 
 * 
 */

const DUMP_THIS = true;

function listUserCode(root = this) {
    console.log("---------- Dumping this ---------");
    const seen = new WeakSet();

    const denylist = new Set([
        'Object', 'Function', 'Array', 'Number', 'String', 'Boolean',
        'globalThis'
    ]);

    function isObject(val) {
        return val && typeof val === 'object';
    }

    function isFunction(val) {
        return typeof val === 'function';
    }

    function tryGet(obj, key) {
        try {
            return obj[key];
            } catch (e1) {
            try {
                // Try with parameter 0 if it's a callable getter
                const desc = Object.getOwnPropertyDescriptor(obj, key);
                if (desc && typeof desc.get === 'function') {
                return desc.get.call(obj, 0);
                }
            } catch (e2) {
                return undefined;
            }
        }
    }

    function traverse(obj, path = '') {
        if ((!isObject(obj) && !isFunction(obj)) || seen.has(obj)) return;
        seen.add(obj);

        let props;
        try {
        props = Object.getOwnPropertyNames(obj);
        } catch {
        return;
        }

        for (const key of props) {
        if (key === 'prototype' || denylist.has(key)) continue;

        const fullPath = path ? `${path}.${key}` : key;

        // Skip if this is a top-level denylisted global
        if (!path && denylist.has(key)) continue;

        const val = tryGet(obj, key);

        if (isFunction(val)) {
            console.log(fullPath);
            console.warn(fullPath);
        }

        if ((isObject(val) || isFunction(val)) && !seen.has(val)) {
            traverse(val, fullPath);
        }
        }
    }

    traverse(root);
}


console.log("Loading YNAMP test.js");
function requestInitializationParameters(initParams) {
    // Gedemon <<<<
    console.log("**** YNAMP TEST requestInitializationParameters ****");
    // Gedemon >>>>/
    //engine.call("SetAgeInitializationParameters", initParams);
}
function generateTransition() {

  console.log("*** YNAMP TEST generateTransition ***");
  if (DUMP_THIS) {
    console.log("DUMP_THIS = true");
    listUserCode();
  }

}

function requestMapData(initParams) {
  console.log("*** YNAMP TEST requestMapData ***");
  if (DUMP_THIS) {
    console.log("DUMP_THIS = true");
    listUserCode();
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