// ---------------------------------------------------------------------------
// Accessibility analytics — the ArcGIS Business Analyst logic, in plain JS.
//
//  * Simple Rings / Distance bands   -> bandCounts()
//  * Near (proximity join)           -> geo.SegmentIndex.nearest()
//  * Trade-area Enrichment           -> weighted band aggregation
//  * Supply/demand accessibility     -> e2sfca()  (Enhanced 2-Step Floating
//                                       Catchment Area, Gaussian decay)
//  * Composite index / ranking       -> minMax() + weighted blend
// ---------------------------------------------------------------------------

/** Distance bands (km) used for every proximity histogram. */
export const BANDS = {
  school:       [10, 25, 50, 80],
  kindergarten: [5, 15, 30, 50],
  road:         [2, 5, 10, 20],
};

/** Five-step qualitative scale shared by every accessibility theme. */
export const GRADES = ['Маш сайн', 'Сайн', 'Дунд', 'Хангалтгүй', 'Маш хангалтгүй'];

/** E2SFCA catchment radii (km) — how far a family will realistically travel. */
export const CATCHMENT = { school: 80, kindergarten: 50, health: 70 };

/** Estimated speeds (km/h) by road class, for the travel-time model. */
export const SPEED_BY_CLASS = {
  'Улсын чанартай авто зам': 60,
  'Хоёрдогч авто зам': 45,
  'Гуравдагч зам': 35,
  'Гол хөрсөн зам': 40,
  'Хөрсөн зам': 28,
  'Үйлчилгээний зам': 25,
  'Явган хүний зам': 10,
};
export const OFFROAD_SPEED = 15;   // km/h across open steppe to reach a road
export const CIRCUITY = 1.3;       // network detour factor vs. straight line

/** Which band a distance falls into (0 = closest, breaks.length = farthest). */
export function bandOf(km, breaks) {
  for (let i = 0; i < breaks.length; i++) if (km <= breaks[i]) return i;
  return breaks.length;
}

export function bandLabels(breaks, unit = 'км') {
  const out = [];
  for (let i = 0; i < breaks.length; i++)
    out.push(i === 0 ? `0–${breaks[0]} ${unit}` : `${breaks[i - 1]}–${breaks[i]} ${unit}`);
  out.push(`${breaks[breaks.length - 1]}+ ${unit}`);
  return out;
}

/** Weighted histogram over distance bands. */
export function bandCounts(items, breaks, distFn, weightFn = () => 1) {
  const n = new Array(breaks.length + 1).fill(0);
  const w = new Array(breaks.length + 1).fill(0);
  for (const it of items) {
    const b = bandOf(distFn(it), breaks);
    n[b] += 1;
    w[b] += weightFn(it);
  }
  return { count: n, weight: w };
}

/** Gaussian distance decay used by E2SFCA (Dai 2010), zero beyond d0. */
export function gaussianDecay(d, d0) {
  if (d > d0) return 0;
  const e = Math.exp(-0.5);
  return (Math.exp(-0.5 * (d / d0) ** 2) - e) / (1 - e);
}

/**
 * Enhanced Two-Step Floating Catchment Area.
 * @param demand   [{x, y, w}]        demand sites in projected metres, w = households
 * @param supply   [{x, y, s}]        facilities, s = number of schools/kindergartens
 * @param d0Km     catchment radius
 * @returns {{ai: number[], rj: number[]}} ai = facilities per demand unit at each site
 */
export function e2sfca(demand, supply, d0Km) {
  const d0 = d0Km * 1000;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // Step 1 — supply-to-demand ratio in each facility's catchment
  const rj = supply.map((f) => {
    let denom = 0;
    for (const p of demand) {
      const d = dist(p, f);
      if (d > d0) continue;
      denom += p.w * gaussianDecay(d / 1000, d0Km);
    }
    return denom > 0 ? f.s / denom : 0;
  });

  // Step 2 — sum the ratios reachable from each demand site
  const ai = demand.map((p) => {
    let a = 0;
    for (let j = 0; j < supply.length; j++) {
      const d = dist(p, supply[j]);
      if (d > d0) continue;
      a += rj[j] * gaussianDecay(d / 1000, d0Km);
    }
    return a;
  });

  return { ai, rj };
}

/**
 * Allocate an aimag-level facility total across soums.
 * Every soum centre gets one facility first (every Mongolian soum has a school
 * and a kindergarten); the surplus follows household share, largest-remainder.
 */
export function allocateFacilities(total, soums, weightKey = 'households') {
  const n = soums.length;
  if (total <= n) {
    // not enough for one each — pure proportional, minimum 0
    const sum = soums.reduce((s, x) => s + (x[weightKey] || 0), 0) || 1;
    const raw = soums.map((x) => (total * (x[weightKey] || 0)) / sum);
    return largestRemainder(raw, total);
  }
  const surplus = total - n;
  const sum = soums.reduce((s, x) => s + (x[weightKey] || 0), 0) || 1;
  const raw = soums.map((x) => (surplus * (x[weightKey] || 0)) / sum);
  return largestRemainder(raw, surplus).map((v) => v + 1);
}

function largestRemainder(raw, total) {
  const floor = raw.map((v) => Math.floor(v));
  let rest = total - floor.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < order.length && rest > 0; k++, rest--) floor[order[k].i] += 1;
  return floor;
}

/** Min–max rescale to 0–100. `invert` for "lower is better" measures. */
export function minMax(values, invert = false) {
  const valid = values.filter((v) => Number.isFinite(v));
  const lo = Math.min(...valid), hi = Math.max(...valid);
  return values.map((v) => {
    if (!Number.isFinite(v) || hi === lo) return 50;
    const t = ((v - lo) / (hi - lo)) * 100;
    return invert ? 100 - t : t;
  });
}

/** Estimated travel time (hours): off-road leg + on-network leg. */
export function travelHours(distToRoadKm, distToCentreKm, roadClass) {
  const v = SPEED_BY_CLASS[roadClass] ?? 25;
  const onNetwork = Math.max(0, distToCentreKm * CIRCUITY - distToRoadKm);
  return distToRoadKm / OFFROAD_SPEED + onNetwork / v;
}

export const round = (v, d = 2) =>
  Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null;
