// @ts-check
import { installViewport } from './viewport.js';
import { installStyles, setReducedMotion } from './render/styles.js';
import { installToasts } from './render/toast.js';
import { initAchievementNotices, initMilestoneNotices, getSetting } from './storage.js';
import { registerScreens, go } from './render/screens/router.js';
import { splashScreen } from './render/screens/splash.js';
import { introScreen } from './render/screens/intro.js';
import { homeScreen } from './render/screens/home.js';
import { journeyScreen } from './render/screens/journey.js';
import { gameScreen } from './render/screens/game.js';
import { pauseScreen } from './render/screens/pause.js';
import { oopsScreen } from './render/screens/oops.js';
import { bestScreen } from './render/screens/best.js';
import { wonScreen } from './render/screens/won.js';
import { rewardScreen } from './render/screens/reward.js';
import { shopScreen } from './render/screens/shop.js';
import { achievementsScreen } from './render/screens/achievements.js';
import { settingsScreen } from './render/screens/settings.js';
import { dailyScreen } from './render/screens/daily.js';
import { raceScreen } from './render/screens/race.js';

// No browser context menu anywhere: a right-click on desktop or a long-press on
// touch would otherwise raise it mid-run, over a game whose only verb is a tap.
// This suppresses the MENU, not the input — right-click still reaches the page.
window.addEventListener('contextmenu', (e) => e.preventDefault());

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
installViewport(stage);
installStyles();
// Before the first screen mounts, or the splash plays its animations once at
// full motion for a player who asked for none.
setReducedMotion(getSetting('motion'));
installToasts(stage);
// Must run before the first run can end: they decide what this player has already
// been told, and only an untouched install may be told everything.
initAchievementNotices();
initMilestoneNotices();

registerScreens(stage, {
  splash: splashScreen,
  intro: introScreen,
  home: homeScreen,
  journey: journeyScreen,
  game: gameScreen,
  pause: pauseScreen,
  oops: oopsScreen,
  best: bestScreen,
  won: wonScreen,
  reward: rewardScreen,
  shop: shopScreen,
  achievements: achievementsScreen,
  settings: settingsScreen,
  daily: dailyScreen,
  race: raceScreen,
});

go('splash');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // A failed registration is not fatal — the game just will not run offline.
    });
  });
}
