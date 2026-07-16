// @ts-check
import { svg } from '../el.js';

/** Stroked glyphs. `circle:cx,cy,r` and `rect:x,y,w,h,rx` are shorthands; `|` separates shapes. */
const STROKE = {
  close: 'M6 6l12 12M18 6L6 18',
  gear: 'M12 2.4v3M12 18.6v3M2.4 12h3M18.6 12h3M5 5l2.1 2.1M16.9 16.9L19 19M19 5l-2.1 2.1M7.1 16.9L5 19',
  share: 'M12 3v13M8.5 6.5L12 3l3.5 3.5M6 10H5v10h14V10h-1',
  map: 'M9 4L3 6v15l6-2 6 2 6-2V4l-6 2zM9 4v15M15 6v15',
  shirt: 'M8.5 4L4 7l2 3.2 2-1.1V20h8V9.1l2 1.1L20 7l-4.5-3-1.4 1.6a3.2 3.2 0 0 1-4.2 0z',
  trophy: 'M7 4h10v4.5a5 5 0 0 1-10 0zM7 6.5H4.5v1a3 3 0 0 0 3 3M17 6.5h2.5v1a3 3 0 0 1-3 3M9.5 20h5M12 15v5',
  lock: 'rect:5,10.5,14,9.5,2|M8 10.5V7.5a4 4 0 0 1 8 0v3',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevR: 'M9.5 5l7 7-7 7',
  chevL: 'M14.5 5l-7 7 7 7',
  refresh: 'M5 12a7 7 0 1 1 2 5M5 17.5V12h5.5',
  home: 'M4 11.5L12 4l8 7.5M6.2 10v9.5h11.6V10',
  calendar: 'rect:4,5,16,15,2|M4 9.5h16M8.5 3v4M15.5 3v4',
  bars: 'M6.5 20v-7M12 20V4M17.5 20v-9',
  music: 'M9 18V6.5l9.5-2V15M9 18a3 3 0 1 1-.001-.001zM18.5 15a3 3 0 1 1-.001-.001z',
  sound: 'M4 9.5v5h3.5L13 19V5L7.5 9.5H4zM16 9.5a4 4 0 0 1 0 5M18.5 7a7 7 0 0 1 0 10',
  haptic: 'rect:8.5,4,7,16,3|M4 9.5v5M20 9.5v5',
  hand: 'M9 11.5V5.5a1.6 1.6 0 0 1 3.2 0v5M12.2 10.5V4a1.6 1.6 0 0 1 3.2 0v6.5M15.4 11V6.5a1.6 1.6 0 0 1 3.2 0V14c0 4-2.4 6.5-6.4 6.5-2.6 0-4-1-5.8-3.6l-1.7-2.6a1.7 1.7 0 0 1 2.8-1.9l1 1.3',
  plus: 'M12 5v14M5 12h14',
  globe: 'circle:12,12,8.2|M3.8 12h16.4M12 3.8c3 3 3 13.4 0 16.4M12 3.8c-3 3-3 13.4 0 16.4',
  gift: 'rect:4,9.5,16,10.5,2|M4 13.5h16M12 9.5v10.5M12 9.5C10.8 5.6 5.8 5.8 5.8 8.7c0 1 6.2.8 6.2.8zM12 9.5c1.2-3.9 6.2-3.7 6.2-.8 0 1-6.2.8-6.2.8z',
  truck: 'rect:2.5,7,11,9,1.5|M13.5 10h4.2l3.3 3.2V16h-7.5zM7 18.5a2 2 0 1 1-.001 0zM17 18.5a2 2 0 1 1-.001 0z',
  arrowR: 'M4 12h15M13 6l6 6-6 6',
  volume: 'M4 9.5v5h3.5L13 19V5L7.5 9.5H4z',
  chart: 'M4 20h16M7 16l3.5-4 3 2.5L20 8',
};

/** Filled glyphs. */
const FILLED = {
  play: 'M8 5.2v13.6L19 12z',
  pause: 'M7 5h3.3v14H7zM13.7 5H17v14h-3.3z',
  feather: 'M20.5 3.5C11 3.5 6 8.5 6 15.5L4 20l1.5-1.5C13 18.5 20.5 12.5 20.5 3.5z',
  flame: 'M12.5 2.5c1.2 3.4-2.2 4.3-2.2 7.5a2.2 2.2 0 0 0 4.2.6c1.8 1.8 2.5 3.6 2.5 5.6a5.5 5.5 0 0 1-11 0c0-4.5 3.5-6.5 6.5-13.7z',
  star: 'M12 3l2.7 5.9 6.3.6-4.8 4.2 1.5 6.3L12 17.2 6.3 20.3l1.5-6.3L3 9.5l6.3-.6z',
  ghost: 'M5 20.5V11a7 7 0 0 1 14 0v9.5l-2.6-2-2.3 2-2.1-2-2.3 2z',
};

/**
 * @param {string} spec one shape from a STROKE entry
 * @param {number} i
 * @returns {Element}
 */
function shape(spec) {
  if (spec.startsWith('circle:')) {
    const [cx, cy, r] = spec.slice(7).split(',');
    return svg('circle', { cx: +cx, cy: +cy, r: +r });
  }
  if (spec.startsWith('rect:')) {
    const [x, y, w, h, r] = spec.slice(5).split(',');
    return svg('rect', { x: +x, y: +y, width: +w, height: +h, rx: +(r || 0) });
  }
  return svg('path', { d: spec });
}

/**
 * @param {string} glyph
 * @param {number} [size]
 * @param {string} [color]
 * @param {number} [sw] stroke width
 * @returns {SVGElement}
 */
export function icon(glyph, size = 24, color = '#4B3524', sw = 2) {
  if (FILLED[glyph]) {
    const extra = [];
    if (glyph === 'ghost') {
      extra.push(svg('circle', { cx: 9.5, cy: 11, r: 1, fill: '#8FD3F4' }));
      extra.push(svg('circle', { cx: 14.5, cy: 11, r: 1, fill: '#8FD3F4' }));
    }
    return svg(
      'svg',
      { viewBox: '0 0 24 24', width: size, height: size, fill: color },
      svg('path', { d: FILLED[glyph] }),
      ...extra,
    );
  }
  const spec = STROKE[glyph] || STROKE.gear;
  const kids = spec.split('|').map(shape);
  if (glyph === 'gear') kids.unshift(svg('circle', { cx: 12, cy: 12, r: 3.4 }));
  return svg(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: size,
      height: size,
      fill: 'none',
      stroke: color,
      'stroke-width': sw,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    },
    ...kids,
  );
}
