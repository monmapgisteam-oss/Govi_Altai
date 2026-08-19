'use client';

import { useState } from 'react';
import MapPanel from './MapPanel';
import SoumComparisonTable from './SoumComparisonTable';
import { BandBars, ProfileBars, SERIES, SoumRadar, TrendChart } from './charts';
import { BarRow, Board, Fill, GradeChip, KpiStrip, Panel, Screen, TopBar } from './ui';
import { metricDef, metricValue, type MetricKey } from '@/lib/metrics';
import { n } from '@/lib/format';
import { THEMES } from '@/lib/themes';
import type { Aimag, Soum } from '@/lib/types';

/**
 * One metric family, laid out exactly like the overview board so a reader
 * moving between them keeps their bearings: wheels left, map centre, the
 * family's own charts right.
 */
export default function ThemeExplorer({
  aimag,
  soums,
  themeKey,
}: {
  aimag: Aimag;
  soums: Soum[];
  themeKey: string;
}) {
  const theme = THEMES[themeKey];
  const [active, setActive] = useState<number | null>(null);
  const [metric, setMetric] = useState<MetricKey>(theme.metrics[0]);
  const [radarOnly, setRadarOnly] = useState<string | null>(null);
  const s = active === null ? null : soums.find((x) => x.idx === active) ?? null;

  /* ------------------------------------------------- the selected metric --- */
  const def = metricDef(metric);
  const mv = (x: Soum) => metricValue(x, metric);
  const fmt = (v: number) => `${n(v, def.digits ?? 0)}${def.unit ?? ''}`;
  const mLo = Math.min(...soums.map(mv));
  const mHi = Math.max(...soums.map(mv));
  const mScale = (v: number) =>
    mHi === mLo ? 50 : ((def.invert ? mHi - v : v - mLo) / (mHi - mLo)) * 100;
  const mAvg = soums.reduce((a, x) => a + mv(x), 0) / soums.length;
  const byMetric = [...soums].sort((a, b) => (def.invert ? mv(a) - mv(b) : mv(b) - mv(a)));
  const mRank = (x: Soum) => byMetric.findIndex((y) => y.idx === x.idx) + 1;

  /* ------------------------------------------------------------- panels --- */
  const mean = (pick: (x: Soum) => number) => soums.reduce((a, x) => a + pick(x), 0) / soums.length;

  const radar = byMetric.map((x) => ({
    idx: x.idx,
    name: x.name,
    social: theme.radar.social.pick(x),
    road: theme.radar.road.pick(x),
    overall: x.overallIndex,
    sel: mScale(mv(x)),
    selRaw: fmt(mv(x)),
  }));
  // the wheel already carries these two, so the metric only joins when it differs
  const selName =
    theme.radar.social.metric === metric || theme.radar.road.metric === metric ? null : def.label;

  const profile = theme.profile.map(([axis, pick]) => ({
    axis,
    value: s ? pick(s) : mean(pick),
    aimag: mean(pick),
  }));

  const family = theme.bandFamily(metric);
  const bandCounts = s
    ? family === 'road' ? s.bandsRoad : family === 'kindergarten' ? s.bandsKg : s.bandsSchool
    : aimag.bands[family].count;
  const bandCaption =
    family === 'road' ? 'Хамгийн ойрын зам хүртэлх зай, км'
    : family === 'kindergarten' ? 'Цэцэрлэг хүртэлх зай, км'
    : 'Сумын төв хүртэлх зай, км';

  const breakdownRows = theme.breakdown.rows(aimag, s);
  const breakdownMax = Math.max(...breakdownRows.map((r) => r.share), 1);
  const trend = theme.trend?.build(aimag, s);

  /* ---------------------------------------------------------------- KPI --- */
  const kpi = s
    ? [
        { label: 'Хүн ам', value: n(s.population), sub: `${n(s.popDensity, 2)} хүн/км²` },
        { label: 'Өрхийн тоо', value: n(s.households), sub: `малтай ${n(s.herderHouseholds)}`, accent: 'teal' as const },
        { label: 'Өвөлжөө, хаваржаа', value: n(s.camps), sub: `${n(s.dSchool.mean, 1)} км дундаж` },
        { label: 'Авто замын урт', value: n(s.roadKm, 0), unit: 'км', sub: `${n(s.roadDensity, 1)} км/1000км²` },
        { label: 'Нэгдсэн индекс', value: n(s.overallIndex, 1), sub: `эрэмбэ ${s.rank}/18` },
        { label: def.label, value: fmt(mv(s)), sub: `эрэмбэ ${mRank(s)}/18`, accent: 'sand' as const },
      ]
    : [
        { label: 'Хүн ам', value: n(aimag.population), sub: `${n(aimag.populationDensity, 3)} хүн/км²` },
        { label: 'Өрхийн тоо', value: n(aimag.households), sub: `малтай ${n(aimag.herderHouseholds)}`, accent: 'teal' as const },
        { label: 'Өвөлжөө, хаваржаа', value: n(aimag.camps), sub: `${n(aimag.dist.schoolMean, 1)} км дундаж` },
        { label: 'Авто замын урт', value: n(aimag.roadKm, 0), unit: 'км', sub: `${n(aimag.roadDensity, 1)} км/1000км²` },
        { label: 'Нэгдсэн индекс', value: n(mean((x) => x.overallIndex), 1), sub: '18 сумын дундаж' },
        { label: def.label, value: fmt(mAvg), sub: '18 сумын дундаж үзүүлэлт', accent: 'sand' as const },
      ];

  return (
    <Screen>
      <TopBar title={theme.title}>
        <div className="flex shrink-0 items-center gap-2">
          {s && <GradeChip score={theme.score(s)} />}
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as MetricKey)}
            title="Газрын зургийн үзүүлэлт"
            className="max-w-[260px] cursor-pointer truncate rounded-lg border border-ink-700 bg-ink-900/80 px-2.5 py-1.5 text-[11.5px] text-ink-100 outline-none transition hover:border-sand-500/50 focus:border-sand-500"
          >
            {theme.metrics.map((k) => (
              <option key={k} value={k} className="bg-ink-900">
                {metricDef(k).label}
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

      <Board template="0.8fr 1.2fr 1.2fr 0.8fr">
        {/* --- left of the map: the ranking wheels, split in two --- */}
        <Panel className="lg:col-span-3 lg:row-span-2" title={`${def.label} · I хэсэг`}>
          <Fill>
            <SoumRadar
              data={radar.slice(0, 9)}
              active={active}
              onSelect={setActive}
              selName={selName}
              names={{ social: theme.radar.social.name, road: theme.radar.road.name }}
              only={radarOnly}
              onOnly={setRadarOnly}
            />
          </Fill>
        </Panel>

        {/* --- above the map --- */}
        <Panel
          className="lg:col-span-6"
          title={theme.breakdown.title}
          subtitle={theme.breakdown.subtitle(aimag, s)}
          scroll
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {breakdownRows.map((r) => (
              <BarRow key={r.label} label={r.label} value={r.value} share={(r.share / breakdownMax) * 100} color={r.color} />
            ))}
          </div>
        </Panel>

        {/* --- right of the map --- */}
        <Panel
          className="lg:col-span-3"
          title="Үйлчилгээний хүртээмжийн зай"
          subtitle={`${bandCaption} · ${n(s ? s.camps : aimag.camps)} бүртгэл`}
        >
          <Fill>
            <BandBars
              labels={aimag.bands[family].labels}
              counts={bandCounts}
              total={s ? s.camps : aimag.camps}
            />
          </Fill>
        </Panel>

        {/* --- the middle --- */}
        <Panel
          className="lg:col-span-6 lg:row-span-2"
          title={s ? `${def.label} · ${s.name}` : `${def.label} · орон зайн тархалт`}
          bodyClass="px-2 pb-2"
        >
          <MapPanel
            metric={metric}
            onMetricChange={setMetric}
            height="100%"
            campColoring={family === 'road' ? 'bandRoad' : family === 'kindergarten' ? 'bandKg' : 'bandSchool'}
            focusSelection
            onSelectSoum={setActive}
            selectedSoum={active}
          />
        </Panel>

        <Panel
          className="lg:col-span-3"
          title="Хүртээмжийн индексийн бүрэлдэхүүн"
          subtitle={s ? `${s.name} ↔ аймгийн дундаж` : 'аймгийн дундаж · 0–100'}
        >
          <Fill>
            <ProfileBars
              data={profile}
              score={s ? theme.score(s) : mean(theme.score)}
              showCompare={!!s}
              name={s ? s.name : 'Аймаг'}
            />
          </Fill>
        </Panel>

        <Panel className="lg:col-span-3 lg:row-span-2" title={`${def.label} · II хэсэг`}>
          <Fill>
            <SoumRadar
              data={radar.slice(9)}
              active={active}
              onSelect={setActive}
              selName={selName}
              names={{ social: theme.radar.social.name, road: theme.radar.road.name }}
              only={radarOnly}
              onOnly={setRadarOnly}
            />
          </Fill>
        </Panel>

        {theme.trend && trend ? (
          <Panel
            className="lg:col-span-3 lg:row-span-2"
            title={theme.trend.title(s)}
            subtitle={theme.trend.subtitle}
          >
            <Fill>
              <TrendChart data={trend.data} series={trend.series} />
            </Fill>
          </Panel>
        ) : (
          <Panel className="lg:col-span-3 lg:row-span-2" title="Сумдын эрэмбэ" subtitle={`${def.label}`} scroll>
            <div className="space-y-1">
              {byMetric.slice(0, 10).map((x) => (
                <BarRow
                  key={x.code}
                  label={`${mRank(x)}. ${x.name}`}
                  value={fmt(mv(x))}
                  share={mScale(mv(x))}
                  color={x.idx === active ? SERIES.primary : SERIES.secondary}
                />
              ))}
            </div>
          </Panel>
        )}

        {/* --- below the map --- */}
        <SoumComparisonTable
          soums={soums}
          className="lg:col-span-6"
          onRowClick={(x) => setActive(x.idx === active ? null : x.idx)}
          activeIdx={active}
          followGroup={theme.tableGroup}
        />
      </Board>
    </Screen>
  );
}
