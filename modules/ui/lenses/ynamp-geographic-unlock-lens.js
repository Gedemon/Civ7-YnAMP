import { L as LensManager } from '/core/ui/lenses/lens-manager.chunk.js';

class YnAMPGeographicUnlockLens {
  activeLayers = new Set([
    'fxs-hexgrid-layer',
    'mod-ynamp-geographic-unlock-layer'
  ]);

  allowedLayers = new Set([
    'fxs-yields-layer',
    'fxs-resource-layer'
  ]);
}

LensManager.registerLens('mod-ynamp-geographic-unlock-lens', new YnAMPGeographicUnlockLens());