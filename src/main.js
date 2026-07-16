// @ts-check
import { installViewport } from './viewport.js';

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
installViewport(stage);

stage.textContent = 'stage ok';
