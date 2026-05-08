export class YnAMPGeographicUnlockLensPanelDecorator {
  constructor(component) {
    this.component = component;
  }

  beforeAttach() {
  }

  afterAttach() {
    this.component.createLensButton('LOC_LENS_NAME_YNAMP_GEOGRAPHIC_UNLOCK', 'mod-ynamp-geographic-unlock-lens', 'lens-group');
  }

  beforeDetach() {
  }

  afterDetach() {
  }
}

Controls.decorate('lens-panel', (component) => new YnAMPGeographicUnlockLensPanelDecorator(component));