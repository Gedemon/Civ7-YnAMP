const DEFAULT_CANONICAL_COORD = { X: 90, Y: 46 };

let g_activeEarthMapContext = null;

const SYNTHETIC_COLUMNS = 3;

function clamp(value, minValue, maxValue) {
    return Math.max(minValue, Math.min(maxValue, value));
}

function getWrappedInclusiveLength(start, end, size) {
    if (size <= 0) {
        return 0;
    }
    if (start <= end) {
        return end - start + 1;
    }
    return size - start + end + 1;
}

function normalizeX(value, width) {
    return ((value % width) + width) % width;
}

function getSourceCropOffsetX(sourceX, mapContext) {
    let normalizedX = normalizeX(sourceX, mapContext.sourceWidth);
    if (mapContext.sourceStartX <= mapContext.sourceEndX) {
        if (normalizedX < mapContext.sourceStartX || normalizedX > mapContext.sourceEndX) {
            return null;
        }
        return normalizedX - mapContext.sourceStartX;
    }
    if (normalizedX >= mapContext.sourceStartX) {
        return normalizedX - mapContext.sourceStartX;
    }
    if (normalizedX <= mapContext.sourceEndX) {
        return mapContext.sourceWidth - mapContext.sourceStartX + normalizedX;
    }
    return null;
}

function getSourceCropOffsetY(sourceY, mapContext) {
    if (sourceY < mapContext.sourceStartY || sourceY > mapContext.sourceEndY) {
        return null;
    }
    return sourceY - mapContext.sourceStartY;
}

function isWithinLocalCropBounds(localX, localY, mapContext) {
    if (!mapContext) {
        return true;
    }

    return localX >= 0
        && localX < Math.min(mapContext.liveWidth, mapContext.cropWidth)
        && localY >= 0
        && localY < Math.min(mapContext.liveHeight, mapContext.cropHeight);
}

function getLivePlayableStartX(mapContext) {
    return mapContext?.livePlayableStartX ?? 0;
}

function getLivePlayableEndX(mapContext) {
    return mapContext?.livePlayableEndX ?? Math.max(0, mapContext?.liveWidth - 1);
}

function getLivePlayableWidth(mapContext) {
    return mapContext?.livePlayableWidth ?? Math.max(0, getLivePlayableEndX(mapContext) - getLivePlayableStartX(mapContext) + 1);
}

function getConfiguredMapValue(configKey) {
    let rawValue = Configuration.getMapValue(configKey);
    return rawValue == null || rawValue === "" ? null : rawValue;
}

function getConfiguredMapTextValue(configKey) {
    let rawValue = getConfiguredMapValue(configKey);
    return rawValue == null ? null : String(rawValue);
}

function getConfiguredMapIntValue(configKey) {
    let rawValue = getConfiguredMapValue(configKey);
    if (rawValue == null) {
        return null;
    }

    let value = Number(rawValue);
    return Number.isFinite(value) ? Math.trunc(value) : null;
}

function getConfiguredMapBoolValue(configKey) {
    let rawValue = getConfiguredMapValue(configKey);
    if (rawValue == null) {
        return null;
    }
    if (typeof rawValue === "boolean") {
        return rawValue;
    }
    if (typeof rawValue === "number") {
        return rawValue != 0;
    }

    let normalizedValue = String(rawValue).trim().toLowerCase();
    if (normalizedValue == "true") {
        return true;
    }
    if (normalizedValue == "false") {
        return false;
    }

    let numericValue = Number(normalizedValue);
    return Number.isFinite(numericValue) ? numericValue != 0 : null;
}

export function getSourceMapDimensions(sourceMap) {
    let sourceWidth = sourceMap?.length ?? 0;
    let sourceHeight = sourceWidth > 0 && sourceMap[0] ? sourceMap[0].length : 0;
    if (sourceWidth <= 0 || sourceHeight <= 0) {
        return null;
    }

    return {
        width: sourceWidth,
        height: sourceHeight,
    };
}

function resolveSourceMapDimensions(sourceMap, fallbackWidth, fallbackHeight) {
    let sourceDimensions = getSourceMapDimensions(sourceMap);
    if (sourceDimensions) {
        return sourceDimensions;
    }

    return {
        width: fallbackWidth,
        height: fallbackHeight,
    };
}

function deriveConfiguredCropBounds(mapLabel, sourceStartX, sourceStartY, sourceWidth, sourceHeight, liveWidth, liveHeight) {
    if (sourceWidth <= 0 || sourceHeight <= 0 || liveWidth <= 0 || liveHeight <= 0) {
        console.log("getConfiguredEarthMapContext: invalid crop dimensions for " + mapLabel +
            " source=" + sourceWidth + "x" + sourceHeight +
            " live=" + liveWidth + "x" + liveHeight);
        return null;
    }

    if (liveWidth > sourceWidth) {
        console.log("getConfiguredEarthMapContext: live width exceeds source width for " + mapLabel +
            " liveWidth=" + liveWidth + " sourceWidth=" + sourceWidth);
        return null;
    }

    let normalizedStartX = normalizeX(sourceStartX, sourceWidth);
    let derivedEndX = normalizeX(normalizedStartX + liveWidth - 1, sourceWidth);
    let derivedEndY = sourceStartY + liveHeight - 1;
    if (sourceStartY < 0 || sourceStartY >= sourceHeight || derivedEndY >= sourceHeight) {
        console.log("getConfiguredEarthMapContext: invalid vertical crop for " + mapLabel +
            " sourceStartY=" + sourceStartY +
            " derivedSourceEndY=" + derivedEndY +
            " sourceHeight=" + sourceHeight +
            " liveHeight=" + liveHeight);
        return null;
    }

    return {
        sourceStartX: normalizedStartX,
        sourceEndX: derivedEndX,
        sourceStartY,
        sourceEndY: derivedEndY,
    };
}

export function createEarthMapContext(options) {
    let cropWidth = options.cropWidth ?? getWrappedInclusiveLength(options.sourceStartX, options.sourceEndX, options.sourceWidth);
    let cropHeight = options.cropHeight ?? (options.sourceEndY - options.sourceStartY + 1);
    let livePlayableStartX = options.livePlayableStartX ?? (options.noWrapX ? (options.syntheticWestColumns ?? SYNTHETIC_COLUMNS) : 0);
    let livePlayableEndX = options.livePlayableEndX;
    if (livePlayableEndX == null) {
        if (options.livePlayableWidth != null) {
            livePlayableEndX = livePlayableStartX + options.livePlayableWidth - 1;
        } else {
            livePlayableEndX = Math.max(livePlayableStartX, options.liveWidth - 1 - (options.noWrapX ? (options.syntheticEastColumns ?? SYNTHETIC_COLUMNS) : 0));
        }
    }
    let livePlayableWidth = options.livePlayableWidth ?? Math.max(0, livePlayableEndX - livePlayableStartX + 1);
    let syntheticWestColumns = options.syntheticWestColumns ?? livePlayableStartX;
    let syntheticEastColumns = options.syntheticEastColumns ?? Math.max(0, options.liveWidth - 1 - livePlayableEndX);

    return {
        sectionId: options.sectionId ?? null,
        mapName: options.mapName,
        sourceMapName: options.sourceMapName,
        sourceWidth: options.sourceWidth,
        sourceHeight: options.sourceHeight,
        liveWidth: options.liveWidth,
        liveHeight: options.liveHeight,
        sourceStartX: options.sourceStartX,
        sourceEndX: options.sourceEndX,
        sourceStartY: options.sourceStartY,
        sourceEndY: options.sourceEndY,
        cropWidth,
        cropHeight,
        livePlayableStartX,
        livePlayableEndX,
        livePlayableWidth,
        syntheticWestColumns,
        syntheticEastColumns,
        noWrapX: options.noWrapX ?? false,
    };
}

export function createIdentityEarthMapContext(mapName, liveWidth, liveHeight, genParameters = {}) {
    return createEarthMapContext({
        mapName,
        sourceMapName: mapName,
        sourceWidth: liveWidth,
        sourceHeight: liveHeight,
        liveWidth,
        liveHeight,
        sourceStartX: 0,
        sourceEndX: Math.max(0, liveWidth - 1),
        sourceStartY: 0,
        sourceEndY: Math.max(0, liveHeight - 1),
    });
}

export function getConfiguredEarthMapContext(liveWidth = GameplayMap.getGridWidth(), liveHeight = GameplayMap.getGridHeight(), sourceMap = null) {
    let mapName = getConfiguredMapTextValue("MapName");
    if (!mapName) {
        return null;
    }

    let sourceMapName = getConfiguredMapTextValue("SourceMapName") ?? mapName;
    let sectionId = getConfiguredMapTextValue("MapSection");
    let sourceDimensions = resolveSourceMapDimensions(sourceMap, liveWidth, liveHeight);
    let sourceWidth = sourceDimensions.width;
    let sourceHeight = sourceDimensions.height;
    let sourceStartX = getConfiguredMapIntValue("SourceStartX") ?? 0;
    let sourceStartY = getConfiguredMapIntValue("SourceStartY") ?? 0;
    let mapLabel = sectionId ?? mapName;
    let derivedCropBounds = deriveConfiguredCropBounds(mapLabel, sourceStartX, sourceStartY, sourceWidth, sourceHeight, liveWidth, liveHeight);
    if (!derivedCropBounds) {
        return null;
    }

    console.log("getConfiguredEarthMapContext: " + mapLabel +
        " sourceStart=(" + derivedCropBounds.sourceStartX + "," + derivedCropBounds.sourceStartY + ")" +
        " sourceEnd=(" + derivedCropBounds.sourceEndX + "," + derivedCropBounds.sourceEndY + ")" +
        " crop=" + liveWidth + "x" + liveHeight +
        " source=" + sourceWidth + "x" + sourceHeight);

    return createEarthMapContext({
        sectionId,
        mapName,
        sourceMapName,
        sourceWidth,
        sourceHeight,
        liveWidth,
        liveHeight,
        sourceStartX: derivedCropBounds.sourceStartX,
        sourceEndX: derivedCropBounds.sourceEndX,
        sourceStartY: derivedCropBounds.sourceStartY,
        sourceEndY: derivedCropBounds.sourceEndY,
        noWrapX: getConfiguredMapBoolValue("NoWrapX") ?? false,
    });
}

export function buildEarthMapContext(mapName, liveWidth, liveHeight, genParameters = {}) {
    let baseMapContext = genParameters.mapContext ?? getConfiguredEarthMapContext(liveWidth, liveHeight, genParameters.sourceMap ?? null);
    if (!baseMapContext) {
        return createIdentityEarthMapContext(mapName, liveWidth, liveHeight, genParameters);
    }

    return createEarthMapContext({
        ...baseMapContext,
        mapName: baseMapContext.mapName ?? mapName,
        liveWidth,
        liveHeight,
    });
}

export function setActiveEarthMapContext(mapContext) {
    g_activeEarthMapContext = mapContext;
    return g_activeEarthMapContext;
}

export function getActiveEarthMapContext() {
    return g_activeEarthMapContext;
}

export function getEarthMapLabel(mapContextOrName) {
    if (typeof mapContextOrName === "string") {
        return mapContextOrName;
    }
    if (mapContextOrName && mapContextOrName.mapName) {
        return mapContextOrName.mapName;
    }
    if (mapContextOrName && mapContextOrName.sourceMapName) {
        return mapContextOrName.sourceMapName;
    }
    return "UnknownMap";
}

export function getEarthMapSourceMapName(mapContextOrName) {
    if (typeof mapContextOrName === "string") {
        return mapContextOrName;
    }
    return mapContextOrName?.sourceMapName ?? mapContextOrName?.mapName ?? null;
}

export function getDefaultCulturalCoord(mapContext = g_activeEarthMapContext) {
    if (!mapContext) {
        return DEFAULT_CANONICAL_COORD;
    }
    return {
        X: getLivePlayableStartX(mapContext) + Math.floor(getLivePlayableWidth(mapContext) / 2),
        Y: Math.floor((mapContext.liveHeight - 1) / 2),
    };
}

export function isEarthMapNoWrapX(mapContext = g_activeEarthMapContext) {
    return Boolean(mapContext?.noWrapX);
}

export function isEarthMapSyntheticWorldEndColumn(localX, mapContext = g_activeEarthMapContext) {
    if (!mapContext) {
        return false;
    }
    return localX < getLivePlayableStartX(mapContext) || localX > getLivePlayableEndX(mapContext);
}

export function isEarthMapPlayableLocalCoordinate(localX, localY, mapContext = g_activeEarthMapContext) {
    if (!mapContext) {
        return true;
    }
    if (localX < 0 || localX >= mapContext.liveWidth) {
        return false;
    }
    if (localY < 0 || localY >= mapContext.liveHeight) {
        return false;
    }
    return !isEarthMapSyntheticWorldEndColumn(localX, mapContext);
}

export function hasEarthMapVerticalCrop(mapContext = g_activeEarthMapContext) {
    if (!mapContext) {
        return false;
    }

    return mapContext.sourceStartY > 0 || mapContext.sourceEndY < mapContext.sourceHeight - 1;
}

export function mapSourceToLocalCoordinate(sourceX, sourceY, mapContext, includeSyntheticWorldEndColumns = false) {
    if (!mapContext) {
        return { X: sourceX, Y: sourceY, SourceX: sourceX, SourceY: sourceY };
    }

    let cropOffsetX = getSourceCropOffsetX(sourceX, mapContext);
    let cropOffsetY = getSourceCropOffsetY(sourceY, mapContext);
    if (cropOffsetX === null || cropOffsetY === null) {
        return null;
    }

    if (!isWithinLocalCropBounds(cropOffsetX, cropOffsetY, mapContext)) {
        return null;
    }

    if (!includeSyntheticWorldEndColumns && isEarthMapSyntheticWorldEndColumn(cropOffsetX, mapContext)) {
        return null;
    }

    return {
        X: cropOffsetX,
        Y: cropOffsetY,
        SourceX: sourceX,
        SourceY: sourceY,
    };
}

export function mapLocalToSourceCoordinate(localX, localY, mapContext, includeSyntheticWorldEndColumns = false) {
    if (!mapContext) {
        return { X: localX, Y: localY };
    }

    if (!isWithinLocalCropBounds(localX, localY, mapContext)) {
        return null;
    }

    if (!includeSyntheticWorldEndColumns && !isEarthMapPlayableLocalCoordinate(localX, localY, mapContext)) {
        return null;
    }

    return {
        X: normalizeX(mapContext.sourceStartX + localX, mapContext.sourceWidth),
        Y: clamp(mapContext.sourceStartY + localY, 0, mapContext.sourceHeight - 1),
    };
}