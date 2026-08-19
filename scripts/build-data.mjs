/**
 * Govi-Altai infrastructure accessibility — data pipeline.
 *
 * Reads every feature layer of the source web map straight from the ArcGIS
 * REST API, runs the Business-Analyst-style accessibility analysis, and writes
 * ready-to-render JSON into public/data/.
 *
 *   npm run data
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LAYERS, WEBMAP_ID, WEBMAP_URL, queryGeoJSON, queryCentroids, queryAttributes }
  from './lib/arcgis.mjs';
import {
  makeAzimuthalEquidistant, haversineKm, polygonContains, bboxOf, polygonAreaKm2,
  polygonCentroid, lineLengthKm, SegmentIndex, generalise,
} from './lib/geo.mjs';
import {
  BANDS, GRADES, CATCHMENT, bandOf, bandLabels, bandCounts, e2sfca,
  allocateFacilities, minMax, travelHours, round,
} from './lib/analysis.mjs';

const AIMAG_CODE = '82';
const AIMAG_NAME = 'Говь-Алтай';
const OUT = join(process.cwd(), 'public', 'data');
const YEARS = Array.from({ length: 26 }, (_, i) => 2000 + i);

const log = (...a) => console.log('·', ...a);
const pct = (part, whole) => (whole > 0 ? round((part / whole) * 100, 1) : 0);
const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);

/** Pull a yYYYY-style time series out of a statistics-layer attribute row. */
function series(attrs, from = 2000) {
  const out = [];
  for (const y of YEARS) {
    if (y < from) continue;
    const v = attrs[`y${y}`];
    if (v === undefined) continue;
    out.push({ year: y, value: v === null ? null : round(v, 1) });
  }
  return out;
}

async function main() {
  const started = Date.now();
  await mkdir(join(OUT, 'geo'), { recursive: true });

  // ==========================================================================
  // 1. GEOGRAPHY
  // ==========================================================================
  log('аймаг, сумын хил татаж байна…');
  const [aimagFeat] = await queryGeoJSON(LAYERS.schoolAimag.url, {
    where: `aimag_code_boundary='${AIMAG_CODE}'`,
    outFields: 'aimag_code_boundary,aimag_name_boundary',
  });
  if (!aimagFeat) throw new Error('Аймгийн хил олдсонгүй');

  const soumFeats = await queryGeoJSON(LAYERS.householdSoum.url, {
    where: `aimag_code_boundary='${AIMAG_CODE}'`,
    orderByFields: 'soum_code_boundary',
  });
  log(`  ${soumFeats.length} сум`);

  const aimagBBox = bboxOf(aimagFeat.geometry);
  const centreLat = (aimagBBox[1] + aimagBBox[3]) / 2;
  const centreLon = (aimagBBox[0] + aimagBBox[2]) / 2;
  const proj = makeAzimuthalEquidistant(centreLon, centreLat);

  const soums = soumFeats.map((f, i) => {
    const a = f.properties;
    const geom = f.geometry;
    return {
      idx: i,
      code: a.soum_code_boundary,
      name: a.soum_name_boundary,
      geometry: geom,
      bbox: bboxOf(geom),
      areaKm2: round(polygonAreaKm2(geom), 1),
      centroid: polygonCentroid(geom),
      households: a.last_y ?? 0,
      householdYear: a.latest_year,
      householdSeries: series(a, 2003),
    };
  });

  /** Point-in-polygon lookup across the 18 soums, with a bbox prefilter. */
  const soumAt = (pt) => soums.find(
    (s) => pt[0] >= s.bbox[0] && pt[0] <= s.bbox[2] && pt[1] >= s.bbox[1] && pt[1] <= s.bbox[3]
      && polygonContains(s.geometry, pt));

  // --- soum population (ЗТХЯ "Сумын мэдээлэл") ------------------------------
  log('сумын хүн ам татаж байна…');
  const soumInfo = await queryCentroids(LAYERS.soumInfo.url, {
    outFields: 'FID,code,name,hvn_am_too,area,density',
    orderByFields: 'FID',
  });
  const inAimagBBox = (c) => c && c.x >= aimagBBox[0] && c.x <= aimagBBox[2]
    && c.y >= aimagBBox[1] && c.y <= aimagBBox[3];
  const norm = (s) => (s || '').toLowerCase().replace(/[\s\-–_]/g, '').replace(/ё/g, 'е');

  let matchedPop = 0;
  const leftover = [];
  // pass 1 — spatial match on the record's own centroid
  for (const rec of soumInfo) {
    const c = rec.centroid;
    if (!c) continue;
    const host = soumAt([c.x, c.y]);
    if (!host || host.population) { if (inAimagBBox(c)) leftover.push(rec); continue; }
    host.population = rec.attributes.hvn_am_too ?? null;
    host.zthtName = rec.attributes.name;
    matchedPop++;
  }
  // pass 2 — name match for soums whose ZTHT centroid falls in a polygon hole
  for (const s of soums) {
    if (s.population) continue;
    const hit = leftover.find((r) => norm(r.attributes.name) === norm(s.name));
    if (!hit) continue;
    s.population = hit.attributes.hvn_am_too ?? null;
    s.zthtName = hit.attributes.name;
    matchedPop++;
  }
  log(`  ${matchedPop}/${soums.length} суманд хүн амын мэдээ тохирлоо`);

  // --- settlement centres = the school / kindergarten supply points ---------
  log('сум, аймгийн төв татаж байна…');
  const allCentres = await queryGeoJSON(LAYERS.centers.url, { orderByFields: 'FID' });
  const centres = [];
  for (const f of allCentres) {
    const pt = f.geometry && f.geometry.coordinates;
    if (!pt) continue;
    if (pt[0] < aimagBBox[0] || pt[0] > aimagBBox[2] || pt[1] < aimagBBox[1] || pt[1] > aimagBBox[3])
      continue;
    const host = soumAt(pt);
    if (!host) continue;
    // a few centre records carry a blank NAME (e.g. the aimag centre) — fall back
    const label = (f.properties.NAME || '').trim() || host.name;
    centres.push({ soumIdx: host.idx, name: label, lon: pt[0], lat: pt[1] });
  }
  // one supply point per soum; fall back to the polygon centroid if absent
  for (const s of soums) {
    const own = centres.filter((c) => c.soumIdx === s.idx);
    s.centre = own[0]
      ? { lon: own[0].lon, lat: own[0].lat, name: own[0].name, source: 'ЗТХЯ сумын төв' }
      : { lon: s.centroid[0], lat: s.centroid[1], name: s.name, source: 'сумын хилийн жинлэсэн төв' };
  }
  const fallbacks = soums.filter((s) => s.centre.source !== 'ЗТХЯ сумын төв').length;
  log(`  ${centres.length} суурин цэг, ${fallbacks} сум нөхөн бодогдов`);

  // ==========================================================================
  // 2. DEMAND — herder winter/spring camps
  // ==========================================================================
  log('өвөлжөө, хаваржаа татаж байна…');
  const campRecs = await queryCentroids(LAYERS.camps.url, {
    where: `aimag_code=${AIMAG_CODE}`,
    outFields: 'OBJECTID,aimag_code',
    orderByFields: 'OBJECTID',
  });
  const camps = [];
  for (const r of campRecs) {
    const c = r.centroid;
    if (!c) continue;
    const pt = [c.x, c.y];
    const host = soumAt(pt);
    const p = proj.fwd(pt);
    camps.push({ lon: pt[0], lat: pt[1], x: p[0], y: p[1], soumIdx: host ? host.idx : -1 });
  }
  log(`  ${camps.length} бууц (${camps.filter((c) => c.soumIdx < 0).length} сумд оногдоогүй)`);

  // ==========================================================================
  // 3. ROAD NETWORK
  // ==========================================================================
  log('замын сүлжээ татаж байна…');
  const roadFeats = await queryGeoJSON(LAYERS.roads.url, { where: `aimag_code=${AIMAG_CODE}` });
  const pad = 0.2;
  const natFeats = await queryGeoJSON(LAYERS.nationalRoads.url, {
    geometry: {
      xmin: aimagBBox[0] - pad, ymin: aimagBBox[1] - pad,
      xmax: aimagBBox[2] + pad, ymax: aimagBBox[3] + pad,
    },
  });
  log(`  ${roadFeats.length} замын хэрчим, ${natFeats.length} улсын чанартай зам (bbox)`);

  // clip the national-road lines to the aimag boundary, vertex-wise
  const natClipped = [];
  for (const f of natFeats) {
    const lines = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates : [f.geometry.coordinates];
    const runs = [];
    for (const line of lines) {
      let run = [];
      for (const pt of line) {
        if (polygonContains(aimagFeat.geometry, pt)) run.push(pt);
        else { if (run.length > 1) runs.push(run); run = []; }
      }
      if (run.length > 1) runs.push(run);
    }
    if (!runs.length) continue;
    const p = f.properties;
    natClipped.push({
      type: 'Feature',
      properties: {
        name: p.RoadDName || p.ROADNAME || '',
        code: p.ROADCODE || '',
        pavement: p.PAVEMENT_T || '',
        status: p.Roadstatus || '',
        load: p.RoadLoad || '',
        owner: p.RoadOwner || '',
        builtYear: p.Build_ogno || null,
        lengthKm: 0,
      },
      geometry: { type: 'MultiLineString', coordinates: runs },
    });
  }
  for (const f of natClipped) f.properties.lengthKm = round(lineLengthKm(f.geometry), 1);
  log(`  ${natClipped.length} улсын зам аймгийн хилд тайрагдав`);

  // proximity indices — the equivalent of the ArcGIS "Near" tool
  const roadIndex = new SegmentIndex(4000);
  const natIndex = new SegmentIndex(8000);
  for (const f of roadFeats) {
    const cls = f.properties.roadtype || 'Тодорхойгүй';
    const lines = f.geometry.type === 'MultiLineString'
      ? f.geometry.coordinates : [f.geometry.coordinates];
    for (const line of lines) {
      const pl = line.map((p) => proj.fwd(p));
      roadIndex.addLine(pl, cls);
      if (cls === 'Улсын чанартай авто зам') natIndex.addLine(pl, cls);
    }
  }
  for (const f of natClipped)
    for (const line of f.geometry.coordinates)
      natIndex.addLine(line.map((p) => proj.fwd(p)), 'Улсын чанартай авто зам');
  log(`  индекс: ${roadIndex.segs.length} хэрчим (бүх зам) / ${natIndex.segs.length} (улсын зам)`);

  // ==========================================================================
  // 4. AIMAG-LEVEL STATISTICS
  // ==========================================================================
  log('аймгийн статистик татаж байна…');
  const where = `aimag_code_boundary='${AIMAG_CODE}'`;
  const [schoolRow] = await queryAttributes(LAYERS.schoolAimag.url, { where });
  const [kgRow] = await queryAttributes(LAYERS.kindergartenAimag.url, { where });
  const healthRows = await queryAttributes(LAYERS.healthAimag.url, { where });
  const livestockRows = await queryAttributes(LAYERS.livestockAimag.url, { where });

  const nationalFields = 'aimag_code_boundary,aimag_name_boundary,last_y,latest_year';
  const schoolAll = await queryAttributes(LAYERS.schoolAimag.url, { outFields: nationalFields });
  const kgAll = await queryAttributes(LAYERS.kindergartenAimag.url, { outFields: nationalFields });
  const hhAll = await queryAttributes(LAYERS.householdSoum.url, {
    outFields: 'aimag_code_boundary,aimag_name_boundary,last_y',
  });

  // Health accessibility uses only the facilities that actually deliver care;
  // pharmacies, drug suppliers and the "other" bucket are not treatment points.
  const NON_CARE = ['Хувийн эмийн сан', 'Эм ханган нийлүүлэх байгууллага', 'Эмийн үйлдвэр', 'Бусад'];
  const healthTotal = Math.round(
    sum(healthRows.filter((r) => !NON_CARE.includes(r.uzuulelt)).map((r) => r.last_y)),
  );

  const schoolTotal = Math.round(schoolRow ? schoolRow.last_y || 0 : 0);
  const kgTotal = Math.round(kgRow ? kgRow.last_y || 0 : 0);
  const herderHH = sum(livestockRows.map((r) => r.last_y));
  log(`  сургууль ${schoolTotal}, цэцэрлэг ${kgTotal}, эрүүл мэнд ${healthTotal}, малтай өрх ${herderHH}`);

  // ==========================================================================
  // 5. ANALYSIS
  // ==========================================================================
  log('хүртээмжийн тооцоолол…');

  // --- 5a. camp counts per soum, herder-household weight --------------------
  for (const s of soums) s.campCount = 0;
  for (const c of camps) if (c.soumIdx >= 0) soums[c.soumIdx].campCount++;
  const campTotal = camps.filter((c) => c.soumIdx >= 0).length;
  const hhPerCamp = campTotal > 0 ? herderHH / campTotal : 0;
  for (const s of soums) {
    s.herderHouseholds = Math.round(s.campCount * hhPerCamp);
    s.centreHouseholds = Math.max(0, (s.households || 0) - s.herderHouseholds);
    // Facility accessibility is measured against *people*: soum-level facility
    // counts do not exist, so population is the only defensible basis for both
    // allocating the aimag totals and weighting demand.
    s.householdSize = s.households > 0 ? (s.population || 0) / s.households : 0;
    s.herderPopulation = Math.round(s.herderHouseholds * s.householdSize);
    s.centrePopulation = Math.max(0, (s.population || 0) - s.herderPopulation);
    s.popPerCamp = s.campCount > 0 ? s.herderPopulation / s.campCount : 0;
  }

  // --- 5b. facility allocation (aimag total -> soums) ----------------------
  const schoolAlloc = allocateFacilities(schoolTotal, soums, 'population');
  const kgAlloc = allocateFacilities(kgTotal, soums, 'population');
  const healthAlloc = allocateFacilities(healthTotal, soums, 'population');
  soums.forEach((s, i) => {
    s.schools = schoolAlloc[i];
    s.kindergartens = kgAlloc[i];
    s.healthFacilities = healthAlloc[i];
  });

  // --- 5c. per-camp proximity ----------------------------------------------
  const centrePts = soums.map((s) => {
    const p = proj.fwd([s.centre.lon, s.centre.lat]);
    return { idx: s.idx, x: p[0], y: p[1] };
  });
  const centreLL = soums.map((s) => ({ idx: s.idx, ll: [s.centre.lon, s.centre.lat] }));
  for (const c of camps) {
    const r = roadIndex.nearest(c.x, c.y);
    c.dRoad = r.km;
    c.roadClass = r.meta || 'Тодорхойгүй';
    c.dNat = natIndex.nearest(c.x, c.y).km;

    // facility distance is a point-to-point measure, so take it on the sphere
    // directly — no projection error enters the accessibility bands at all
    let best = Infinity;
    let bestIdx = -1;
    for (const cp of centreLL) {
      const d = haversineKm([c.lon, c.lat], cp.ll);
      if (d < best) { best = d; bestIdx = cp.idx; }
    }
    c.dCentre = best;
    c.nearestSoum = bestIdx;
    c.travelH = travelHours(c.dRoad, c.dCentre, c.roadClass);
  }

  // --- 5d. E2SFCA -----------------------------------------------------------
  const demand = [
    ...camps.map((c) => ({
      x: c.x,
      y: c.y,
      w: c.soumIdx >= 0 ? soums[c.soumIdx].popPerCamp : 0,
      soumIdx: c.soumIdx,
    })),
    ...soums.map((s, i) => ({ x: centrePts[i].x, y: centrePts[i].y, w: s.centrePopulation, soumIdx: s.idx })),
  ];
  const supplySchool = soums.map((s, i) => ({ x: centrePts[i].x, y: centrePts[i].y, s: s.schools }));
  const supplyKg = soums.map((s, i) => ({ x: centrePts[i].x, y: centrePts[i].y, s: s.kindergartens }));
  const supplyHealth = soums.map((s, i) => ({ x: centrePts[i].x, y: centrePts[i].y, s: s.healthFacilities }));

  const schoolA = e2sfca(demand, supplySchool, CATCHMENT.school);
  const kgA = e2sfca(demand, supplyKg, CATCHMENT.kindergarten);
  const healthA = e2sfca(demand, supplyHealth, CATCHMENT.health);

  // aggregate the accessibility surface up to soum level (household-weighted)
  const agg = soums.map(() => ({ w: 0, sch: 0, kg: 0, hlt: 0 }));
  demand.forEach((d, i) => {
    if (d.soumIdx < 0) return;
    const a = agg[d.soumIdx];
    a.w += d.w;
    a.sch += schoolA.ai[i] * d.w;
    a.kg += kgA.ai[i] * d.w;
    a.hlt += healthA.ai[i] * d.w;
  });
  soums.forEach((s, i) => {
    const a = agg[i];
    s.schoolA = a.w > 0 ? (a.sch / a.w) * 1000 : 0;   // facilities per 1 000 people
    s.kgA = a.w > 0 ? (a.kg / a.w) * 1000 : 0;
    s.healthAcc = a.w > 0 ? (a.hlt / a.w) * 1000 : 0;
  });

  // --- 5e. per-soum distance profiles & coverage ---------------------------
  const campsBySoum = soums.map(() => []);
  for (const c of camps) if (c.soumIdx >= 0) campsBySoum[c.soumIdx].push(c);

  const roadStatsBySoum = new Map();
  for (const f of roadFeats) {
    const code = String(f.properties.soum_code == null ? '' : f.properties.soum_code);
    const cls = f.properties.roadtype || 'Тодорхойгүй';
    const km = f.properties.Length_km == null ? lineLengthKm(f.geometry) : f.properties.Length_km;
    if (!roadStatsBySoum.has(code)) roadStatsBySoum.set(code, { total: 0, byClass: {} });
    const e = roadStatsBySoum.get(code);
    e.total += km;
    e.byClass[cls] = (e.byClass[cls] || 0) + km;
  }

  const quantiles = (arr) => {
    const a = [...arr].sort((x, y) => x - y);
    return {
      med: a.length ? a[Math.floor(a.length / 2)] : 0,
      p90: a.length ? a[Math.floor(a.length * 0.9)] : 0,
    };
  };

  soums.forEach((s, i) => {
    const cs = campsBySoum[i];
    const n = cs.length || 1;

    s.dSchool = { mean: round(sum(cs.map((c) => c.dCentre)) / n, 1), ...quantiles(cs.map((c) => c.dCentre)) };
    s.dRoadStat = { mean: round(sum(cs.map((c) => c.dRoad)) / n, 2), ...quantiles(cs.map((c) => c.dRoad)) };
    s.dNatStat = { mean: round(sum(cs.map((c) => c.dNat)) / n, 1), ...quantiles(cs.map((c) => c.dNat)) };
    s.travelH = round(sum(cs.map((c) => c.travelH)) / n, 2);

    s.bandsSchool = bandCounts(cs, BANDS.school, (c) => c.dCentre).count;
    s.bandsKg = bandCounts(cs, BANDS.kindergarten, (c) => c.dCentre).count;
    s.bandsRoad = bandCounts(cs, BANDS.road, (c) => c.dRoad).count;

    s.cover = {
      school25: pct(cs.filter((c) => c.dCentre <= 25).length, cs.length),
      school50: pct(cs.filter((c) => c.dCentre <= 50).length, cs.length),
      kg15: pct(cs.filter((c) => c.dCentre <= 15).length, cs.length),
      kg30: pct(cs.filter((c) => c.dCentre <= 30).length, cs.length),
      road5: pct(cs.filter((c) => c.dRoad <= 5).length, cs.length),
      road10: pct(cs.filter((c) => c.dRoad <= 10).length, cs.length),
      nat20: pct(cs.filter((c) => c.dNat <= 20).length, cs.length),
    };

    const rs = roadStatsBySoum.get(s.code) || { total: 0, byClass: {} };
    s.roadKm = round(rs.total, 1);
    s.roadByClass = Object.fromEntries(Object.entries(rs.byClass).map(([k, v]) => [k, round(v, 1)]));
    s.roadDensity = round((rs.total / s.areaKm2) * 1000, 1);            // km per 1 000 km²
    s.roadPerCapita = s.population ? round(rs.total / (s.population / 1000), 1) : null;
    s.pavedKm = round(rs.byClass['Улсын чанартай авто зам'] || 0, 1);
    s.pavedShare = pct(s.pavedKm, s.roadKm);
  });

  // --- 5f. composite indices ------------------------------------------------
  const nSchoolA = minMax(soums.map((s) => s.schoolA));
  const nKgA = minMax(soums.map((s) => s.kgA));
  const nHealthA = minMax(soums.map((s) => s.healthAcc));
  const nSchoolD = minMax(soums.map((s) => s.dSchool.mean), true);
  const nKgD = minMax(soums.map((s) => s.dSchool.med), true);
  const nDens = minMax(soums.map((s) => s.roadDensity));

  soums.forEach((s, i) => {
    s.schoolIndex = round(0.35 * s.cover.school25 + 0.25 * s.cover.school50 + 0.25 * nSchoolA[i] + 0.15 * nSchoolD[i], 1);
    s.kgIndex = round(0.35 * s.cover.kg15 + 0.25 * s.cover.kg30 + 0.25 * nKgA[i] + 0.15 * nKgD[i], 1);
    // health facilities sit at the same soum centres, so the distance terms match
    // the school ones — only the supply-per-person term (E2SFCA) differs
    s.healthIndex = round(0.35 * s.cover.school25 + 0.25 * s.cover.school50 + 0.25 * nHealthA[i] + 0.15 * nSchoolD[i], 1);
    s.roadIndex = round(0.40 * s.cover.road5 + 0.20 * s.cover.road10 + 0.25 * nDens[i] + 0.15 * s.cover.nat20, 1);
    s.educationIndex = round(0.55 * s.schoolIndex + 0.45 * s.kgIndex, 1);
    s.socialIndex = round(0.5 * s.educationIndex + 0.5 * s.healthIndex, 1);
    s.overallIndex = round(0.5 * s.socialIndex + 0.5 * s.roadIndex, 1);
    s.grade = GRADES[Math.min(4, Math.floor((100 - s.overallIndex) / 20))];
  });
  const ranked = [...soums].sort((a, b) => b.overallIndex - a.overallIndex);
  ranked.forEach((s, i) => { s.rank = i + 1; });

  // ==========================================================================
  // 6. AIMAG ROLL-UP
  // ==========================================================================
  const allCamps = camps.filter((c) => c.soumIdx >= 0);
  const aimagArea = round(sum(soums.map((s) => s.areaKm2)), 0);
  const roadKmTotal = round(sum(soums.map((s) => s.roadKm)), 1);
  const roadByClass = {};
  for (const s of soums)
    for (const [k, v] of Object.entries(s.roadByClass))
      roadByClass[k] = round((roadByClass[k] || 0) + v, 1);
  const population = sum(soums.map((s) => s.population || 0));

  const aimag = {
    code: AIMAG_CODE,
    name: AIMAG_NAME,
    areaKm2: aimagArea,
    soumCount: soums.length,
    population,
    households: sum(soums.map((s) => s.households || 0)),
    householdYear: soums.length ? soums[0].householdYear : null,
    herderHouseholds: herderHH,
    camps: allCamps.length,
    schools: schoolTotal,
    schoolYear: schoolRow ? schoolRow.latest_year : null,
    kindergartens: kgTotal,
    kindergartenYear: kgRow ? kgRow.latest_year : null,
    healthFacilities: healthTotal,
    healthYear: healthRows[0] ? healthRows[0].latest_year : null,
    roadKm: roadKmTotal,
    roadByClass,
    roadDensity: round((roadKmTotal / aimagArea) * 1000, 1),
    nationalRoadKm: round(sum(natClipped.map((f) => f.properties.lengthKm)), 1),
    populationDensity: round(population / aimagArea, 3),
    cover: {
      school25: pct(allCamps.filter((c) => c.dCentre <= 25).length, allCamps.length),
      school50: pct(allCamps.filter((c) => c.dCentre <= 50).length, allCamps.length),
      kg15: pct(allCamps.filter((c) => c.dCentre <= 15).length, allCamps.length),
      kg30: pct(allCamps.filter((c) => c.dCentre <= 30).length, allCamps.length),
      road5: pct(allCamps.filter((c) => c.dRoad <= 5).length, allCamps.length),
      road10: pct(allCamps.filter((c) => c.dRoad <= 10).length, allCamps.length),
      nat20: pct(allCamps.filter((c) => c.dNat <= 20).length, allCamps.length),
    },
    dist: {
      schoolMean: round(sum(allCamps.map((c) => c.dCentre)) / allCamps.length, 1),
      roadMean: round(sum(allCamps.map((c) => c.dRoad)) / allCamps.length, 2),
      natMean: round(sum(allCamps.map((c) => c.dNat)) / allCamps.length, 1),
      travelMean: round(sum(allCamps.map((c) => c.travelH)) / allCamps.length, 2),
    },
    bands: {
      school: { labels: bandLabels(BANDS.school), count: bandCounts(allCamps, BANDS.school, (c) => c.dCentre).count },
      kindergarten: { labels: bandLabels(BANDS.kindergarten), count: bandCounts(allCamps, BANDS.kindergarten, (c) => c.dCentre).count },
      road: { labels: bandLabels(BANDS.road), count: bandCounts(allCamps, BANDS.road, (c) => c.dRoad).count },
    },
    series: {
      schools: series(schoolRow || {}),
      kindergartens: series(kgRow || {}),
      households: (() => {
        const acc = new Map();
        for (const s of soums)
          for (const p of s.householdSeries)
            if (p.value !== null) acc.set(p.year, (acc.get(p.year) || 0) + p.value);
        return [...acc.entries()].sort((a, b) => a[0] - b[0]).map(([year, value]) => ({ year, value }));
      })(),
    },
    health: healthRows
      .map((r) => ({ name: r.uzuulelt, value: r.last_y || 0, year: r.latest_year, series: series(r, 2015) }))
      .sort((a, b) => b.value - a.value),
    livestock: livestockRows
      .map((r) => ({ group: (r.mal_grup || '').trim(), value: r.last_y || 0, year: r.latest_year, series: series(r, 2012) })),
    national: {
      schools: schoolAll
        .map((r) => ({ code: r.aimag_code_boundary, name: r.aimag_name_boundary, value: r.last_y || 0 }))
        .sort((a, b) => b.value - a.value),
      kindergartens: kgAll
        .map((r) => ({ code: r.aimag_code_boundary, name: r.aimag_name_boundary, value: r.last_y || 0 }))
        .sort((a, b) => b.value - a.value),
      households: (() => {
        const acc = new Map();
        for (const r of hhAll) {
          const k = r.aimag_name_boundary;
          if (!k) continue;
          acc.set(k, (acc.get(k) || 0) + (r.last_y || 0));
        }
        return [...acc.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
      })(),
    },
  };

  // ==========================================================================
  // 7. WRITE
  // ==========================================================================
  log('файл бичиж байна…');
  const write = async (rel, obj) => {
    const text = JSON.stringify(obj);
    await writeFile(join(OUT, rel), text);
    return `${rel} (${(text.length / 1024).toFixed(0)} KB)`;
  };

  const soumOut = soums.map((s) => ({
    idx: s.idx, code: s.code, name: s.name, rank: s.rank, grade: s.grade,
    areaKm2: s.areaKm2, population: s.population == null ? null : s.population,
    households: s.households,
    herderHouseholds: s.herderHouseholds, centreHouseholds: s.centreHouseholds,
    herderPopulation: s.herderPopulation, centrePopulation: s.centrePopulation,
    householdSize: round(s.householdSize, 2),
    camps: s.campCount, schools: s.schools, kindergartens: s.kindergartens,
    healthFacilities: s.healthFacilities,
    centre: s.centre, centroid: s.centroid.map((v) => round(v, 5)),
    popDensity: s.population ? round(s.population / s.areaKm2, 3) : null,
    roadKm: s.roadKm, roadByClass: s.roadByClass, roadDensity: s.roadDensity,
    roadPerCapita: s.roadPerCapita, pavedKm: s.pavedKm, pavedShare: s.pavedShare,
    dSchool: { mean: s.dSchool.mean, median: round(s.dSchool.med, 1), p90: round(s.dSchool.p90, 1) },
    dRoad: { mean: s.dRoadStat.mean, median: round(s.dRoadStat.med, 2), p90: round(s.dRoadStat.p90, 2) },
    dNat: { mean: s.dNatStat.mean, median: round(s.dNatStat.med, 1), p90: round(s.dNatStat.p90, 1) },
    travelH: s.travelH,
    bandsSchool: s.bandsSchool, bandsKg: s.bandsKg, bandsRoad: s.bandsRoad,
    cover: s.cover,
    schoolPer1000: round(s.schoolA, 3), kgPer1000: round(s.kgA, 3),
    healthPer1000: round(s.healthAcc, 3),
    schoolIndex: s.schoolIndex, kgIndex: s.kgIndex, healthIndex: s.healthIndex,
    roadIndex: s.roadIndex, educationIndex: s.educationIndex,
    socialIndex: s.socialIndex, overallIndex: s.overallIndex,
    householdSeries: s.householdSeries,
  }));

  // columnar camp table — compact enough to ship to the browser whole
  const campsOut = {
    n: allCamps.length,
    lon: allCamps.map((c) => round(c.lon, 4)),
    lat: allCamps.map((c) => round(c.lat, 4)),
    soum: allCamps.map((c) => c.soumIdx),
    dRoad: allCamps.map((c) => round(c.dRoad, 2)),
    dNat: allCamps.map((c) => round(c.dNat, 1)),
    dCentre: allCamps.map((c) => round(c.dCentre, 2)),
    travelH: allCamps.map((c) => round(c.travelH, 2)),
    bandSchool: allCamps.map((c) => bandOf(c.dCentre, BANDS.school)),
    bandKg: allCamps.map((c) => bandOf(c.dCentre, BANDS.kindergarten)),
    bandRoad: allCamps.map((c) => bandOf(c.dRoad, BANDS.road)),
  };

  const meta = {
    generatedAt: new Date().toISOString(),
    webmapId: WEBMAP_ID,
    webmapUrl: WEBMAP_URL,
    aimag: AIMAG_NAME,
    projection: proj.name,
    layers: Object.entries(LAYERS).map(([key, l]) => ({ key, ...l })),
    parameters: {
      bands: BANDS,
      catchment: CATCHMENT,
      grades: GRADES,
      herderHouseholdsPerCamp: round(hhPerCamp, 3),
      facilityAllocation:
        'сум бүрт 1 нэгж суурь + үлдэгдлийг хүн амд пропорциональ (largest remainder)',
      demandBasis: 'хүн ам — бууцанд малчин хүн ам, сумын төвд суурин хүн ам',
      healthSupply: 'эмчилгээ үзүүлдэг байгууллага (эмийн сан, эм ханган нийлүүлэх, «бусад»-ыг хассан)',
    },
  };

  const written = [];
  written.push(await write('meta.json', meta));
  written.push(await write('aimag.json', aimag));
  written.push(await write('soums.json', soumOut));
  written.push(await write('camps.json', campsOut));
  written.push(await write('geo/aimag.geojson', {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: AIMAG_NAME },
      geometry: generalise(aimagFeat.geometry, 0.004),
    }],
  }));
  written.push(await write('geo/soums.geojson', {
    type: 'FeatureCollection',
    features: soums.map((s) => ({
      type: 'Feature',
      properties: {
        idx: s.idx, code: s.code, name: s.name,
        overallIndex: s.overallIndex, schoolIndex: s.schoolIndex,
        kgIndex: s.kgIndex, healthIndex: s.healthIndex, roadIndex: s.roadIndex,
        socialIndex: s.socialIndex, educationIndex: s.educationIndex,
        households: s.households, population: s.population == null ? null : s.population,
        camps: s.campCount, roadKm: s.roadKm, roadDensity: s.roadDensity,
        dSchoolMean: s.dSchool.mean, dRoadMean: s.dRoadStat.mean,
        coverRoad5: s.cover.road5, coverSchool25: s.cover.school25, coverKg15: s.cover.kg15,
      },
      geometry: generalise(s.geometry, 0.004),
    })),
  }));
  written.push(await write('geo/roads.geojson', {
    type: 'FeatureCollection',
    features: roadFeats.map((f) => ({
      type: 'Feature',
      properties: {
        roadtype: f.properties.roadtype, soum: f.properties.soum_name,
        soumCode: f.properties.soum_code, lengthKm: round(f.properties.Length_km, 1),
      },
      geometry: generalise(f.geometry, 0.0015),
    })),
  }));
  written.push(await write('geo/national-roads.geojson', {
    type: 'FeatureCollection',
    features: natClipped.map((f) => ({ ...f, geometry: generalise(f.geometry, 0.0015) })),
  }));
  written.push(await write('geo/centres.geojson', {
    type: 'FeatureCollection',
    features: soums.map((s) => ({
      type: 'Feature',
      properties: {
        idx: s.idx, name: s.centre.name, soum: s.name, source: s.centre.source,
        schools: s.schools, kindergartens: s.kindergartens,
        households: s.households, population: s.population == null ? null : s.population,
      },
      geometry: { type: 'Point', coordinates: [round(s.centre.lon, 5), round(s.centre.lat, 5)] },
    })),
  }));

  written.forEach((w) => log('  ✓', w));
  log(`дууслаа — ${((Date.now() - started) / 1000).toFixed(1)} сек`);

  console.log('\n=== ХУРААНГУЙ ===');
  console.log(`Аймаг: ${aimag.name} · ${aimag.soumCount} сум · ${aimag.areaKm2.toLocaleString()} км²`);
  console.log(`Хүн ам ${aimag.population.toLocaleString()} · өрх ${aimag.households.toLocaleString()} · бууц ${aimag.camps.toLocaleString()}`);
  console.log(`Сургууль ${aimag.schools} · цэцэрлэг ${aimag.kindergartens} · эрүүл мэнд ${aimag.healthFacilities} · зам ${aimag.roadKm.toLocaleString()} км`);
  console.log(`Бууцнаас сумын төв хүртэл дундаж ${aimag.dist.schoolMean} км · зам хүртэл ${aimag.dist.roadMean} км`);
  console.log(`Хамралт: сургууль ≤25км ${aimag.cover.school25}% · цэцэрлэг ≤15км ${aimag.cover.kg15}% · зам ≤5км ${aimag.cover.road5}%`);
  console.log('\nЭрэмбэ:');
  ranked.slice(0, 5).forEach((s) => console.log(`  ${s.rank}. ${s.name} — ${s.overallIndex} (${s.grade})`));
  console.log('  …');
  ranked.slice(-3).forEach((s) => console.log(`  ${s.rank}. ${s.name} — ${s.overallIndex} (${s.grade})`));
}

main().catch((e) => { console.error('\n✗', e); process.exit(1); });
