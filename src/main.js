// @ts-check
import { installViewport } from './viewport.js';
import { installStyles } from './render/styles.js';
import { registerScreens, go } from './render/screens/router.js';
import { splashScreen } from './render/screens/splash.js';
import { introScreen } from './render/screens/intro.js';

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
installViewport(stage);
installStyles();

registerScreens(stage, {
  splash: splashScreen,
  intro: introScreen,
  // Placeholder until Task 10 lands Home.
  home: () => {
    const d = document.createElement('div');
    d.textContent = 'home (placeholder)';
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#A6DCF6';
    return d;
  },
});

go('splash');
