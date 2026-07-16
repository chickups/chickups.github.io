// @ts-check
import { installViewport } from './viewport.js';
import { installStyles } from './render/styles.js';
import { registerScreens, go } from './render/screens/router.js';
import { splashScreen } from './render/screens/splash.js';
import { introScreen } from './render/screens/intro.js';
import { homeScreen } from './render/screens/home.js';
import { gameScreen } from './render/screens/game.js';

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
installViewport(stage);
installStyles();

registerScreens(stage, {
  splash: splashScreen,
  intro: introScreen,
  home: homeScreen,
  game: gameScreen,
  // Temporary placeholders until Task 12 lands the real screens.
  pause: (goTo) => { goTo('home'); return document.createElement('div'); },
  oops: (goTo, arg) => {
    const d = document.createElement('div');
    d.textContent = `Oops! ${arg.score} m — tap for home`;
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#A6DCF6;cursor:pointer';
    d.addEventListener('pointerdown', () => goTo('home'));
    return d;
  },
  best: (goTo, arg) => {
    const d = document.createElement('div');
    d.textContent = `NEW BEST ${arg.score} m — tap for home`;
    d.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 24px Nunito;background:#FFB43A;cursor:pointer';
    d.addEventListener('pointerdown', () => goTo('home'));
    return d;
  },
});

go('splash');
