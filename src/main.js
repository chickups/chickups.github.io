// @ts-check
import { installViewport } from './viewport.js';
import { installStyles } from './render/styles.js';
import { registerScreens, go } from './render/screens/router.js';
import { splashScreen } from './render/screens/splash.js';
import { introScreen } from './render/screens/intro.js';
import { homeScreen } from './render/screens/home.js';

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
installViewport(stage);
installStyles();

registerScreens(stage, {
  splash: splashScreen,
  intro: introScreen,
  home: homeScreen,
  // Placeholder until Task 11 lands the game.
  game: () => {
    const d = document.createElement('div');
    d.textContent = 'game (placeholder)';
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#8BD450';
    return d;
  },
});

go('splash');
