// ---------------------------------------------------------------------------
// Thin ArcGIS Feature Service REST client.
// All layers come from the public web map
//   https://monmap.maps.arcgis.com/apps/mapviewer/index.html?webmap=e5166cb6feab4301b7dc70de3bca6347
// ---------------------------------------------------------------------------
export const WEBMAP_ID = 'e5166cb6feab4301b7dc70de3bca6347';
export const WEBMAP_URL =
  `https://monmap.maps.arcgis.com/apps/mapviewer/index.html?webmap=${WEBMAP_ID}`;

const AGO = 'https://services.arcgis.com/HJzgwvlNIXssnQar/arcgis/rest/services';
const AP1_STAT = 'https://services-ap1.arcgis.com/MyOgsXxufxJraWYo/arcgis/rest/services';
const AP1_ROAD = 'https://services-ap1.arcgis.com/ACqsMOmNLi5wIdIh/arcgis/rest/services';

/** Every layer the pipeline reads, with its role in the analysis. */
export const LAYERS = {
  camps: {
    title: 'Өвөлжөө, хаваржаа',
    url: `${AGO}/uwuljuu_hawarjaa_SJ/FeatureServer/0`,
    role: 'Эрэлтийн цэг — малчин өрхийн бууц (эрэлтийн жин = 1 өрх)',
  },
  householdSoum: {
    title: 'Өрхийн тоо, сум, жилээр (1212)',
    url: `${AP1_STAT}/household_soum_auto_1780468959/FeatureServer/0`,
    role: 'Сумын хил + өрхийн тооны цуваа (2003-2025)',
  },
  schoolAimag: {
    title: 'Ерөнхий боловсролын сургуулийн тоо',
    url: `${AP1_STAT}/school_count_aimag_auto_1781164643/FeatureServer/0`,
    role: 'Нийлүүлэлт — сургуулийн тоо, аймгийн хил (2000-2025)',
  },
  kindergartenAimag: {
    title: 'Цэцэрлэгийн тоо',
    url: `${AP1_STAT}/kindergarten_count_aimag_auto_1781165117/FeatureServer/0`,
    role: 'Нийлүүлэлт — цэцэрлэгийн тоо (2000-2025)',
  },
  healthAimag: {
    title: 'Эрүүл мэндийн байгууллагын тоо',
    url: `${AP1_STAT}/health_institutions_aimag_auto_1781166410/FeatureServer/0`,
    role: 'Нийгмийн ДБ-ийн хангамж, төрлөөр (2015-2024)',
  },
  livestockAimag: {
    title: 'Малын тооны бүлэглэлт, малтай өрх',
    url: `${AP1_STAT}/livestock_group_aimag_auto_1780476799/FeatureServer/0`,
    role: 'Малчин өрхийн бүлэглэлт (2012-2025)',
  },
  roads: {
    title: 'Road_Identity — сум дундын авто замын сүлжээ',
    url: `${AP1_ROAD}/Road_/FeatureServer/21`,
    role: 'Замын сүлжээ — ангилал, урт (км), сумаар',
  },
  nationalRoads: {
    title: 'Улсын чанартай авто зам (ЗТХЯ)',
    url: `${AGO}/ZTHT_ALL_Data/FeatureServer/9`,
    role: 'Улсын чанартай зам — хучилт, ачаалал, санхүүжилт',
  },
  railway: {
    title: 'Төмөр зам',
    url: `${AGO}/Railway_SJ/FeatureServer/0`,
    role: 'Төмөр замын сүлжээ',
  },
  // same service as the national roads layer of the web map
  centers: {
    title: 'Нийслэл, аймаг, сумын төв',
    url: `${AGO}/ZTHT_ALL_Data/FeatureServer/8`,
    role: 'Нийлүүлэлтийн цэг — сургууль/цэцэрлэг байрлах суурин',
  },
  soumInfo: {
    title: 'Сумын мэдээлэл',
    url: `${AGO}/ZTHT_ALL_Data/FeatureServer/12`,
    role: 'Сумын хүн ам, талбай, нягтшил',
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, params, tries = 4) {
  const qs = new URLSearchParams(params).toString();
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${url}?${qs}`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(`ArcGIS ${json.error.code}: ${json.error.message}`);
      return json;
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(600 * (i + 1));
    }
  }
}

/** Paged query returning GeoJSON features (geometry in EPSG:4326). */
export async function queryGeoJSON(layerUrl, opts = {}) {
  const page = opts.pageSize ?? 1000;
  const out = [];
  let offset = 0;
  for (;;) {
    const json = await get(`${layerUrl}/query`, {
      where: opts.where ?? '1=1',
      outFields: opts.outFields ?? '*',
      returnGeometry: opts.returnGeometry === false ? 'false' : 'true',
      outSR: '4326',
      f: 'geojson',
      orderByFields: opts.orderByFields ?? '',
      resultOffset: String(offset),
      resultRecordCount: String(page),
      ...(opts.geometry ? {
        geometry: JSON.stringify(opts.geometry),
        geometryType: opts.geometryType ?? 'esriGeometryEnvelope',
        inSR: '4326',
        spatialRel: 'esriSpatialRelIntersects',
      } : {}),
    });
    const feats = json.features ?? [];
    out.push(...feats);
    if (feats.length < page) break;
    offset += page;
    if (offset > 400000) break;
  }
  return out;
}

/** Paged query returning attributes + polygon centroid (no full geometry). */
export async function queryCentroids(layerUrl, opts = {}) {
  const page = opts.pageSize ?? 2000;
  const out = [];
  let offset = 0;
  for (;;) {
    const json = await get(`${layerUrl}/query`, {
      where: opts.where ?? '1=1',
      outFields: opts.outFields ?? '*',
      returnGeometry: 'false',
      returnCentroid: 'true',
      outSR: '4326',
      f: 'json',
      orderByFields: opts.orderByFields ?? '',
      resultOffset: String(offset),
      resultRecordCount: String(page),
    });
    const feats = json.features ?? [];
    out.push(...feats);
    if (feats.length < page) break;
    offset += page;
    if (offset > 400000) break;
  }
  return out;
}

/** Attribute-only query (no geometry at all). */
export async function queryAttributes(layerUrl, opts = {}) {
  const json = await get(`${layerUrl}/query`, {
    where: opts.where ?? '1=1',
    outFields: opts.outFields ?? '*',
    returnGeometry: 'false',
    f: 'json',
  });
  return (json.features ?? []).map((f) => f.attributes);
}

export async function layerInfo(layerUrl) {
  return get(layerUrl, { f: 'json' });
}
