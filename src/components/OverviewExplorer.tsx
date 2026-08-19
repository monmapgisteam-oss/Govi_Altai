'use client';

import { useState } from 'react';
import MapPanel from './MapPanel';
import {
  PICKABLE_METRICS,
  metricBandFamily,
  metricDef,
  metricProfileAxis,
  metricTableGroup,
  metricValue,
  type MetricKey,
} from '@/lib/metrics';
import SoumComparisonTable from './SoumComparisonTable';
import { BandBars, ProfileBars, SERIES, SoumRadar, TrendChart } from './charts';
import { BarRow, Board, Fill, GradeChip, KpiStrip, Panel, Screen, TopBar } from './ui';
import { n } from '@/lib/format';
import type { Aimag, Soum } from '@/lib/types';

/** One ramp for the road-class bars, shared with the roads page. */
const ROAD_CLASS_COLORS = ['#e0a33c', '#46c9b4', '#7c8fa3', '#4d6b7d', '#c2861f', '#7c6ba8', '#3f4a56'];

export default function OverviewExplorer({ aimag, soums }: { aimag: Aimag; soums: Soum[] }) {
  // one selection filters the map, every chart, the KPI strip and the table
  const [active, setActive] = useState<number | null>(null);
  const [metric, setMetric] = useState<MetricKey>('overallIndex');
  // the two half-wheels are one chart, so one legend click filters both
  const [radarOnly, setRadarOnly] = useState<string | null>(null);
  const s = active === null ? null : soums.find((x) => x.idx === active) ?? null;

  const avgIndex = soums.reduce((a, x) => a + x.overallIndex, 0) / soums.length;

  // everything below reads the header metric, so one pick moves the whole board
  const def = metricDef(metric);
  const mv = (x: Soum) => metricValue(x, metric);
  const fmt = (v: number) => `${n(v, def.digits ?? 0)}${def.unit ?? ''}`;
  const mLo = Math.min(...soums.map(mv));
  const mHi = Math.max(...soums.map(mv));
  // rescaled so the metric can share the 0–100 wheel; low-is-good metrics flip
  const mScale = (v: number) =>
    mHi === mLo ? 50 : ((def.invert ? mHi - v : v - mLo) / (mHi - mLo)) * 100;
  const mAvg = soums.reduce((a, x) => a + mv(x), 0) / soums.length;
  const byMetric = [...soums].sort((a, b) => (def.invert ? mv(a) - mv(b) : mv(b) - mv(a)));
  const mRank = (x: Soum) => byMetric.findIndex((y) => y.idx === x.idx) + 1;
  // the two index halves already ride the wheel; anything else joins as a third
  const selName = metric === 'socialIndex' || metric === 'roadIndex' ? null : def.label;
  const schoolRank = aimag.national.schools.findIndex((r) => r.code === aimag.code) + 1;

  /* ---------------------------------------------------------------- KPI --- */
  const kpi = s
    ? [
        { label: 'Хүн ам', value: n(s.population), sub: `${n(s.popDensity, 2)} хүн/км²` },
        { label: 'Өрхийн тоо', value: n(s.households), sub: `малтай ${n(s.herderHouseholds)}`, accent: 'teal' as const },
        { label: 'Сургуулийн тоо', value: n(s.schools), sub: `${n(s.schoolPer1000, 2)} / 1000 хүн` },
        { label: 'Цэцэрлэгийн тоо', value: n(s.kindergartens), sub: `${n(s.kgPer1000, 2)} / 1000 хүн`, accent: 'teal' as const },
        { label: 'Авто замын урт', value: n(s.roadKm, 0), unit: 'км', sub: `${n(s.roadDensity, 1)} км/1000км²` },
        { label: 'Эрүүл мэндийн байгууллага', value: n(s.healthFacilities), sub: `${n(s.healthPer1000, 2)} / 1000 хүн` },
        { label: def.label, value: fmt(mv(s)), sub: `эрэмбэ ${mRank(s)}/18`, accent: 'sand' as const },
      ]
    : [
        { label: 'Хүн ам', value: n(aimag.population), sub: `${n(aimag.populationDensity, 3)} хүн/км²` },
        { label: 'Өрхийн тоо', value: n(aimag.households), sub: `малтай ${n(aimag.herderHouseholds)}`, accent: 'teal' as const },
        { label: 'Сургуулийн тоо', value: n(aimag.schools), sub: `улсад ${schoolRank}-р байр` },
        { label: 'Цэцэрлэгийн тоо', value: n(aimag.kindergartens), sub: `${aimag.kindergartenYear} он`, accent: 'teal' as const },
        { label: 'Авто замын урт', value: n(aimag.roadKm, 0), unit: 'км', sub: `${n(aimag.roadDensity, 1)} км/1000км²` },
        { label: 'Эрүүл мэндийн байгууллага', value: n(aimag.healthFacilities), sub: `${aimag.healthYear} он · эмчилгээний` },
        { label: def.label, value: fmt(mAvg), sub: '18 сумын дундаж үзүүлэлт', accent: 'sand' as const },
      ];

  /* ------------------------------------------------------------- charts --- */
  const mean = (pick: (x: Soum) => number) => soums.reduce((a, x) => a + pick(x), 0) / soums.length;

  const profile = (
    [
      ['Сургууль', (x: Soum) => x.schoolIndex],
      ['Цэцэрлэг', (x: Soum) => x.kgIndex],
      ['Эмнэлэг', (x: Soum) => x.healthIndex],
      ['Зам', (x: Soum) => x.roadIndex],
    ] as [string, (x: Soum) => number][]
  ).map(([axis, pick]) => ({ axis, value: s ? pick(s) : mean(pick), aimag: mean(pick) }));

  const roadClasses = Object.entries(s ? s.roadByClass : aimag.roadByClass)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);
  const roadClassMax = roadClasses[0]?.[1] ?? 1;
  const roadClassTotal = s ? s.roadKm : aimag.roadKm;

  const family = metricBandFamily(metric);
  const bandCounts = s
    ? family === 'road' ? s.bandsRoad : family === 'kindergarten' ? s.bandsKg : s.bandsSchool
    : aimag.bands[family].count;
  const bandLabels = aimag.bands[family].labels;
  const bandTitle =
    family === 'road' ? 'Авто зам хүртэлх зайн бүс'
    : family === 'kindergarten' ? 'Цэцэрлэг хүртэлх зайн бүс'
    : 'Үйлчилгээний хүртээмжийн зай';
  const bandCaption =
    family === 'road' ? 'Хамгийн ойрын зам хүртэлх зай, км'
    : family === 'kindergarten' ? 'Цэцэрлэг хүртэлх зай, км'
    : 'Сумын төв хүртэлх зай, км';
  const bandTotal = s ? s.camps : aimag.camps;

  const radar = byMetric.map((x) => ({
    idx: x.idx,
    name: x.name,
    social: x.socialIndex,
    road: x.roadIndex,
    overall: x.overallIndex,
    sel: mScale(mv(x)),
    selRaw: fmt(mv(x)),
  }));

  // unfiltered: aimag facility counts · filtered: that soum's household series
  const healthByYear = new Map<number, number>();
  for (const h of aimag.health)
    for (const p of h.series)
      if (p.value !== null) healthByYear.set(p.year, (healthByYear.get(p.year) ?? 0) + p.value);

  const trendData = s
    ? s.householdSeries.map((p) => ({ year: p.year, households: p.value }))
    : aimag.series.schools.map((p, i) => ({
        year: p.year,
        schools: p.value,
        kindergartens: aimag.series.kindergartens[i]?.value ?? null,
        health: healthByYear.get(p.year) ?? null,
      }));

  const trendSeries = s
    ? [{ key: 'households', name: 'Өрх', color: SERIES.secondary }]
    : [
        { key: 'schools', name: 'Сургууль', color: SERIES.primary },
        { key: 'kindergartens', name: 'Цэцэрлэг', color: SERIES.secondary },
        { key: 'health', name: 'Эмнэлэг', color: SERIES.muted, axis: 'right' as const },
      ];

  return (
    <Screen>
      <TopBar title="Говь-Алтай аймгийн нэгдсэн хяналтын самбар">
        <div className="flex shrink-0 items-center gap-2">
          {s && <GradeChip score={s.overallIndex} />}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
            title="Газрын зургийн үзүүлэлт"
            className="max-w-[260px] cursor-pointer truncate rounded-lg border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[11.5px] text-ink-100 outline-none transition hover:border-sand-500/50 focus:border-sand-500"
          >
            {PICKABLE_METRICS.map((m) => (
              <option key={m.key} value={m.key} className="bg-ink-900">
                {m.label}
              </option>
            ))}
          </select>
          <select
            value={active ?? ''}
            onChange={(e) => setActive(e.target.value === '' ? null : Number(e.target.value))}
            className="cursor-pointer rounded-lg border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[11.5px] text-ink-100 outline-none transition hover:border-sand-500/50 focus:border-sand-500"
          >
            <option value="" className="bg-ink-900">
              Бүх сум · аймаг
            </option>
            {[...soums]
              .sort((a, b) => a.name.localeCompare(b.name, 'mn'))
              .map((x) => (
                <option key={x.code} value={x.idx} className="bg-ink-900">
                  {x.name}
                </option>
              ))}
          </select>
        </div>
      </TopBar>

      <KpiStrip items={kpi} />

      <Board template="1.2fr 1.2fr 0.8fr 0.8fr">
        {/* --- left of the map: the ranking wheel, halved. 18 spokes on one
               wheel crowd each other, so ranks 1–9 and 10–18 get one apiece --- */}
        <div className="flex min-h-0 min-w-0 flex-col gap-2.5 lg:col-span-3 lg:row-span-4">
          <Panel
            className="min-h-0 flex-1"
            title="Сумдын хүртээмжийн индекс · I хэсэг"
          >
            <Fill>
              <SoumRadar
                data={radar.slice(0, 9)}
                active={active}
                onSelect={setActive}
                selName={selName}
                only={radarOnly}
                onOnly={setRadarOnly}
              />
            </Fill>
          </Panel>

          <Panel className="min-h-0 flex-1" title="Сумдын хүртээмжийн индекс · II хэсэг">
            <Fill>
              <SoumRadar
                data={radar.slice(9)}
                active={active}
                onSelect={setActive}
                selName={selName}
                only={radarOnly}
                onOnly={setRadarOnly}
              />
            </Fill>
          </Panel>
        </div>

        {/* ---------------- map ---------------- */}
        <Panel
          className="lg:col-span-5 lg:row-span-4"
          title={s ? `Хүртээмжийн индексийн орон зайн тархалт · ${s.name}` : 'Хүртээмжийн индексийн орон зайн тархалт'}
          bodyClass="px-2 pb-2"
        >
          <MapPanel
            metric={metric}
            onMetricChange={setMetric}
            height="100%"
            campColoring="bandRoad"
            focusSelection
            onSelectSoum={setActive}
            selectedSoum={active}
          />
        </Panel>

        {/* ---------------- distance bands ---------------- */}
        <Panel
          className="lg:col-span-2"
          title={bandTitle}
          subtitle={`${bandCaption} · ${n(bandTotal)} бууц`}
        >
          <Fill>
            <BandBars labels={bandLabels} counts={bandCounts} total={bandTotal} />
          </Fill>
        </Panel>

        {/* ---------------- index profile ---------------- */}
        <Panel
          className="lg:col-span-2"
          title="Хүртээмжийн индексийн бүрэлдэхүүн"
          subtitle={s ? `${s.name} ↔ аймгийн дундаж · 0–100` : 'аймгийн дундаж · 0–100'}
        >
          <Fill>
            <ProfileBars
              data={profile}
              score={s ? s.overallIndex : avgIndex}
              highlight={metricProfileAxis(metric)}
              showCompare={!!s}
              name={s ? s.name : 'Аймаг'}
            />
          </Fill>
        </Panel>

        {/* ------------- road classes, left of the trend ------------- */}
        <Panel
          className="lg:col-span-2"
          title="Авто замын ангилал, урт"
          subtitle={s ? `${s.name} · км` : 'аймгийн дүн · км'}
          scroll
        >
          <div className="space-y-1">
            {roadClasses.map(([name, v], i) => (
              <BarRow
                key={name}
                label={name}
                value={`${n(v, 0)} км · ${((v / roadClassTotal) * 100).toFixed(1)}%`}
                share={(v / roadClassMax) * 100}
                color={ROAD_CLASS_COLORS[i % ROAD_CLASS_COLORS.length]}
              />
            ))}
          </div>
        </Panel>

        {/* ---------------- trend ---------------- */}
        <Panel
          className="lg:col-span-2"
          title={s ? 'Өрхийн тоо, жилээр' : 'Нийгмийн үйлчилгээний байгууллагын тооны өөрчлөлт'}
          subtitle={s ? `${s.name} · 2003–2025` : 'сургууль, цэцэрлэг 2000–2025 · эрүүл мэнд 2015–2024'}
        >
          <Fill>
            <TrendChart data={trendData} series={trendSeries} />
          </Fill>
        </Panel>

        {/* ---------------- soum comparison table ---------------- */}
        <SoumComparisonTable
          soums={soums}
          className="lg:col-span-4 lg:row-span-2"
          onRowClick={(x) => setActive(x.idx === active ? null : x.idx)}
          activeIdx={active}
          followGroup={metricTableGroup(metric)}
        />
      </Board>
    </Screen>
  );
}
