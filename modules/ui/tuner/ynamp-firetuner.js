console.warn("[YnAMP FireTuner] Loading ynamp-firetuner.js");

(function () {
    const PANEL_KEY = "YnAMPPanel";
    const MAX_ROOT_PROPERTIES = 128;
    const MAX_DUMP_DEPTH = 3;
    const MAX_DUMP_NODES = 256;
    const MAX_PROPERTIES_PER_OBJECT = 64;

    function ensurePanelState() {
        if (typeof g_TunerState === "undefined") {
            globalThis.g_TunerState = {};
        }
        if (g_TunerState[PANEL_KEY] == null) {
            g_TunerState[PANEL_KEY] = {};
        }

        let panelState = g_TunerState[PANEL_KEY];
        if (panelState.placementMode == null) {
            panelState.placementMode = "";
        }
        if (panelState.lastClickText == null) {
            panelState.lastClickText = "none";
        }
        if (panelState.lastDumpStatus == null) {
            panelState.lastDumpStatus = "idle";
        }
        return panelState;
    }

    function setDumpStatus(message) {
        ensurePanelState().lastDumpStatus = message;
    }

    function warnDump(message) {
        console.warn("[YnAMP FireTuner] " + message);
    }

    function safeGet(object, key) {
        try {
            return {
                access: "direct",
                value: object[key],
            };
        } catch (error) {
            try {
                let descriptor = Object.getOwnPropertyDescriptor(object, key);
                if (descriptor && typeof descriptor.get === "function") {
                    return {
                        access: "getter(0)",
                        value: descriptor.get.call(object, 0),
                    };
                }
            } catch (nestedError) {
                return {
                    access: "error",
                    value: undefined,
                    detail: String(nestedError),
                };
            }
        }
        return {
            access: "error",
            value: undefined,
            detail: "unknown getter failure",
        };
    }

    function getRootProperties(rootName, rootObject) {
        try {
            return Object.getOwnPropertyNames(rootObject);
        } catch (error) {
            warnDump(rootName + " root enumeration failed: " + String(error));
            return null;
        }
    }

    function getObjectProperties(path, value) {
        try {
            return Object.getOwnPropertyNames(value);
        } catch (error) {
            warnDump("ENUM_FAIL " + path + " :: " + String(error));
            return null;
        }
    }

    function getStatusSuffix(summary) {
        if (summary.truncationReasons.length === 0) {
            return " complete";
        }
        return " truncated:" + summary.truncationReasons.join(",");
    }

    function formatSummary(label, summary) {
        return label + " " + summary.emittedProperties + "p/" + summary.visitedNodes + "n" + getStatusSuffix(summary);
    }

    function describeValue(value) {
        if (value === null) {
            return "null";
        }
        if (Array.isArray(value)) {
            return "array";
        }
        return typeof value;
    }

    function warnNativeBindingLimit(rootName, contextLabel) {
        if (rootName === "WorldBuilder.MapPlots") {
            warnDump(rootName + " exposes no enumerable own-properties in " + contextLabel + "; expected for some native bindings.");
        }
    }

    function dumpObjectRoot(rootName, rootObject, maxProperties) {
        let properties = getRootProperties(rootName, rootObject);
        if (!properties) {
            return {
                totalProperties: 0,
                dumpedProperties: 0,
                truncated: false,
            };
        }

        warnDump("START " + rootName + " root dump; type=<" + typeof rootObject + ">; properties=" + properties.length + "; limit=" + maxProperties + ".");

        if (properties.length === 0) {
            warnNativeBindingLimit(rootName, "root dump");
        }

        let dumpedProperties = 0;
        const limit = Math.min(properties.length, maxProperties);
        for (let index = 0; index < limit; index++) {
            const key = properties[index];
            if (key === "prototype") {
                continue;
            }

            const result = safeGet(rootObject, key);
            let message = rootName + "." + key + " <" + describeValue(result.value) + ">";
            if (result.access !== "direct") {
                message += " via " + result.access;
            }
            if (result.access === "error" && result.detail) {
                message += " :: " + result.detail;
            }
            warnDump(message);
            dumpedProperties++;
        }

        const truncated = properties.length > maxProperties;
        if (truncated) {
            warnDump(rootName + " root dump truncated after " + dumpedProperties + " of " + properties.length + " properties.");
        }
        warnDump("END " + rootName + " root dump; emitted=" + dumpedProperties + "; total=" + properties.length + ".");

        return {
            totalProperties: properties.length,
            dumpedProperties,
            truncated,
        };
    }


    function dumpObjectTree(rootName, rootObject, options = {}) {
        const maxDepth = options.maxDepth ?? MAX_DUMP_DEPTH;
        const maxNodes = options.maxNodes ?? MAX_DUMP_NODES;
        const maxPropertiesPerObject = options.maxPropertiesPerObject ?? MAX_PROPERTIES_PER_OBJECT;
        const summary = {
            visitedNodes: 0,
            emittedProperties: 0,
            truncationReasons: [],
        };
        const seen = new WeakSet();

        function addTruncation(reason) {
            if (!summary.truncationReasons.includes(reason)) {
                summary.truncationReasons.push(reason);
            }
        }

        function visit(value, path, depth) {
            if (!value || (typeof value !== "object" && typeof value !== "function")) {
                return;
            }
            if (seen.has(value)) {
                return;
            }
            if (summary.visitedNodes >= maxNodes) {
                addTruncation("nodes");
                warnDump("TRUNCATED_NODES at " + path + "; limit=" + maxNodes + ".");
                return;
            }

            seen.add(value);
            summary.visitedNodes++;

            const properties = getObjectProperties(path, value);
            if (!properties) {
                return;
            }

            warnDump("NODE " + path + " depth=" + depth + " type=<" + describeValue(value) + "> properties=" + properties.length + ".");
            if (properties.length === 0) {
                warnNativeBindingLimit(path, "full dump");
            }

            const limit = Math.min(properties.length, maxPropertiesPerObject);
            for (let index = 0; index < limit; index++) {
                const key = properties[index];
                if (key === "prototype") {
                    continue;
                }

                const childPath = path + "." + key;
                const result = safeGet(value, key);
                let message = childPath + " <" + describeValue(result.value) + ">";
                if (result.access !== "direct") {
                    message += " via " + result.access;
                }
                if (result.access === "error" && result.detail) {
                    message += " :: " + result.detail;
                }
                warnDump(message);
                summary.emittedProperties++;

                if (result.value && (typeof result.value === "object" || typeof result.value === "function")) {
                    if (depth >= maxDepth) {
                        addTruncation("depth");
                    } else {
                        visit(result.value, childPath, depth + 1);
                    }
                }
            }

            if (properties.length > maxPropertiesPerObject) {
                addTruncation("props");
                warnDump("TRUNCATED_PROPS " + path + "; emitted=" + limit + "; total=" + properties.length + "; limit=" + maxPropertiesPerObject + ".");
            }
        }

        warnDump(
            "START " + rootName + " full dump; type=<" + describeValue(rootObject) + ">; depth=" + maxDepth + "; nodes=" + maxNodes + "; props=" + maxPropertiesPerObject + "."
        );
        visit(rootObject, rootName, 0);
        warnDump(
            "END " + rootName + " full dump; emitted=" + summary.emittedProperties + "; nodes=" + summary.visitedNodes + "; truncation=" + (summary.truncationReasons.length ? summary.truncationReasons.join(",") : "none") + "."
        );

        return summary;
    }

    function getWorldBuilderMapPlots() {
        if (typeof WorldBuilder === "undefined" || WorldBuilder == null) {
            warnDump("WorldBuilder is unavailable in current context.");
            return null;
        }
        if (WorldBuilder.MapPlots == null) {
            warnDump("WorldBuilder.MapPlots is unavailable in current context.");
            return null;
        }
        return WorldBuilder.MapPlots;
    }

    class YnAMPTunerPanel {
        exploreAll() {
            let mapPlots = getWorldBuilderMapPlots();
            if (typeof Players === "undefined" || mapPlots == null) {
                warnDump("Explore All unavailable in current context.");
                return;
            }

            let exploredPlayers = 0;
            for (const playerId of Players.getWasEverAliveIds()) {
                const player = Players.get(playerId);
                if (player && player.isHuman) {
                    mapPlots.setAllRevealed(playerId, true);
                    exploredPlayers++;
                }
            }

            warnDump("Explore All applied to " + exploredPlayers + " human player(s).");
        }

        dumpWorldBuilder() {
            setDumpStatus("running bridge-root");

            if (typeof WorldBuilder === "undefined") {
                setDumpStatus("WorldBuilder unavailable");
                warnDump("WorldBuilder is unavailable in current context.");
                return;
            }

            const summary = dumpObjectRoot("WorldBuilder", WorldBuilder, MAX_ROOT_PROPERTIES);
            setDumpStatus("bridge-root " + summary.dumpedProperties + "/" + summary.totalProperties + (summary.truncated ? " truncated" : " complete"));
        }

        dumpWorldBuilderMapPlotsRoot() {
            setDumpStatus("running bridge-mapplots");

            const mapPlots = getWorldBuilderMapPlots();
            if (mapPlots == null) {
                setDumpStatus("bridge-mapplots unavailable");
                return;
            }

            const summary = dumpObjectRoot("WorldBuilder.MapPlots", mapPlots, MAX_ROOT_PROPERTIES);
            if (summary.totalProperties === 0) {
                setDumpStatus("bridge-mapplots native-empty");
                return;
            }

            setDumpStatus("bridge-mapplots " + summary.dumpedProperties + "/" + summary.totalProperties + (summary.truncated ? " truncated" : " complete"));
        }

        dumpWorldBuilderFull() {
            setDumpStatus("running bridge-full");

            if (typeof WorldBuilder === "undefined") {
                setDumpStatus("WorldBuilder unavailable");
                warnDump("WorldBuilder is unavailable in current context.");
                return;
            }

            const summary = dumpObjectTree("WorldBuilder", WorldBuilder);
            setDumpStatus(formatSummary("bridge-full", summary));
        }

        onActionA(loc) {
            try {
                const panelState = ensurePanelState();
                if (panelState.placementMode === "LogPlot") {
                    if (loc && typeof loc.x === "number" && typeof loc.y === "number") {
                        panelState.lastClickText = loc.x + ";" + loc.y;
                        warnDump("Action A on plot (" + loc.x + "," + loc.y + ")");
                    } else {
                        warnDump("Action A received invalid loc: " + String(loc));
                    }
                    return false;
                }
            } catch (err) {
                warnDump("onActionA error: " + String(err));
            }
            return true;
        }

        onActionB(loc) {
            try {
                const panelState = ensurePanelState();
                if (panelState.placementMode === "LogPlot") {
                    if (loc && typeof loc.x === "number" && typeof loc.y === "number") {
                        panelState.lastClickText = loc.x + ";" + loc.y;
                        warnDump("Action B on plot (" + loc.x + "," + loc.y + ")");
                    } else {
                        warnDump("Action B received invalid loc: " + String(loc));
                    }
                    return false;
                }
            } catch (err) {
                warnDump("onActionB error: " + String(err));
            }
            return true;
        }
    }

    let isRegistered = false;
    function registerPanel() {
        ensurePanelState();

        if (typeof g_TunerInput === "undefined" || g_TunerInput.panels == null) {
            return false;
        }
        if (!isRegistered) {
            g_TunerInput.panels[PANEL_KEY] = new YnAMPTunerPanel();
            isRegistered = true;
            console.warn("[YnAMP FireTuner] Registered panel bridge '" + PANEL_KEY + "'.");
        }
        return true;
    }

    registerPanel();
    if (typeof engine !== "undefined" && engine.whenReady) {
        engine.whenReady.then(() => {
            if (!registerPanel()) {
                console.warn("[YnAMP FireTuner] g_TunerInput was still unavailable after engine.whenReady.");
            }
        });
    }
})();