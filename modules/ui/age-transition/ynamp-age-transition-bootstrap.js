import '/core/vendor/solid-js/web/dist/web.js';
import { defineLegacyComponent } from '/core/ui-next/components/fxs-solid-component.js';
import './ynamp-age-transition-screen.js';

Automation.log("[YnAMP age-Transition] Loading ynamp-age-transition-bootstrap.js");

function featureEnabled() {
  const gameConfig = Configuration.getGame?.();
  if (!gameConfig || typeof gameConfig.getValue !== 'function') {
    Automation.log("[YnAMP age-Transition] Age transition bootstrap could not read game config.");
    return false;
  }
  const rawValue = gameConfig.getValue('UseCustomAgeTransitionScreen');
  Automation.log("[YnAMP age-Transition] UseCustomAgeTransitionScreen = " + rawValue);
  return rawValue === true || rawValue === 1 || rawValue === '1';
}

const customAgeTransitionEnabled = featureEnabled();
Automation.log("[YnAMP age-Transition] Bootstrap gate resolved = " + customAgeTransitionEnabled);

if (customAgeTransitionEnabled) {
  defineLegacyComponent('age-transition-bootstrap', {
    classNames: ['w-full', 'h-full'],
    calleeURLOrPriority: 100
  }, () => {
    Automation.log('[YnAMP age-Transition] age-transition-bootstrap factory invoked.');
    const element = document.createElement('ynamp-age-transition-screen');
    element.classList.add('w-full', 'h-full');
    Automation.log('[YnAMP age-Transition] Created custom age transition element tag=' + element.tagName);
    return element;
  });
}