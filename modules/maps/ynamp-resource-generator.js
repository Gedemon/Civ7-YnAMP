// deprecated

import * as utilities from '/base-standard/maps/map-utilities.js';

export function getHemisphereYnAMP(iX, continent1, continent2, bEastBias) {
    if (bEastBias) {
        if (iX < continent1.east - 2) {
            return 0; // other hemisphere
        } else { 
            return 1; // player start
        }
    } else {
        if (iX < continent2.west + 2) {
            return 0; // player start
        } else {
            return 1; // other hemisphere
        }
    }
}

export function generateResourcesYnAMP(iWidth, iHeight, continent1, continent2, iNumWest, iNumEast) {
    let bEastBias = false;
    if (iNumEast > iNumWest) {
        console.log("EastSide");
        bEastBias = true;
    } else {
        console.log("WestSide");
    }

    let uiStartAgeHash = Configuration.getGameValue("StartAge");
    let resourceHemisphere = new Array(GameInfo.Resources.length);
    let resourceRegionalCount = new Array(2);
    resourceRegionalCount[0] = 0;
    resourceRegionalCount[1] = 0;
    let resourceWeight = new Array(GameInfo.Resources.length);
    let resourceRunningWeight = new Array(GameInfo.Resources.length);
    //Initial Resource data
    for (var resourceIdx = 0; resourceIdx < GameInfo.Resources.length; resourceIdx++) {
        resourceHemisphere[resourceIdx] = 0;
        resourceWeight[resourceIdx] = 0;
        resourceRunningWeight[resourceIdx] = 0;
    }
    // Find all resources using base game's getGeneratedMapResources (filters for map type)
    let aResourceTypes = [];
    let debugHemisphereCount = 0;
    const resources = ResourceBuilder.getGeneratedMapResources(3);
    console.log("generateResourcesYnAMP: getGeneratedMapResources returned " + resources.length + " resources");
    
    for (let ridx = 0; ridx < resources.length; ++ridx) {
        const resourceInfo = GameInfo.Resources.lookup(resources[ridx]);
        if (resourceInfo && resourceInfo.Tradeable) {
            resourceWeight[resourceInfo.$index] = resourceInfo.Weight;
            resourceHemisphere[resourceInfo.$index] = resourceInfo.Hemispheres;
            
            // Manual hemisphere assignment for distant-land conversion
            // These resources will be converted to distant-land equivalents in validate()
            // Mark as "2" (both hemispheres) so they're placed everywhere, then validate() converts the ones in distant lands
            if (resourceInfo.ResourceType === "RESOURCE_KAOLIN") {  // → COCOA in distant lands
                resourceHemisphere[resourceInfo.$index] = 2;  // place in both hemispheres
            } else if (resourceInfo.ResourceType === "RESOURCE_IVORY") {  // → SPICES in distant lands
                resourceHemisphere[resourceInfo.$index] = 2;  // place in both hemispheres
            } else if (resourceInfo.ResourceType === "RESOURCE_COTTON") {  // → SUGAR in distant lands
                resourceHemisphere[resourceInfo.$index] = 2;  // place in both hemispheres
            } else if (resourceInfo.ResourceType === "RESOURCE_HIDES") {  // → TEA in distant lands
                resourceHemisphere[resourceInfo.$index] = 2;  // place in both hemispheres
            }
            
            aResourceTypes.push(resourceInfo.$index);
            if (resourceHemisphere[resourceInfo.$index] && resourceHemisphere[resourceInfo.$index] !== 0) {
                debugHemisphereCount++;
                console.log("generateResourcesYnAMP: Found hemisphere-restricted resource: " + resourceInfo.ResourceType + " (Hemispheres=" + resourceHemisphere[resourceInfo.$index] + ")");
            }
        }
    }
    console.log("generateResourcesYnAMP: Total resources=" + aResourceTypes.length + " hemisphere-restricted=" + debugHemisphereCount);
    //Generate Poisson Map
    let seed = GameplayMap.getRandomSeed();
    let avgDistanceBetweenPoints = 3;
    let normalizedRangeSmoothing = 2;
    let poisson = TerrainBuilder.generatePoissonMap(seed, avgDistanceBetweenPoints, normalizedRangeSmoothing);
    
    // Debug: track resource placement
    let placedCounts = { total: 0, homeland: 0, distant: 0 };
    let poissonTilesChecked = 0;
    let poissonTilesPassed = 0;
    let resourceCandidatesGenerated = 0;
    let hemisphereXcounts = { 0: 0, 1: 0 };
    let canHaveResourceCount = 0;
    
    for (let iY = iHeight - 1; iY >= 0; iY--) {
        for (let iX = 0; iX < iWidth; iX++) {
            let index = iY * iWidth + iX;
            poissonTilesChecked++;
            if (poisson[index] >= 1) {
                poissonTilesPassed++;
                //Generate a list of valid resources at this plot
                let resources = [];
                aResourceTypes.forEach(resourceIdx => {
                    let hemisphere = resourceHemisphere[resourceIdx];
                    
                    // Resources without hemisphere restrictions (undefined or 2) - place everywhere
                    if (hemisphere === undefined || hemisphere === 2) {
                        if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                            canHaveResourceCount++;
                            resources.push(resourceIdx);
                        }
                    }
                    // Homeland-only resources (hemisphere == 0) - place in player's starting hemisphere
                    else if (hemisphere === 0) {
                        let hemisphereX = getHemisphereYnAMP(iX, continent1, continent2, bEastBias);
                        hemisphereXcounts[hemisphereX]++;
                        
                        // Place in homeland: west if player starts west, east if player starts east
                        if ((hemisphereX === 0 && bEastBias === false) || (hemisphereX === 1 && bEastBias === true)) {
                            if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                                canHaveResourceCount++;
                                resources.push(resourceIdx);
                            }
                        }
                    }
                    // Distant-land resources (hemisphere == 1) - place in opposite hemisphere
                    else if (hemisphere === 1) {
                        let iBuffer = Math.floor(iWidth / 28.0);
                        let hemisphereX = getHemisphereYnAMP(iX, continent1, continent2, bEastBias);
                        hemisphereXcounts[hemisphereX]++;
                        
                        // Place in distant lands or islands
                        if ((hemisphereX === 1 && bEastBias === false) || (hemisphereX === 0 && bEastBias === true)) {
                            if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                                canHaveResourceCount++;
                                resources.push(resourceIdx);
                            }
                        }
                        else if (iX < continent1.west - iBuffer || iX >= continent2.east + iBuffer ||
                            (iX >= continent1.east + iBuffer && iX < continent2.west - iBuffer)) {
                            if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                                canHaveResourceCount++;
                                resources.push(resourceIdx);
                            }
                        }
                    }
                });
                //Select the heighest weighted (ties are a coin flip) resource
                if (resources.length > 0) {
                    resourceCandidatesGenerated++;
                    let resourceChosen = ResourceTypes.NO_RESOURCE;
                    let resourceChosenIndex = 0;
                    for (let iI = 0; iI < resources.length; iI++) {
                        if (resourceChosen == ResourceTypes.NO_RESOURCE) {
                            resourceChosen = resources[iI];
                            resourceChosenIndex = resources[iI];
                        }
                        else {
                            if (resourceRunningWeight[resources[iI]] > resourceRunningWeight[resourceChosenIndex]) {
                                resourceChosen = resources[iI];
                                resourceChosenIndex = resources[iI];
                            }
                            else if (resourceRunningWeight[resources[iI]] == resourceRunningWeight[resourceChosenIndex]) {
                                let iRoll = TerrainBuilder.getRandomNumber(2, "Resource Scatter");
                                if (iRoll >= 1) {
                                    resourceChosen = resources[iI];
                                    resourceChosenIndex = resources[iI];
                                }
                            }
                        }
                    }
                    //Place the selected resource
                    if (resourceChosen != ResourceTypes.NO_RESOURCE) {
                        let iResourcePlotIndex = getFlowerPlot(iX, iY, resourceChosen);
                        if (iResourcePlotIndex != -1) {
                            let iLocation = GameplayMap.getLocationFromIndex(iResourcePlotIndex);
                            let iResourceX = iLocation.x;
                            let iResourceY = iLocation.y;
                            ResourceBuilder.setResourceType(iResourceX, iResourceY, resourceChosen);
                            resourceRunningWeight[resourceChosenIndex] -= resourceWeight[resourceChosenIndex];
                            
                            // Debug: track placed resources
                            placedCounts.total++;
                            if (resourceHemisphere[resourceChosen] === 0) {
                                placedCounts.homeland++;
                            } else if (resourceHemisphere[resourceChosen] === 1) {
                                placedCounts.distant++;
                            }
                        }
                        else {
                            console.log("Resource Index Failure");
                        }
                    }
                    else {
                        console.log("Resource Type Failure");
                    }
                }
            }
        }
    }
    console.log("generateResourcesYnAMP: Hemisphere counts - hemisphereX_0=" + hemisphereXcounts[0] + " hemisphereX_1=" + hemisphereXcounts[1] + " canHaveResource=" + canHaveResourceCount);
    console.log("generateResourcesYnAMP: Poisson tiles - checked=" + poissonTilesChecked + " passed=" + poissonTilesPassed + " candidates=" + resourceCandidatesGenerated + " placed=" + placedCounts.total);
    console.log("generateResourcesYnAMP: Placed resources total=" + placedCounts.total + " homeland=" + placedCounts.homeland + " distant=" + placedCounts.distant);
}

//Can I have a resource in this flower?
export function canHaveFlowerPlot(iX, iY, resourceType) {
    if (ResourceBuilder.canHaveResource(iX, iY, resourceType, false)) {
        return true;
    }
    for (let iDirection = 0; iDirection < DirectionTypes.NUM_DIRECTION_TYPES; iDirection++) {
        let iIndex = GameplayMap.getIndexFromXY(iX, iY);
        let iLocation = GameplayMap.getLocationFromIndex(iIndex);
        let iAdjacentX = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).x;
        let iAdjacentY = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).y;
        if (ResourceBuilder.canHaveResource(iAdjacentX, iAdjacentY, resourceType, false)) {
            return true;
        }
    }
    return false;
}
//Return a plot index for this resource
//First choosing the initial plot, otherwise it randomly chooses a valid plot from the sorounding ring
export function getFlowerPlot(iX, iY, resourceType) {
    if (ResourceBuilder.canHaveResource(iX, iY, resourceType)) {
        return GameplayMap.getIndexFromXY(iX, iY);
    }
    let resourcePlotIndexes = [];
    for (let iDirection = 0; iDirection < DirectionTypes.NUM_DIRECTION_TYPES; iDirection++) {
        let iIndex = GameplayMap.getIndexFromXY(iX, iY);
        let iLocation = GameplayMap.getLocationFromIndex(iIndex);
        let iAdjacentX = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).x;
        let iAdjacentY = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).y;
        let iAdjacentIndex = GameplayMap.getIndexFromXY(iAdjacentX, iAdjacentY);
        if (ResourceBuilder.canHaveResource(iAdjacentX, iAdjacentY, resourceType)) {
            resourcePlotIndexes.push(iAdjacentIndex);
        }
    }
    if (resourcePlotIndexes.length > 0) {
        return utilities.shuffle(resourcePlotIndexes)[0];
    }
    else {
        return -1;
    }
}

//# sourceMappingURL=file:///base-standard/maps/resource-generator.js.map
