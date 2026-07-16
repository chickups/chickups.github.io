// @ts-check

/** @typedef {{x:number, y:number}} Vec */
/** @typedef {{x:number, y:number, vx:number, vy:number}} Body */

/**
 * Position on the orbit circle. World coords, y-up.
 * @param {Vec} wheel centre
 * @param {number} angle radians
 * @param {number} radius
 * @returns {Vec}
 */
export function orbitPosition(wheel, angle, radius) {
  return {
    x: wheel.x + radius * Math.cos(angle),
    y: wheel.y + radius * Math.sin(angle),
  };
}

/**
 * @param {number} angle radians
 * @param {number} dt seconds
 * @param {number} rate rad/s
 * @returns {number}
 */
export function stepOrbit(angle, dt, rate) {
  return angle + rate * dt;
}

/**
 * Velocity at the instant of release: the derivative of orbitPosition with
 * respect to time, which is by construction tangential. Release angle therefore
 * determines launch direction — this is the game's entire skill expression.
 * @param {number} angle radians
 * @param {number} rate rad/s
 * @param {number} radius
 * @param {number} boost
 * @returns {Vec}
 */
export function launchVelocity(angle, rate, radius, boost) {
  const speed = rate * radius * boost;
  return { x: -speed * Math.sin(angle), y: speed * Math.cos(angle) };
}

/**
 * Semi-implicit Euler: velocity is integrated before position, which is stable
 * at the timesteps this game uses.
 * @param {Body} f
 * @param {number} dt seconds
 * @param {number} gravity pt/s^2, positive, applied downward
 * @returns {Body}
 */
export function stepFly(f, dt, gravity) {
  const vy = f.vy - gravity * dt;
  return { x: f.x + f.vx * dt, y: f.y + vy * dt, vx: f.vx, vy };
}

/**
 * Find a wheel whose grab annulus contains p. The band is an annulus around the
 * wheel centre, not the orbit circle itself, so Peep may grab from slightly
 * inside or outside the orbit radius.
 * @param {Vec} p
 * @param {{index:number, wheel:Vec}[]} entries candidate wheels with field indices
 * @param {number} radius orbit radius
 * @param {number} tolerance half-width of the annulus
 * @returns {{index:number, angle:number}|null}
 */
export function findGrab(p, entries, radius, tolerance) {
  /** @type {{index:number, angle:number}|null} */
  let best = null;
  let bestErr = Infinity;
  for (const { index, wheel } of entries) {
    const dx = p.x - wheel.x;
    const dy = p.y - wheel.y;
    const err = Math.abs(Math.hypot(dx, dy) - radius);
    if (err <= tolerance && err < bestErr) {
      bestErr = err;
      best = { index, angle: Math.atan2(dy, dx) };
    }
  }
  return best;
}
