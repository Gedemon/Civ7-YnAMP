import '../../../../core/vendor/solid-js/web/dist/web.js';
import { defineLegacyComponent } from '../../../../core/ui-next/components/fxs-solid-component.js';
import '/ui/age-transition/ynamp-age-transition-screen.js';

Automation.log('[YnAMP age-Transition] Loading replacement age-transition-bootstrap.js');

defineLegacyComponent('age-transition-bootstrap', {
  classNames: ['w-full', 'h-full']
}, () => {
  Automation.log('[YnAMP age-Transition] Replacement bootstrap factory invoked.');
  const element = document.createElement('ynamp-age-transition-screen');
  element.classList.add('w-full', 'h-full');
  Automation.log('[YnAMP age-Transition] Replacement created custom age transition element tag=' + element.tagName);
  return element;
});