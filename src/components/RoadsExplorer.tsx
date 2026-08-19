'use client';

import { useState } from 'react';
import MapPanel from './MapPanel';
import DataTable, { type Column } from './DataTable';
import { BandBars, Gauge, RankBars } from './charts';
import { BarRow, Board, Fill, GradeChip, KpiStrip, Panel, Screen, Tile, TopBar } from './ui';
import { km, n, pc } from '@/lib/format';
import type { NationalRoad } from '@/lib/data';
import type { Aimag, Soum } from '@/lib/types';

const CLASS_COLORS = ['#e0a33c', '#46c9b4', '#7c8fa3', '#4d6b7d', '#c2861f', '#7c6ba8', '#3f4a56'];

export default function RoadsExplorer({
  aimag,
  soums,
  national,
}: {
  aimag: Aimag;
  soums: Soum[];
  national: NationalRoad[];
}) {
  const [active, setActive] = useState<number | null>(null);
  const s = active === null ? null : soums.find((x) => x.idx === active) ?? null;

  const isolated = Math.round((aimag.camps * (100 - aimag.cover.road10)) / 100);
  const classes = Object.entries(aimag.roadByClass).sort((a, b) => b[1] - a[1]);
  const classMax = classes[0]?.[1] ?? 1;
  const avgIndex = soums.reduce((a, x) => a + x.roadIndex, 0) / soums.length;

  const columns: Column[] = [
    { key: 'name', label: 'Сум', get: (x) => x.name, align: 'left', sticky: true },
    { key: 'roadKm', label: 'Зам', hint: 'км', get: (x) => x.roadKm, format: (v) => n(Number(v), 0), align: 'right', bar: true, invert: true },
    { key: 'paved', label: 'Улсын', hint: 'км', get: (x) => x.pavedKm, format: (v) => n(Number(v), 0), align: 'right' },
    { key: 'density', label: 'Нягтшил', hint: 'км/1000км²', get: (x) => x.roadDensity, format: (v) => n(Number(v), 1), align: 'right', bar: true, invert: true },
    { key: 'perCapita', label: 'Хүн амд', hint: 'км/1000', get: (x) => x.roadPerCapita, format: (v) => n(Number(v), 1), align: 'right' },
    { key: 'dRoad', label: 'Зам хүртэл', hint: 'дундаж, км', get: (x) => x.dRoad.mean, format: (v) => n(Number(v), 2), align: 'right' },
    { key: 'p90', label: 'P90', hint: 'км', get: (x) => x.dRoad.p90, format: (v) => n(Number(v), 1), align: 'right' },
    { key: 'r5', label: '≤5 км', hint: '%', get: (x) => x.cover.road5, format: (v) => pc(Number(v)), align: 'right', bar: true },
    { key: 'r10', label: '≤10 км', hint: '%', get: (x) => x.cover.road10, format: (v) => pc(Number(v)), align: 'right', bar: true },
    { key: 'nat20', label: 'Улсын ≤20', hint: '%', get: (x) => x.cover.nat20, format: (v) => pc(Number(v)), align: 'right', bar: true },
    { key: 'roadIndex', label: 'Индекс', hint: '0–100', get: (x) => x.roadIndex, format: (v) => n(Number(v), 1), align: 'right', bar: true },
  ];

  return (
    <Screen>
      <TopBar title="Авто замын хүртээмж" />

      <KpiStrip
        items={[
          { label: 'Нийт зам', value: n(aimag.roadKm, 0), unit: 'км', sub: `${aimag.soumCount} сумын сүлжээ` },
          {
            label: 'Улсын чанартай',
            value: n(aimag.roadByClass['Улсын чанартай авто зам'] ?? 0, 0),
            unit: 'км',
            sub: `${pc(((aimag.roadByClass['Улсын чанартай авто зам'] ?? 0) / aimag.roadKm) * 100)} сүлжээний`,
            accent: 'teal',
          },
          { label: 'Нягтшил', value: n(aimag.roadDensity, 1), unit: 'км/1000км²' },
          { label: 'Зам хүртэл', value: n(aimag.dist.roadMean, 2), unit: 'км', sub: 'дундаж зай' },
          { label: '≤5 км дотор', value: pc(aimag.cover.road5), sub: 'бууцны эзлэх хувь', accent: 'sand' },
          { label: '10+ км тасархай', value: n(isolated), unit: 'бууц', sub: pc(100 - aimag.cover.road10) },
        ]}
      />

      <Board rows={5}>
        <Panel
          className="lg:col-span-5 lg:row-span-3"
          title="Авто замын сүлжээ, ойролцоо байдал"
          bodyClass="px-2 pb-2"
        >
          <MapPanel
            metric="roadIndex"
            campColoring="bandRoad"
            showCamps
            height="100%"
            onSelectSoum={setActive}
            selectedSoum={active}
          />
        </Panel>

        <Panel
          className="lg:col-span-4 lg:row-span-3"
          title="Авто зам хүртэлх зайн бүс"
          subtitle={`дундаж ${km(aimag.dist.roadMean, 2)}`}
        >
          <Fill>
            <BandBars labels={aimag.bands.road.labels} counts={aimag.bands.road.count} total={aimag.camps} />
          </Fill>
          <div className="mt-1 grid shrink-0 grid-cols-3 gap-1">
            <Gauge value={aimag.cover.road5} label="Аль нэг зам" sub="≤ 5 км" size={86} />
            <Gauge value={aimag.cover.road10} label="Аль нэг зам" sub="≤ 10 км" size={86} />
            <Gauge value={aimag.cover.nat20} label="Улсын зам" sub="≤ 20 км" size={86} />
          </div>
        </Panel>

        <Panel
          className="lg:col-span-3 lg:row-span-2"
          title="Авто замын ангилал, урт"
          subtitle="км"
          scroll
        >
          <div className="space-y-1">
            {classes.map(([name, v], i) => (
              <BarRow
                key={name}
                label={name}
                value={`${n(v, 0)} км · ${((v / aimag.roadKm) * 100).toFixed(1)}%`}
                share={(v / classMax) * 100}
                color={CLASS_COLORS[i % CLASS_COLORS.length]}
              />
            ))}
          </div>
        </Panel>

        <Panel
          className="lg:col-span-3"
          title={s ? s.name : 'Сум сонгоно уу'}
          subtitle={undefined}
          action={s ? <GradeChip score={s.roadIndex} showScore={false} /> : undefined}
          scroll
        >
          {s ? (
            <div className="grid grid-cols-3 gap-1">
              {(
                [
                  ['Нийт зам', km(s.roadKm, 0)],
                  ['Улсын', km(s.pavedKm, 0)],
                  ['Нягтшил', n(s.roadDensity, 1)],
                  ['Зам хүртэл', km(s.dRoad.mean, 2)],
                  ['Медиан', km(s.dRoad.median, 2)],
                  ['P90', km(s.dRoad.p90, 1)],
                  ['≤5 км', pc(s.cover.road5)],
                  ['≤10 км', pc(s.cover.road10)],
                  ['Индекс', n(s.roadIndex, 1)],
                ] as [string, string][]
              ).map(([k, v]) => (
                <Tile key={k} label={k} value={v} />
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel
          className="lg:col-span-5 lg:row-span-2"
          title="Сумдын авто замын үзүүлэлт"
          bodyClass="overflow-auto px-2"
        >
          <DataTable
            soums={soums}
            columns={columns}
            initialSort="roadIndex"
            onRowClick={(x) => setActive(x.idx === active ? null : x.idx)}
            activeIdx={active}
          />
        </Panel>

        <Panel
          className="lg:col-span-4 lg:row-span-2"
          title="Авто замын хүртээмжийн индекс"
          subtitle={`0–100 · дундаж ${n(avgIndex, 1)}`}
        >
          <Fill>
            <RankBars
              data={[...soums].sort((a, b) => b.roadIndex - a.roadIndex).map((x) => ({ name: x.name, value: x.roadIndex }))}
              domain={[0, 100]}
              reference={avgIndex}
            />
          </Fill>
        </Panel>

        <Panel
          className="lg:col-span-3 lg:row-span-2"
          title="Улсын чанартай авто замын бүртгэл"
          subtitle={`${national.length} чиглэл · ${km(aimag.nationalRoadKm, 0)}`}
          bodyClass="overflow-auto px-2"
        >
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-ink-900">
              <tr className="border-b border-ink-700 text-[9px] uppercase tracking-wide text-ink-500">
                <th className="px-1.5 py-1 text-left font-medium">Чиглэл</th>
                <th className="px-1.5 py-1 text-left font-medium">Хучилт</th>
                <th className="px-1.5 py-1 text-right font-medium">Км</th>
              </tr>
            </thead>
            <tbody>
              {national.map((r, i) => (
                <tr key={`${r.code}-${i}`} className="border-b border-ink-800/60 hover:bg-ink-800/40">
                  <td className="max-w-[150px] truncate px-1.5 py-[3px] text-ink-100" title={r.name}>
                    {r.name || '—'}
                  </td>
                  <td className="max-w-[80px] truncate px-1.5 py-[3px] text-ink-400" title={r.pavement}>
                    {r.pavement || '—'}
                  </td>
                  <td className="num px-1.5 py-[3px] text-right text-ink-200">{n(r.lengthKm, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </Board>
    </Screen>
  );
}
