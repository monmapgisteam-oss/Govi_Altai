import type { MetricKey } from './metrics';
import type { Aimag, Soum } from './types';

/**
 * A sub-board: one family of the header metrics, with the charts that explain
 * it. Every family carries the distance/road context too — a soum's roads
 * decide how far its people actually are from any service.
 */
export type Theme = {
  key: string;
  href: string;
  title: string;
  /** what the header picker offers; the first entry is the default */
  metrics: MetricKey[];
  /** the two series drawn on the soum wheels */
  radar: {
    social: { name: string; metric?: MetricKey; pick: (s: Soum) => number };
    road: { name: string; metric?: MetricKey; pick: (s: Soum) => number };
  };
  /** rows of the serial "components" chart */
  profile: [string, (s: Soum) => number][];
  /** which distance-band family the band chart shows, per selected metric */
  bandFamily: (m: MetricKey) => 'school' | 'kindergarten' | 'road';
  /** the composite printed beside the components chart */
  score: (s: Soum) => number;
  /** the theme's own breakdown panel */
  breakdown: {
    title: string;
    subtitle: (a: Aimag, s: Soum | null) => string;
    rows: (a: Aimag, s: Soum | null) => { label: string; value: string; share: number; color: string }[];
  };
  /** the theme's own time series, when the source register carries one */
  trend: {
    title: (s: Soum | null) => string;
    subtitle: string;
    build: (a: Aimag, s: Soum | null) => {
      data: Record<string, number | null>[];
      series: { key: string; name: string; color: string; axis?: 'right' }[];
    };
  } | null;
  /** column group the comparison table opens on */
  tableGroup: 'index' | 'overview' | 'education' | 'roads';
};

export const THEME_ORDER = ['education', 'health', 'roads', 'population'] as const;

/* The board palette, repeated here so this file stays free of client code. */
const SAND = '#e0a33c';
const TEAL = '#46c9b4';
const MUTED = '#8b9aa9';

const pct = (v: number) => `${v.toFixed(1)}%`;
const num = (v: number) => v.toLocaleString('en-US');

export const THEMES: Record<string, Theme> = {
  education: {
    key: 'education',
    href: '/education',
    title: 'Боловсролын байгууллагын хүртээмж',
    metrics: ['schoolIndex', 'kgIndex', 'dSchoolMean'],
    radar: {
      social: { name: 'Сургууль', metric: 'schoolIndex', pick: (s) => s.schoolIndex },
      road: { name: 'Цэцэрлэг', metric: 'kgIndex', pick: (s) => s.kgIndex },
    },
    profile: [
      ['Сургууль', (s) => s.schoolIndex],
      ['Цэцэрлэг', (s) => s.kgIndex],
      ['Боловсрол', (s) => s.educationIndex],
      ['Зам', (s) => s.roadIndex],
    ],
    bandFamily: (m) => (m === 'kgIndex' ? 'kindergarten' : 'school'),
    score: (s) => s.educationIndex,
    breakdown: {
      title: 'Хамрах хүрээний хувь',
      subtitle: (_a, s) => (s ? `${s.name} · өвөлжөө, хаваржааны %` : 'аймгийн дүн · өвөлжөө, хаваржааны %'),
      rows: (a, s) => {
        const c = s ? s.cover : a.cover;
        return [
          { label: 'Сургууль ≤ 25 км', value: pct(c.school25), share: c.school25, color: SAND },
          { label: 'Сургууль ≤ 50 км', value: pct(c.school50), share: c.school50, color: SAND },
          { label: 'Цэцэрлэг ≤ 15 км', value: pct(c.kg15), share: c.kg15, color: TEAL },
          { label: 'Цэцэрлэг ≤ 30 км', value: pct(c.kg30), share: c.kg30, color: TEAL },
          { label: 'Аль нэг зам ≤ 5 км', value: pct(c.road5), share: c.road5, color: MUTED },
        ];
      },
    },
    trend: {
      title: (s) => (s ? `Өрхийн тоо · ${s.name}` : 'Сургууль, цэцэрлэгийн тоо'),
      subtitle: 'улсын статистикийн бүртгэлээр',
      build: (a, s) =>
        s
          ? {
              data: s.householdSeries.map((p) => ({ year: p.year, households: p.value })),
              series: [{ key: 'households', name: 'Өрх', color: TEAL }],
            }
          : {
              data: a.series.schools.map((p, i) => ({
                year: p.year,
                schools: p.value,
                kindergartens: a.series.kindergartens[i]?.value ?? null,
              })),
              series: [
                { key: 'schools', name: 'Сургууль', color: SAND },
                { key: 'kindergartens', name: 'Цэцэрлэг', color: TEAL },
              ],
            },
    },
    tableGroup: 'education',
  },

  health: {
    key: 'health',
    href: '/health',
    title: 'Эрүүл мэндийн байгууллагын хүртээмж',
    metrics: ['healthIndex', 'dSchoolMean'],
    radar: {
      social: { name: 'Эрүүл мэнд', metric: 'healthIndex', pick: (s) => s.healthIndex },
      road: { name: 'Нийгмийн дэд бүтэц', pick: (s) => s.socialIndex },
    },
    profile: [
      ['Эмнэлэг', (s) => s.healthIndex],
      ['Сургууль', (s) => s.schoolIndex],
      ['Цэцэрлэг', (s) => s.kgIndex],
      ['Зам', (s) => s.roadIndex],
    ],
    bandFamily: () => 'school',
    score: (s) => s.healthIndex,
    breakdown: {
      title: 'Эрүүл мэндийн байгууллага, төрлөөр',
      subtitle: (a) => `${a.health[0]?.year ?? ''} он · аймгийн дүн`,
      rows: (a) =>
        a.health
          .filter((h) => h.value > 0)
          .map((h, i) => ({
            label: h.name,
            value: num(h.value),
            share: h.value,
            color: i === 0 ? SAND : i === 1 ? TEAL : MUTED,
          })),
    },
    trend: {
      title: (s) => (s ? `Өрхийн тоо · ${s.name}` : 'Эрүүл мэндийн байгууллагын тоо'),
      subtitle: 'эмчилгээний байгууллага, жилээр',
      build: (a, s) => {
        if (s) {
          return {
            data: s.householdSeries.map((p) => ({ year: p.year, households: p.value })),
            series: [{ key: 'households', name: 'Өрх', color: TEAL }],
          };
        }
        const top = a.health.filter((h) => h.value > 0).slice(0, 3);
        const years = Array.from(new Set(top.flatMap((h) => h.series.map((p) => p.year)))).sort();
        return {
          data: years.map((year) => {
            const row: Record<string, number | null> = { year };
            for (const h of top) row[h.name] = h.series.find((p) => p.year === year)?.value ?? null;
            return row;
          }),
          series: top.map((h, i) => ({ key: h.name, name: h.name, color: [SAND, TEAL, MUTED][i] })),
        };
      },
    },
    tableGroup: 'index',
  },

  roads: {
    key: 'roads',
    href: '/roads',
    title: 'Авто замын хүртээмж',
    metrics: ['roadIndex', 'dRoadMean'],
    radar: {
      social: { name: 'Зам', metric: 'roadIndex', pick: (s) => s.roadIndex },
      road: { name: 'Нэгдсэн', metric: 'overallIndex', pick: (s) => s.overallIndex },
    },
    profile: [
      ['Зам', (s) => s.roadIndex],
      ['Сургууль', (s) => s.schoolIndex],
      ['Цэцэрлэг', (s) => s.kgIndex],
      ['Эмнэлэг', (s) => s.healthIndex],
    ],
    bandFamily: () => 'road',
    score: (s) => s.roadIndex,
    breakdown: {
      title: 'Авто замын ангилал, урт',
      subtitle: (a, s) => (s ? `${s.name} · км` : 'аймгийн дүн · км'),
      rows: (a, s) => {
        const by = s ? s.roadByClass : a.roadByClass;
        const total = s ? s.roadKm : a.roadKm;
        const ramp = [SAND, TEAL, MUTED, '#4d6b7d', '#c2861f', '#7c6ba8', '#3f4a56'];
        return Object.entries(by)
          .filter(([, v]) => v > 0)
          .sort((x, y) => y[1] - x[1])
          .map(([name, v], i) => ({
            label: name,
            value: `${num(Math.round(v))} км · ${pct((v / total) * 100)}`,
            share: v,
            color: ramp[i % ramp.length],
          }));
      },
    },
    trend: null,
    tableGroup: 'roads',
  },

  population: {
    key: 'population',
    href: '/population',
    title: 'Хүн ам, өрх, суурьшлын тархалт',
    metrics: ['population', 'households', 'camps'],
    radar: {
      social: { name: 'Нийгмийн дэд бүтэц', pick: (s) => s.socialIndex },
      road: { name: 'Зам', pick: (s) => s.roadIndex },
    },
    profile: [
      ['Сургууль', (s) => s.schoolIndex],
      ['Цэцэрлэг', (s) => s.kgIndex],
      ['Эмнэлэг', (s) => s.healthIndex],
      ['Зам', (s) => s.roadIndex],
    ],
    bandFamily: () => 'school',
    score: (s) => s.overallIndex,
    breakdown: {
      title: 'Өрхийн суурьшил',
      subtitle: (_a, s) => (s ? `${s.name} · өрхөөр` : 'аймгийн дүн · өрхөөр'),
      rows: (a, s) => {
        // the livestock and household registers disagree per soum, so the
        // pipeline's clamped centre count is used rather than a subtraction
        const herder = s ? s.herderHouseholds : a.herderHouseholds;
        const centre = s ? s.centreHouseholds : a.households - a.herderHouseholds;
        const total = Math.max(1, herder + centre);
        return [
          { label: 'Сумын төвд', value: `${num(centre)} өрх · ${pct((centre / total) * 100)}`, share: centre, color: TEAL },
          { label: 'Малтай, хөдөө', value: `${num(herder)} өрх · ${pct((herder / total) * 100)}`, share: herder, color: SAND },
          { label: 'Өвөлжөө, хаваржаа', value: num(s ? s.camps : a.camps), share: s ? s.camps : a.camps, color: MUTED },
        ];
      },
    },
    trend: {
      title: (s) => (s ? `Өрхийн тооны өөрчлөлт · ${s.name}` : 'Өрхийн тооны өөрчлөлт'),
      subtitle: 'улсын статистикийн бүртгэлээр',
      build: (a, s) => ({
        data: (s ? s.householdSeries : a.series.households).map((p) => ({ year: p.year, households: p.value })),
        series: [{ key: 'households', name: 'Өрх', color: TEAL }],
      }),
    },
    tableGroup: 'overview',
  },
};
