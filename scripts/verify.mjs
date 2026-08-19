/**
 * Independent audit of public/data against the ArcGIS source.
 *
 * Deliberately does NOT reuse the pipeline's aggregation code: wherever the
 * service supports it, the numbers are recomputed **server-side** by ArcGIS
 * (returnCountOnly / outStatistics) so a bug in build-data.mjs cannot hide.
 * Geometry-derived values are re-checked with exact spherical maths instead of
 * the pipeline's projected plane.
 *
 *   node scripts/verify.mjs
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LAYERS, queryAttributes, queryGeoJSON, queryCentroids } from './lib/arcgis.mjs';
import { haversineKm, polygonAreaKm2, lineLengthKm, polygonContains } from './lib/geo.mjs';

const AIMAG = '82';
const DATA = join(process.cwd(), 'public', 'data');
const read = async (f) => JSON.parse(await readFile(join(DATA, f), 'utf8'));

let pass = 0;
let warn = 0;
let fail = 0;

const fmt = (v) => (typeof v === 'number' ? Number(v.toFixed(4)).toLocaleString('en-US') : String(v));

/** exact equality (or within `tol` relative) */
function check(label, actual, expected, tol = 0, note = '') {
  const a = Number(actual);
  const e = Number(expected);
  const diff = Math.abs(a - e);
  const rel = e === 0 ? diff : diff / Math.abs(e);
  const ok = Number.isFinite(a) && Number.isFinite(e) && rel <= tol;
  const soft = !ok && rel <= Math.max(tol * 10, 0.01);
  const mark = ok ? '✓' : soft ? '~' : '✗';
  if (ok) pass++;
  else if (soft) warn++;
  else fail++;
  console.log(
    `  ${mark} ${label.padEnd(46)} апп=${String(fmt(a)).padStart(12)}  эх=${String(fmt(e)).padStart(12)}` +
      (ok ? '' : `  Δ=${fmt(diff)} (${(rel * 100).toFixed(2)}%)`) +
      (note ? `  ${note}` : ''),
  );
}

/** boolean assertion, for things that are not numeric comparisons */
function assert(label, ok, detail = '') {
  if (ok) pass++;
  else fail++;
  console.log(`  ${ok ? '✓' : '✗'} ${label.padEnd(46)} ${ok ? 'тийм' : `ҮГҮЙ  ${detail}`}`);
}

function info(label, value, note = '') {
  console.log(`    · ${label.padEnd(46)} ${String(fmt(value)).padStart(12)}  ${note}`);
}

function section(t) {
  console.log(`\n${t}\n${'─'.repeat(t.length)}`);
}

/** ArcGIS server-side statistic */
async function stat(url, where, statType, field) {
  const qs = new URLSearchParams({
    where,
    outStatistics: JSON.stringify([
      { statisticType: statType, onStatisticField: field, outStatisticFieldName: 'v' },
    ]),
    returnGeometry: 'false',
    f: 'json',
  });
  const r = await fetch(`${url}/query?${qs}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.features?.[0]?.attributes?.v ?? null;
}

async function count(url, where) {
  const r = await fetch(`${url}/query?${new URLSearchParams({ where, returnCountOnly: 'true', f: 'json' })}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.count;
}

async function main() {
  const [aimag, soums, meta, camps] = await Promise.all([
    read('aimag.json'), read('soums.json'), read('meta.json'), read('camps.json'),
  ]);

  // =========================================================================
  section('1 · ТҮҮХИЙ ТОО — ArcGIS сервер өөрөө бодсон утгатай тулгав');
  // =========================================================================

  // --- camps -------------------------------------------------------------
  const campCount = await count(LAYERS.camps.url, `aimag_code=${AIMAG}`);
  check('Өвөлжөө, хаваржааны тоо', aimag.camps, campCount);
  check('camps.json мөрийн тоо', camps.n, campCount);

  // --- households --------------------------------------------------------
  const hhSum = await stat(LAYERS.householdSoum.url, `aimag_code_boundary='${AIMAG}'`, 'sum', 'last_y');
  const soumCount = await count(LAYERS.householdSoum.url, `aimag_code_boundary='${AIMAG}'`);
  check('Өрхийн тоо (2025)', aimag.households, hhSum);
  check('Сумын тоо', aimag.soumCount, soumCount);
  check('soums.json мөрийн тоо', soums.length, soumCount);

  // --- schools / kindergartens ------------------------------------------
  const [schoolRow] = await queryAttributes(LAYERS.schoolAimag.url, { where: `aimag_code_boundary='${AIMAG}'` });
  const [kgRow] = await queryAttributes(LAYERS.kindergartenAimag.url, { where: `aimag_code_boundary='${AIMAG}'` });
  check('Сургуулийн тоо (last_y)', aimag.schools, schoolRow.last_y);
  check('Цэцэрлэгийн тоо (last_y)', aimag.kindergartens, kgRow.last_y);
  check('Сургуулийн мэдээний жил', aimag.schoolYear, schoolRow.latest_year);
  check('Цэцэрлэгийн мэдээний жил', aimag.kindergartenYear, kgRow.latest_year);

  // full time series, value by value
  let seriesBad = 0;
  for (const p of aimag.series.schools) if (p.value !== (schoolRow[`y${p.year}`] ?? null)) seriesBad++;
  for (const p of aimag.series.kindergartens) if (p.value !== (kgRow[`y${p.year}`] ?? null)) seriesBad++;
  check('Сургууль/цэцэрлэгийн цувааны зөрүү', seriesBad, 0);
  info('цувааны цэгийн тоо', aimag.series.schools.length + aimag.series.kindergartens.length);

  // --- livestock ---------------------------------------------------------
  const lsSum = await stat(LAYERS.livestockAimag.url, `aimag_code_boundary='${AIMAG}'`, 'sum', 'last_y');
  check('Малтай өрхийн нийлбэр', aimag.herderHouseholds, lsSum);
  check('Малын бүлгийн тоо', aimag.livestock.length, await count(LAYERS.livestockAimag.url, `aimag_code_boundary='${AIMAG}'`));
  check('Малын бүлгийн нийлбэр (аппад)', aimag.livestock.reduce((a, b) => a + b.value, 0), lsSum);

  // --- health ------------------------------------------------------------
  const healthRows = await queryAttributes(LAYERS.healthAimag.url, { where: `aimag_code_boundary='${AIMAG}'` });
  const healthSrc = new Map(healthRows.map((r) => [r.uzuulelt, r.last_y || 0]));
  let healthBad = 0;
  for (const h of aimag.health) if (healthSrc.get(h.name) !== h.value) healthBad++;
  check('Эрүүл мэндийн үзүүлэлтийн зөрүү', healthBad, 0);
  check('Эрүүл мэндийн мөрийн тоо', aimag.health.length, healthRows.length);

  // --- roads -------------------------------------------------------------
  const roadKmSrc = await stat(LAYERS.roads.url, `aimag_code=${AIMAG}`, 'sum', 'Length_km');
  check('Замын нийт урт (Length_km талбар)', aimag.roadKm, roadKmSrc, 0.0005);
  const roadFeatCount = await count(LAYERS.roads.url, `aimag_code=${AIMAG}`);
  info('замын feature-ийн тоо', roadFeatCount, '(сум × ангиллаар нэгтгэсэн)');

  // per-class sums, straight from the server
  const clsQs = new URLSearchParams({
    where: `aimag_code=${AIMAG}`,
    groupByFieldsForStatistics: 'roadtype',
    outStatistics: JSON.stringify([{ statisticType: 'sum', onStatisticField: 'Length_km', outStatisticFieldName: 'km' }]),
    f: 'json',
  });
  const clsJson = await (await fetch(`${LAYERS.roads.url}/query?${clsQs}`)).json();
  let clsBad = 0;
  for (const f of clsJson.features) {
    const app = aimag.roadByClass[f.attributes.roadtype];
    if (app === undefined || Math.abs(app - f.attributes.km) > 0.15) clsBad++;
  }
  check('Замын ангиллын нийлбэрийн зөрүү', clsBad, 0);

  // --- population --------------------------------------------------------
  const popApp = soums.reduce((a, s) => a + (s.population || 0), 0);
  check('Хүн амын нийлбэр (аймаг = сумуудын нийлбэр)', aimag.population, popApp);

  // =========================================================================
  section('2 · СУМЫН ТҮВШИН — сум бүрийн өрх, хүн ам, зам');
  // =========================================================================

  const hhRows = await queryAttributes(LAYERS.householdSoum.url, {
    where: `aimag_code_boundary='${AIMAG}'`,
    outFields: 'soum_code_boundary,soum_name_boundary,last_y,latest_year',
  });
  const hhByCode = new Map(hhRows.map((r) => [r.soum_code_boundary, r]));
  let hhBad = 0;
  let nameBad = 0;
  for (const s of soums) {
    const src = hhByCode.get(s.code);
    if (!src) { hhBad++; continue; }
    if (src.last_y !== s.households) hhBad++;
    if (src.soum_name_boundary !== s.name) nameBad++;
  }
  check('Сумын өрхийн тооны зөрүү', hhBad, 0);
  check('Сумын нэрний зөрүү', nameBad, 0);

  // ZTHT population: verify the name of the record actually matched
  const zt = await queryCentroids(LAYERS.soumInfo.url, { outFields: 'name,hvn_am_too', orderByFields: 'FID' });
  // authoritative test: the ЗТХЯ record whose centroid falls inside the soum
  // must be the one whose population the app used (spelling differs between the
  // two registries — "Дарив" vs "Дарви" — so a name match alone proves nothing)
  const soumGeom = new Map(
    (await queryGeoJSON(LAYERS.householdSoum.url, {
      where: `aimag_code_boundary='${AIMAG}'`,
      outFields: 'soum_code_boundary',
    })).map((f) => [f.properties.soum_code_boundary, f.geometry]),
  );
  const norm = (x) => (x || '').toLowerCase().replace(/[\s\-–_]/g, '').replace(/ё/g, 'е');
  let popMismatch = 0;
  const popNotes = [];
  for (const s of soums) {
    const geom = soumGeom.get(s.code);
    const inside = zt.filter((r) => r.centroid && polygonContains(geom, [r.centroid.x, r.centroid.y]));
    const byName = zt.filter((r) => norm(r.attributes.name) === norm(s.name));
    const ok =
      inside.some((r) => r.attributes.hvn_am_too === s.population) ||
      byName.some((r) => r.attributes.hvn_am_too === s.population);
    if (!ok) {
      popMismatch++;
      popNotes.push(`${s.name}: апп=${s.population}, хилийн дотор=${inside.map((r) => `${r.attributes.name}:${r.attributes.hvn_am_too}`).join('/') || '—'}`);
    } else if (inside[0] && norm(inside[0].attributes.name) !== norm(s.name)) {
      popNotes.push(`${s.name} ← ЗТХЯ-д "${inside[0].attributes.name}" (бичлэгийн зөрүү, орон зайгаар зөв тохирсон)`);
    }
  }
  check('Хүн амын эх сурвалж тохирох алдаа', popMismatch, 0);
  popNotes.forEach((x) => console.log(`      · ${x}`));

  // road km per soum, from the server, grouped
  const soumQs = new URLSearchParams({
    where: `aimag_code=${AIMAG}`,
    groupByFieldsForStatistics: 'soum_code',
    outStatistics: JSON.stringify([{ statisticType: 'sum', onStatisticField: 'Length_km', outStatisticFieldName: 'km' }]),
    f: 'json',
  });
  const soumRoad = await (await fetch(`${LAYERS.roads.url}/query?${soumQs}`)).json();
  const roadByCode = new Map(soumRoad.features.map((f) => [String(f.attributes.soum_code), f.attributes.km]));
  let roadBad = 0;
  for (const s of soums) {
    const src = roadByCode.get(s.code);
    if (src === undefined || Math.abs(src - s.roadKm) > 0.1) roadBad++;
  }
  check('Сумын замын уртын зөрүү', roadBad, 0);

  // =========================================================================
  section('3 · ГЕОМЕТРЭЭС БОДСОН — бие даан дахин тооцов');
  // =========================================================================

  // area, straight from the boundary geometry
  const soumFeats = await queryGeoJSON(LAYERS.householdSoum.url, {
    where: `aimag_code_boundary='${AIMAG}'`,
    outFields: 'soum_code_boundary',
    orderByFields: 'soum_code_boundary',
  });
  let areaSum = 0;
  let areaBad = 0;
  for (const f of soumFeats) {
    const a = polygonAreaKm2(f.geometry);
    areaSum += a;
    const s = soums.find((x) => x.code === f.properties.soum_code_boundary);
    if (!s || Math.abs(a - s.areaKm2) > 1) areaBad++;
  }
  check('Сумын талбайн зөрүү (>1 км²)', areaBad, 0);
  check('Аймгийн нийт талбай, км²', aimag.areaKm2, areaSum, 0.001);
  info('албан ёсны талбай, км²', 141447, '(ҮСХ) — зөрүү нь хилийн ерөнхийчлөлөөс');

  // road length from geometry vs the Length_km attribute
  const roadFeats = await queryGeoJSON(LAYERS.roads.url, { where: `aimag_code=${AIMAG}` });
  let geomKm = 0;
  let attrKm = 0;
  for (const f of roadFeats) {
    geomKm += lineLengthKm(f.geometry);
    attrKm += f.properties.Length_km || 0;
  }
  check('Замын урт: геометр vs Length_km', geomKm, attrKm, 0.02, '(эх өгөгдлийн дотоод нийцэл)');

  // =========================================================================
  section('4 · ЗАЙН ТООЦООЛОЛ — проекцийн алдааг шалгав');
  // =========================================================================

  // recompute camp -> nearest centre with exact haversine on a large sample
  const centres = (await read('geo/centres.geojson')).features.map((f) => f.geometry.coordinates);
  const step = 7; // ~1 400 camps
  let maxErr = 0;
  let sumErr = 0;
  let nSample = 0;
  for (let i = 0; i < camps.n; i += step) {
    const p = [camps.lon[i], camps.lat[i]];
    let best = Infinity;
    for (const c of centres) {
      const d = haversineKm(p, c);
      if (d < best) best = d;
    }
    const err = Math.abs(best - camps.dCentre[i]);
    sumErr += err;
    if (err > maxErr) maxErr = err;
    nSample++;
  }
  info('шалгасан бууцны тоо', nSample, '(7 тутмын нэг)');
  info('дундаж зөрүү, км', sumErr / nSample, '(бөөрөнхийлөлт 0.005 км хүртэл)');
  assert('Хамгийн их зөрүү < 0.02 км', maxErr < 0.02, `max=${maxErr.toFixed(4)} км`);

  // coverage percentages recomputed from the shipped camp table
  const pct = (n) => Math.round((n / camps.n) * 1000) / 10;
  check('Хамралт: сумын төв ≤25 км, %', aimag.cover.school25, pct(camps.dCentre.filter((d) => d <= 25).length), 0.002);
  check('Хамралт: сумын төв ≤15 км, %', aimag.cover.kg15, pct(camps.dCentre.filter((d) => d <= 15).length), 0.002);
  check('Хамралт: зам ≤5 км, %', aimag.cover.road5, pct(camps.dRoad.filter((d) => d <= 5).length), 0.002);
  check('Хамралт: зам ≤10 км, %', aimag.cover.road10, pct(camps.dRoad.filter((d) => d <= 10).length), 0.002);
  check('Хамралт: улсын зам ≤20 км, %', aimag.cover.nat20, pct(camps.dNat.filter((d) => d <= 20).length), 0.002);

  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  check('Дундаж зай: сумын төв, км', aimag.dist.schoolMean, mean(camps.dCentre), 0.002);
  check('Дундаж зай: зам, км', aimag.dist.roadMean, mean(camps.dRoad), 0.005);

  // =========================================================================
  section('5 · ДОТООД НИЙЦЭЛ — чартын өгөгдөл нийлбэртэйгээ таарч байна уу');
  // =========================================================================

  const sumArr = (a) => a.reduce((x, y) => x + y, 0);
  check('Зайн бүс (сургууль) нийлбэр = бууц', sumArr(aimag.bands.school.count), aimag.camps);
  check('Зайн бүс (цэцэрлэг) нийлбэр = бууц', sumArr(aimag.bands.kindergarten.count), aimag.camps);
  check('Зайн бүс (зам) нийлбэр = бууц', sumArr(aimag.bands.road.count), aimag.camps);
  check('Сумын бууцны нийлбэр = аймгийн бууц', sumArr(soums.map((s) => s.camps)), aimag.camps);
  check('Сумын замын нийлбэр = аймгийн зам', sumArr(soums.map((s) => s.roadKm)), aimag.roadKm, 0.0001);
  check('Хуваарилсан сургууль = аймгийн нийт', sumArr(soums.map((s) => s.schools)), aimag.schools);
  check('Хуваарилсан цэцэрлэг = аймгийн нийт', sumArr(soums.map((s) => s.kindergartens)), aimag.kindergartens);
  check('Хуваарилсан эмнэлэг = аймгийн нийт', sumArr(soums.map((s) => s.healthFacilities)), aimag.healthFacilities);
  check('Малтай өрхийн хуваарилалт ≈ эх утга', sumArr(soums.map((s) => s.herderHouseholds)), aimag.herderHouseholds, 0.001);
  check('Сумын өрхийн нийлбэр = аймгийн өрх', sumArr(soums.map((s) => s.households)), aimag.households);

  let bandBad = 0;
  for (const s of soums) {
    if (sumArr(s.bandsSchool) !== s.camps) bandBad++;
    if (sumArr(s.bandsKg) !== s.camps) bandBad++;
    if (sumArr(s.bandsRoad) !== s.camps) bandBad++;
  }
  check('Сумын зайн бүс нийлбэрийн зөрүү', bandBad, 0);

  // index ranges
  const outOfRange = soums.filter(
    (s) => [s.schoolIndex, s.kgIndex, s.healthIndex, s.roadIndex, s.educationIndex, s.socialIndex, s.overallIndex].some((v) => v < 0 || v > 100),
  ).length;
  check('0–100 хязгаараас гарсан индекс', outOfRange, 0);

  // the pipeline rounds each index to 1 dp before feeding the next level, so
  // the audit must reproduce that same chain rather than the unrounded one
  const r1 = (v) => Math.round(v * 10) / 10;
  let formulaBad = 0;
  for (const s of soums) {
    if (Math.abs(r1(0.55 * s.schoolIndex + 0.45 * s.kgIndex) - s.educationIndex) > 1e-9) formulaBad++;
    if (Math.abs(r1(0.5 * s.educationIndex + 0.5 * s.healthIndex) - s.socialIndex) > 1e-9) formulaBad++;
    if (Math.abs(r1(0.5 * s.socialIndex + 0.5 * s.roadIndex) - s.overallIndex) > 1e-9) formulaBad++;
  }
  check('Индексийн томьёоны зөрүү', formulaBad, 0);

  const ranks = soums.map((s) => s.rank).sort((a, b) => a - b).join(',');
  const expectRanks = Array.from({ length: soums.length }, (_, i) => i + 1).join(',');
  assert('Эрэмбэ 1..18 давхцалгүй', ranks === expectRanks, ranks);

  const byIndex = [...soums].sort((a, b) => b.overallIndex - a.overallIndex);
  assert(
    'Эрэмбэ индексийн дарааллыг дагаж байна',
    byIndex.every((s, i) => s.rank === i + 1),
    byIndex.slice(0, 3).map((s) => `${s.name}#${s.rank}`).join(' '),
  );

  // =========================================================================
  section('6 · ХОЁР ЭХ СУРВАЛЖИЙН ЗӨРҮҮ (мэдээлэлд зориулав)');
  // =========================================================================
  info('Улсын зам, Road_ давхаргаас, км', aimag.roadByClass['Улсын чанартай авто зам']);
  info('Улсын зам, ЗТХЯ давхаргаас, км', aimag.nationalRoadKm, '← өөр эх сурвалж, аймгийн хилээр тайрсан');
  info('Хүн ам, ЗТХЯ "Сумын мэдээлэл"', aimag.population, '← давхаргын огноо тодорхойгүй');
  info('Өрх, ҮСХ 1212 сан', aimag.households, `← ${aimag.householdYear} он`);

  // =========================================================================
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`ДҮГНЭЛТ:  ✓ ${pass} тэнцсэн   ~ ${warn} бага зөрүү   ✗ ${fail} унасан`);
  console.log('═'.repeat(72));
  if (fail) process.exitCode = 1;
}

main().catch((e) => { console.error('\n✗ Аудит амжилтгүй:', e); process.exit(1); });
