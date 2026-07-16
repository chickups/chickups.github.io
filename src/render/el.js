// @ts-check

/**
 * Append `px` to a number. Required for EVERY numeric length: unlike React,
 * Object.assign(node.style, {left: 5}) silently does nothing.
 * @param {number} n
 * @returns {string}
 */
export const px = (n) => `${n}px`;

/**
 * @param {string} tag
 * @param {Record<string, string|number>|null} style
 * @param {...(Node|string|null)} children
 * @returns {HTMLElement}
 */
export function el(tag, style, ...children) {
  const node = document.createElement(tag);
  if (style) Object.assign(node.style, style);
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * @param {string} tag
 * @param {Record<string, string|number>} attrs
 * @param {...(Element|null)} children
 * @returns {SVGElement}
 */
export function svg(tag, attrs, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  for (const child of children) if (child) node.appendChild(child);
  return node;
}
