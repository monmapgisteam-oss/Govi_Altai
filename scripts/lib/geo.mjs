// ---------------------------------------------------------------------------
// Geodesy + spatial helpers used by the Govi-Altai analysis pipeline.
// Geometry is projected once to a local azimuthal-equidistant metric plane
// (origin at the aimag centre) so that ArcGIS-style proximity analysis
// (Near, Simple Rings, Service Area) can run with plain planar maths while
// keeping local distance error below ~0.1%. Point-to-point facility distances
// are taken straight on the sphere with haversineKm().
// ---------------------------------------------------------------------------
export const R_EARTH = 6371008.8;

export function makeProjector(lat0Deg) {
  const k = Math.cos((lat0Deg * Math.PI) / 180);
  return {
    lat0: lat0Deg,
    fwd([lon, lat]) {
      return [((lon * Math.PI) / 180) * R_EARTH * k, ((lat * Math.PI) / 180) * R_EARTH];
    },
    inv([x, y]) {
      return [((x / (R_EARTH * k)) * 180) / Math.PI, ((y / R_EARTH) * 180) / Math.PI];
    },
  };
}

/**
 * Azimuthal equidistant projection about (lon0, lat0), in metres.
 *
 * Distances measured *from the projection centre* are exact, and the only
 * distortion elsewhere is tangential, scaling as c/sin(c) with the angular
 * distance c from that centre. Across Govi-Altai (c ≤ ~0.065 rad) that keeps
 * every local distance within ~0.07 % of the true geodesic — an order of
 * magnitude better than a plate-carrée plane, which stretches by ~2.5 % at the
 * aimag's northern and southern edges.
 */
export function makeAzimuthalEquidistant(lon0Deg, lat0Deg) {
  const rad = Math.PI / 180;
  const lon0 = lon0Deg * rad;
  const lat0 = lat0Deg * rad;
  const sinLat0 = Math.sin(lat0);
  const cosLat0 = Math.cos(lat0);
  return {
    lon0: lon0Deg,
    lat0: lat0Deg,
    name: `azimuthal equidistant @ ${lon0Deg.toFixed(3)}, ${lat0Deg.toFixed(3)}`,
    fwd([lon, lat]) {
      const la = lat * rad;
      const dLon = lon * rad - lon0;
      const sinLa = Math.sin(la);
      const cosLa = Math.cos(la);
      const cosC = Math.min(1, Math.max(-1, sinLat0 * sinLa + cosLat0 * cosLa * Math.cos(dLon)));
      const c = Math.acos(cosC);
      // k = c / sin(c), expanded near the origin to stay stable at c -> 0
      const k = c < 1e-8 ? 1 + (c * c) / 6 : c / Math.sin(c);
      return [
        R_EARTH * k * cosLa * Math.sin(dLon),
        R_EARTH * k * (cosLat0 * sinLa - sinLat0 * cosLa * Math.cos(dLon)),
      ];
    },
  };
}

export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return (2 * R_EARTH * Math.asin(Math.sqrt(h))) / 1000;
}

// --- polygon utilities ------------------------------------------------------

export function ringContains(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Works on GeoJSON Polygon / MultiPolygon geometries (lon/lat). */
export function polygonContains(geometry, pt) {
  const [x, y] = pt;
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  for (const poly of polys) {
    if (!poly.length) continue;
    if (!ringContains(poly[0], x, y)) continue;
    let inHole = false;
    for (let h = 1; h < poly.length; h++) if (ringContains(poly[h], x, y)) { inHole = true; break; }
    if (!inHole) return true;
  }
  return false;
}

export function bboxOf(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const scan = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] > maxY) maxY = c[1];
    } else for (const s of c) scan(s);
  };
  scan(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export function ringAreaKm2(ring) {
  let total = 0;
  for (let i = 0, len = ring.length; i < len; i++) {
    const [lon1, lat1] = ring[i];
    const [lon2, lat2] = ring[(i + 1) % len];
    total +=
      (((lon2 - lon1) * Math.PI) / 180) *
      (2 + Math.sin((lat1 * Math.PI) / 180) + Math.sin((lat2 * Math.PI) / 180));
  }
  return Math.abs((total * R_EARTH * R_EARTH) / 2) / 1e6;
}

export function polygonAreaKm2(geometry) {
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  let a = 0;
  for (const poly of polys) {
    if (!poly.length) continue;
    a += ringAreaKm2(poly[0]);
    for (let h = 1; h < poly.length; h++) a -= ringAreaKm2(poly[h]);
  }
  return a;
}

export function lineLengthKm(geometry) {
  const lines = geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates];
  let km = 0;
  for (const line of lines)
    for (let i = 1; i < line.length; i++) km += haversineKm(line[i - 1], line[i]);
  return km;
}

export function polygonCentroid(geometry) {
  // area-weighted centroid of the outer rings
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  let sx = 0, sy = 0, sa = 0;
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 3) continue;
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f;
      cx += (ring[j][0] + ring[i][0]) * f;
      cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (a === 0) continue;
    const w = Math.abs(a / 2);
    sx += (cx / (3 * a)) * w;
    sy += (cy / (3 * a)) * w;
    sa += w;
  }
  return sa ? [sx / sa, sy / sa] : null;
}

// --- segment grid index (the "Near" tool) -----------------------------------

/**
 * Uniform-grid index over projected line segments.
 * Answers "distance from point to nearest segment" in ~O(1) amortised, which
 * is what makes a 9 850 x ~250 000 proximity join tractable in plain Node.
 */
export class SegmentIndex {
  constructor(cellSize = 5000) {
    this.cell = cellSize;
    this.buckets = new Map();
    this.segs = [];
  }
  key(cx, cy) { return cx * 100000 + cy; }
  add(x1, y1, x2, y2, meta) {
    const id = this.segs.length;
    this.segs.push([x1, y1, x2, y2, meta]);
    const c = this.cell;
    const cx0 = Math.floor(Math.min(x1, x2) / c), cx1 = Math.floor(Math.max(x1, x2) / c);
    const cy0 = Math.floor(Math.min(y1, y2) / c), cy1 = Math.floor(Math.max(y1, y2) / c);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = this.key(cx, cy);
        let b = this.buckets.get(k);
        if (!b) this.buckets.set(k, (b = []));
        b.push(id);
      }
  }
  addLine(projected, meta) {
    for (let i = 1; i < projected.length; i++)
      this.add(projected[i - 1][0], projected[i - 1][1], projected[i][0], projected[i][1], meta);
  }
  static segDist2(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / l2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = x1 + t * dx, qy = y1 + t * dy;
    return (px - qx) ** 2 + (py - qy) ** 2;
  }
  nearest(px, py, maxRings = 80) {
    const c = this.cell;
    const cx = Math.floor(px / c), cy = Math.floor(py / c);
    let best = Infinity, bestMeta = null;
    for (let r = 0; r <= maxRings; r++) {
      if (best < Infinity && (r - 1) * c > Math.sqrt(best)) break;
      for (let ix = cx - r; ix <= cx + r; ix++)
        for (let iy = cy - r; iy <= cy + r; iy++) {
          if (r > 0 && Math.abs(ix - cx) !== r && Math.abs(iy - cy) !== r) continue;
          const b = this.buckets.get(this.key(ix, iy));
          if (!b) continue;
          for (const id of b) {
            const s = this.segs[id];
            const d2 = SegmentIndex.segDist2(px, py, s[0], s[1], s[2], s[3]);
            if (d2 < best) { best = d2; bestMeta = s[4]; }
          }
        }
    }
    return { km: best === Infinity ? Infinity : Math.sqrt(best) / 1000, meta: bestMeta };
  }
}

// --- generalisation ---------------------------------------------------------

/** Douglas–Peucker on a lon/lat ring or line; tolerance in degrees. */
export function simplifyLine(coords, tol) {
  if (coords.length < 3) return coords;
  const sqTol = tol * tol;
  const keep = new Uint8Array(coords.length);
  keep[0] = keep[coords.length - 1] = 1;
  const stack = [[0, coords.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    let maxSq = 0, index = 0;
    const [x1, y1] = coords[first], [x2, y2] = coords[last];
    for (let i = first + 1; i < last; i++) {
      const d2 = SegmentIndex.segDist2(coords[i][0], coords[i][1], x1, y1, x2, y2);
      if (d2 > maxSq) { maxSq = d2; index = i; }
    }
    if (maxSq > sqTol) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return coords.filter((_, i) => keep[i]);
}

const roundPt = (p, d) => [
  Math.round(p[0] * 10 ** d) / 10 ** d,
  Math.round(p[1] * 10 ** d) / 10 ** d,
];

/** Simplify + round any GeoJSON geometry so it ships light to the browser. */
export function generalise(geometry, tol = 0.002, decimals = 5) {
  const line = (c) => {
    const s = simplifyLine(c, tol).map((p) => roundPt(p, decimals));
    return s.length >= 2 ? s : c.map((p) => roundPt(p, decimals));
  };
  const ring = (c) => {
    let s = simplifyLine(c, tol).map((p) => roundPt(p, decimals));
    if (s.length < 4) s = c.map((p) => roundPt(p, decimals));
    const [f, l] = [s[0], s[s.length - 1]];
    if (f[0] !== l[0] || f[1] !== l[1]) s.push([f[0], f[1]]);
    return s;
  };
  switch (geometry.type) {
    case 'LineString':
      return { type: 'LineString', coordinates: line(geometry.coordinates) };
    case 'MultiLineString':
      return { type: 'MultiLineString', coordinates: geometry.coordinates.map(line) };
    case 'Polygon':
      return { type: 'Polygon', coordinates: geometry.coordinates.map(ring) };
    case 'MultiPolygon':
      return { type: 'MultiPolygon', coordinates: geometry.coordinates.map((p) => p.map(ring)) };
    default:
      return geometry;
  }
}
