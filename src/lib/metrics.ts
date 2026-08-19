/**
 * The metrics a soum can be shaded by, and the four breaks that split each one
 * into the five suitability classes. Kept free of any ArcGIS import so server
 * components can render a metric picker without pulling in the map SDK.
 */
export type MetricKey =
  | 'overallIndex' | 'socialIndex' | 'schoolIndex' | 'kgIndex' | 'healthIndex' | 'roadIndex'
  | 'coverSchool25' | 'coverKg15' | 'coverRoad5' | 'roadDensity'
  | 'dSchoolMean' | 'dRoadMean' | 'camps' | 'households' | 'population';

export type MetricDef = {
  key: MetricKey;
  label: string;
  /** the four breaks that split the values into the five suitability classes */
  stops: [number, number, number, number];
  /** true when a low value is the good outcome (distances) */
  invert?: boolean;
  digits?: number;
  unit?: string;
  /** kept for lookups and legends, but left out of the picker */
  hidden?: boolean;
};

export const METRICS: MetricDef[] = [
  { key: 'overallIndex', label: 'Нэгдсэн хүртээмжийн индекс', stops: [20, 35, 50, 65], digits: 1 },
  { key: 'socialIndex', label: 'Нийгмийн ДБ-ийн индекс', stops: [20, 35, 50, 65], digits: 1 },
  { key: 'schoolIndex', label: 'Сургуулийн хүртээмжийн индекс', stops: [20, 35, 50, 65], digits: 1 },
  { key: 'kgIndex', label: 'Цэцэрлэгийн хүртээмжийн индекс', stops: [15, 28, 42, 58], digits: 1 },
  { key: 'healthIndex', label: 'Эрүүл мэндийн хүртээмжийн индекс', stops: [25, 40, 55, 70], digits: 1 },
  { key: 'roadIndex', label: 'Замын хүртээмжийн индекс', stops: [25, 40, 55, 70], digits: 1 },
  { key: 'coverSchool25', label: 'Сургуулиас 25 км дотор', stops: [25, 38, 50, 62], digits: 1, unit: '%', hidden: true },
  { key: 'coverKg15', label: 'Цэцэрлэгээс 15 км дотор', stops: [8, 14, 20, 28], digits: 1, unit: '%', hidden: true },
  { key: 'coverRoad5', label: 'Замаас 5 км дотор', stops: [32, 42, 54, 66], digits: 1, unit: '%', hidden: true },
  { key: 'roadDensity', label: 'Замын нягтшил, км/1000 км²', stops: [45, 65, 90, 150], digits: 1, hidden: true },
  { key: 'dSchoolMean', label: 'Сумын төв хүртэлх дундаж зай', stops: [24, 27, 32, 38], invert: true, digits: 1, unit: ' км' },
  { key: 'dRoadMean', label: 'Зам хүртэлх дундаж зай', stops: [4, 6, 8, 10], invert: true, digits: 2, unit: ' км' },
  { key: 'camps', label: 'Өвөлжөө, хаваржааны тоо', stops: [400, 470, 570, 700] },
  { key: 'households', label: 'Өрхийн тоо', stops: [500, 570, 660, 900] },
  { key: 'population', label: 'Хүн ам', stops: [2000, 2250, 2500, 3300] },
];

/* ---------------------------------------------------------------- lookup */

/** Reads a metric off a soum. Kept beside the registry so every panel that
 *  follows the header filter agrees on what a metric key means. */
export function metricValue(s: Record<string, unknown>, key: MetricKey): number {
  const soum = s as any;
  switch (key) {
    case 'coverSchool25': return soum.cover.school25;
    case 'coverKg15': return soum.cover.kg15;
    case 'coverRoad5': return soum.cover.road5;
    case 'dSchoolMean': return soum.dSchool.mean;
    case 'dRoadMean': return soum.dRoad.mean;
    default: return soum[key] as number;
  }
}

export const metricDef = (key: MetricKey) => METRICS.find((m) => m.key === key)!;

/** What the header and in-map pickers offer. */
export const PICKABLE_METRICS = METRICS.filter((m) => !m.hidden);

/** Which distance-band family a metric is about — the band panel follows this. */
export function metricBandFamily(key: MetricKey): 'school' | 'kindergarten' | 'road' {
  if (key === 'kgIndex' || key === 'coverKg15') return 'kindergarten';
  if (key === 'roadIndex' || key === 'coverRoad5' || key === 'roadDensity' || key === 'dRoadMean') return 'road';
  return 'school';
}

/** Which column group of the comparison table a metric belongs to. */
export function metricTableGroup(key: MetricKey): 'index' | 'overview' | 'education' | 'roads' {
  switch (key) {
    case 'camps': case 'households': case 'population': return 'overview';
    case 'coverSchool25': case 'coverKg15': case 'dSchoolMean': return 'education';
    case 'coverRoad5': case 'roadDensity': case 'dRoadMean': return 'roads';
    default: return 'index';
  }
}

/** Which spoke of the index-profile wheel a metric maps to, if any. */
export function metricProfileAxis(key: MetricKey): string | null {
  switch (key) {
    case 'schoolIndex': case 'coverSchool25': case 'dSchoolMean': return 'Сургууль';
    case 'kgIndex': case 'coverKg15': return 'Цэцэрлэг';
    case 'healthIndex': return 'Эмнэлэг';
    case 'roadIndex': case 'coverRoad5': case 'roadDensity': case 'dRoadMean': return 'Зам';
    default: return null;
  }
}
