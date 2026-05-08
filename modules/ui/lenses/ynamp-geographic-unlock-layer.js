import { L as LensManager } from '/core/ui/lenses/lens-manager.chunk.js';
import { H as HexToFloat4 } from '/core/ui/utilities/utilities-color.chunk.js';
import { O as OVERLAY_PRIORITY } from '/base-standard/ui/utilities/utilities-overlay.chunk.js';

const GEOGRAPHIC_UNLOCK_LENS_STATE_EVENT = 'YnAMPGeographicUnlockLensStateChanged';
const GEOGRAPHIC_UNLOCK_ZONE_COLORS = [
  HexToFloat4(0x4E79A7, 0.5),
  HexToFloat4(0xF28E2B, 0.5),
  HexToFloat4(0x59A14F, 0.5),
  HexToFloat4(0xE15759, 0.5),
  HexToFloat4(0x76B7B2, 0.5),
  HexToFloat4(0xEDC948, 0.5),
  HexToFloat4(0xB07AA1, 0.5),
  HexToFloat4(0xFF9DA7, 0.5)
];

function darkenColor(color, alpha = 0.85, factor = 0.55) {
  return {
    x: color.x * factor,
    y: color.y * factor,
    z: color.z * factor,
    w: alpha
  };
}

function getPlotLocation(plotIndex) {
  if (plotIndex == null || typeof GameplayMap?.getLocationFromIndex !== 'function') {
    return null;
  }
  return GameplayMap.getLocationFromIndex(plotIndex);
}

function isVisibleToLocalPlayer(location) {
  if (!location) {
    return false;
  }
  return GameplayMap.getRevealedState(GameContext.localPlayerID, location.x, location.y) !== RevealedStates.HIDDEN;
}

function getLensSnapshot() {
  return typeof globalThis.YnAMPGetGeographicUnlockLensSnapshot === 'function'
    ? globalThis.YnAMPGetGeographicUnlockLensSnapshot()
    : null;
}

class YnAMPGeographicUnlockLensLayer {
  overlayGroup = WorldUI.createOverlayGroup('YnAMPGeographicUnlockOverlayGroup', OVERLAY_PRIORITY.HEX_GRID);
  plotOverlay = this.overlayGroup.addPlotOverlay();
  anchorOverlay = this.overlayGroup.addPlotOverlay();
  textOverlay = this.overlayGroup.addSpriteOverlay();
  isActive = false;

  constructor() {
    this.onLensStateChanged = this.onLensStateChanged.bind(this);
    window.addEventListener(GEOGRAPHIC_UNLOCK_LENS_STATE_EVENT, this.onLensStateChanged);
  }

  onLensStateChanged() {
    if (!this.isActive) {
      return;
    }
    this.applyLayer();
  }

  clearOverlay() {
    this.overlayGroup.clearAll();
    this.plotOverlay.clear();
    this.anchorOverlay.clear();
  }

  initLayer() {
  }

  applyLayer() {
    this.isActive = true;
    this.clearOverlay();

    const snapshot = getLensSnapshot();
    if (!snapshot || !Array.isArray(snapshot.entries) || snapshot.entries.length === 0) {
      return;
    }

    const assignedPlotIndices = new Set();
    snapshot.entries.forEach((entry, entryIndex) => {
      const zoneColor = GEOGRAPHIC_UNLOCK_ZONE_COLORS[entryIndex % GEOGRAPHIC_UNLOCK_ZONE_COLORS.length];
      const anchorColor = darkenColor(zoneColor);
      const visibleZonePlots = [];

      for (const plotIndex of entry.plotIndices ?? []) {
        if (assignedPlotIndices.has(plotIndex)) {
          continue;
        }
        const location = getPlotLocation(plotIndex);
        if (!isVisibleToLocalPlayer(location)) {
          continue;
        }
        assignedPlotIndices.add(plotIndex);
        visibleZonePlots.push(location);
      }

      if (visibleZonePlots.length > 0) {
        this.plotOverlay.addPlots(visibleZonePlots, { fillColor: zoneColor });
      }

      if (isVisibleToLocalPlayer(entry.anchorLocation)) {
        this.anchorOverlay.addPlots([entry.anchorLocation], { fillColor: anchorColor });
      }

      const labelPlots = visibleZonePlots.length > 0
        ? visibleZonePlots
        : (isVisibleToLocalPlayer(entry.anchorLocation) ? [entry.anchorLocation] : []);
      if (labelPlots.length > 0 && entry.baseLabel) {
        this.textOverlay.addRegionText(entry.baseLabel, labelPlots, 50, 8, { fonts: TITLE_FONTS, fontSize: 24 });
      }
    });
  }

  removeLayer() {
    this.isActive = false;
    this.clearOverlay();
  }
}

LensManager.registerLensLayer('mod-ynamp-geographic-unlock-layer', new YnAMPGeographicUnlockLensLayer());