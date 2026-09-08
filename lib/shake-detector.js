// Detect direction changes as well as separate acceleration peaks.
export function createShakeDetector() {
 let previous = null, first = -Infinity, last = -Infinity, cooldown = -Infinity;
 return (vector, now) => {
  if (!vector.every(Number.isFinite)) return false;
  const delta = previous ? Math.hypot(...vector.map((v, i) => v - previous[i])) : 0;
  previous = vector;
  if (now - cooldown < 2000 || delta < 5 || now - last < 100) return false;
  last = now;
  if (now - first <= 800) { first = -Infinity; cooldown = now; return true; }
  first = now; return false;
 };
}
