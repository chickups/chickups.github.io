// @ts-check
import { installViewport } from './viewport.js';
import { installStyles, setReducedMotion } from './render/styles.js';
import { installToasts } from './render/toast.js';
import { applyContrast } from './render/contrast.js';
import { initAchievementNotices, initMilestoneNotices, getSetting } from './storage.js';
import { unlock as unlockSound } from './sound.js';
import { initMusic, unlock as unlockMusic, playBgm, playSting } from './music.js';
import { registerScreens, go, onNavigate } from './render/screens/router.js';
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
import { howtoScreen } from './render/screens/howto.js';

// No browser context menu anywhere: a right-click on desktop or a long-press on
// touch would otherwise raise it mid-run, over a game whose only verb is a tap.
// This suppresses the MENU, not the input — right-click still reaches the page.
window.addEventListener('contextmenu', (e) => e.preventDefault());
// AudioContext (sound.js) and HTMLAudioElement playback (music.js) may only
// start from a user gesture (autoplay policy); the first tap anywhere unlocks
// both, well before any run-specific audio needs to play. initMusic builds the
// elements now so the unlock has something to start.
initMusic();
window.addEventListener('pointerdown', unlockSound);
window.addEventListener('pointerdown', unlockMusic);

// The one place screen→music policy lives (see router.onNavigate). Menus loop
// the main theme; the game screen drives its own biome loop from game.js and
// only gets the launch flourish here; the terminal screens get their stingers.
const MENU_THEME = 'main-theme';
onNavigate((name) => {
  switch (name) {
    case 'game':
      // The biome loop is game.js's job; here, just the "here we go" flourish.
      playSting('sting-launch');
      break;
    case 'oops':
      playBgm(MENU_THEME);
      playSting('sting-gameover');
      break;
    case 'best':
      playBgm(MENU_THEME);
      playSting('sting-highscore');
      break;
    case 'won':
      // A win happens in the final biome; keep that triumphant theme running
      // rather than cutting to the menu loop. No dedicated victory track exists.
      playBgm('escape');
      break;
    case 'pause':
      // Leave the biome loop playing under the overlay — don't switch it out.
      break;
    default:
      playBgm(MENU_THEME);
  }
});

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
// Before the first screen mounts: a player who turned this on last session must
// never see one un-styled frame of the game they turned it on for.
applyContrast(getSetting('contrast'));

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
  howto: howtoScreen,
});

go('splash');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // A failed registration is not fatal — the game just will not run offline.
    });
  });
}
