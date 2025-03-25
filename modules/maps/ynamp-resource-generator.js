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
    // Find all resources
    let aResourceTypes = [];
    GameInfo.Resources.forEach((o) => {
        var resourceInfo = o;
        if (resourceInfo && resourceInfo.Tradeable) {
            if (ResourceBuilder.isResourceValidForAge(resourceInfo.ResourceType, uiStartAgeHash)) {
                resourceWeight[resourceInfo.$index] = resourceInfo.Weight;
                resourceHemisphere[resourceInfo.$index] = resourceInfo.Hemispheres;
                aResourceTypes.push(resourceInfo.$index);
            }
        }
    });
    //Generate Poisson Map
    let seed = GameplayMap.getRandomSeed();
    let avgDistanceBetweenPoints = 3;
    let normalizedRangeSmoothing = 2;
    let poisson = TerrainBuilder.generatePoissonMap(seed, avgDistanceBetweenPoints, normalizedRangeSmoothing);
    for (let iY = iHeight - 1; iY >= 0; iY--) {
        for (let iX = 0; iX < iWidth; iX++) {
            let index = iY * iWidth + iX;
            if (poisson[index] >= 1) {
                //Generate a list of valid resources at this plot
                let resources = [];
                aResourceTypes.forEach(resourceIdx => {
                    let iBuffer = Math.floor(iWidth / 28.0);

                    //console.log("GameplayMap.getHemisphere(" + iX + ") = " + GameplayMap.getHemisphere(iX));
                   // console.log("GameplayMap.getHemisphereYnAMP(" + iX + ") = " + getHemisphereYnAMP(iX, continent1, continent2, bEastBias));

                    let hemisphereX = getHemisphereYnAMP(iX, continent1, continent2, bEastBias);

                    if (resourceHemisphere[resourceIdx] == 0) {
                        if ((hemisphereX == 0 && bEastBias == false) || (hemisphereX == 1 && bEastBias == true)) {
                            if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                                resources.push(resourceIdx);
                                //console.log("Foreign Hemishpere: " + iX + ", " + iY);
                            }
                        }
                    }
                    else if (resourceHemisphere[resourceIdx] == 1) {
                        if ((hemisphereX == 0 && bEastBias) || (hemisphereX == 1 && bEastBias == false)) {
                            if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                                resources.push(resourceIdx);
                                //console.log("Foreign Hemishpere: " + iX + ", " + iY);
                            }
                        }
                        else if (iX < continent1.west - iBuffer || iX >= continent2.east + iBuffer ||
                            (iX >= continent1.east + iBuffer && iX < continent2.west - iBuffer)) {
                            if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                                resources.push(resourceIdx);
                                //console.log("Island: " + iX + ", " + iY);
                            }
                        }
                    }
                    else if (resourceHemisphere[resourceIdx] == 2) {
                        if (canHaveFlowerPlot(iX, iY, resourceIdx)) {
                            resources.push(resourceIdx);
                        }
                    }
                });
                //Select the heighest weighted (ties are a coin flip) resource
                if (resources.length > 0) {
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
}
//Can I have a resource in this flower?
export function canHaveFlowerPlot(iX, iY, resourceType) {
    if (ResourceBuilder.canHaveResource(iX, iY, resourceType)) {
        return true;
    }
    for (let iDirection = 0; iDirection < DirectionTypes.NUM_DIRECTION_TYPES; iDirection++) {
        let iIndex = GameplayMap.getIndexFromXY(iX, iY);
        let iLocation = GameplayMap.getLocationFromIndex(iIndex);
        let iAdjacentX = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).x;
        let iAdjacentY = GameplayMap.getAdjacentPlotLocation(iLocation, iDirection).y;
        if (ResourceBuilder.canHaveResource(iAdjacentX, iAdjacentY, resourceType)) {
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
