'use client';

import { useState } from 'react';
import clsx from 'clsx';
import MapPanel from './MapPanel';
import DataTable, { type Column } from './DataTable';
import { BandBars, Gauge } from './charts';
import { BarRow, Board, Fill, GradeChip, KpiStrip, Panel, Screen, Tile, TopBar } from './ui';
import { km, n, pc } from '@/lib/format';
import type { Aimag, Soum } from '@/lib/types';

type Mode = 'school' | 'kg';

const MODES: { key: Mode; label: string; hint: string }[] = [
  { key: 'school', label: 'Сургууль', hint: 'катчмент 80 км' },
  { key: 'kg', label: 'Цэцэрлэг', hint: 'катчмент 50 км' },
];

export default function EducationExplorer({ aimag, soums }: { aimag: Aimag; soums: Soum[] }) {
  const [mode, setMode] = useState<Mode>('school');
  const [active, setActive] = useState<number | null>(null);

  const isSchool = mode === 'school';
  const band = isSchool ? aimag.bands.school : aimag.bands.kindergarten;
  const facilities = isSchool ? aimag.schools : aimag.kindergartens;
  const nearCover = isSchool ? aimag.cover.school25 : aimag.cover.kg15;
  const farCover = isSchool ? aimag.cover.school50 : aimag.cover.kg30;
  const nearLabel = isSchool ? '≤ 25 км' : '≤ 15 км';
  const farLabel = isSchool ? '≤ 50 км' : '≤ 30 км';
  const farOut = Math.round((aimag.camps * (100 - farCover)) / 100);

  const health = aimag.health.filter((h) => h.value > 0);
  const healthMax = health[0]?.value ?? 1;

  const columns: Column[] = [
    { key: 'name', label: 'Сум', get: (s) => s.name, align: 'left', sticky: true },
    {
      key: 'facilities',
      label: isSchool ? 'Сургууль' : 'Цэцэрлэг',
      get: (s) => (isSchool ? s.schools : s.kindergartens),
      format: (v) => n(Number(v)),
      align: 'right',
    },
    { key: 'households', label: 'Өрх', get: (s) => s.households, format: (v) => n(Number(v)), align: 'right' },
    { key: 'camps', label: 'Бууц', get: (s) => s.camps, format: (v) => n(Number(v)), align: 'right' },
    { key: 'dmean', label: 'Дундаж', hint: 'км', get: (s) => s.dSchool.mean, format: (v) => n(Number(v), 1), align: 'right' },
    { key: 'p90', label: 'P90', hint: 'км', get: (s) => s.dSchool.p90, format: (v) => n(Number(v), 1), align: 'right' },
    {
      key: 'near', label: nearLabel, hint: 'бууцны %',
      get: (s) => (isSchool ? s.cover.school25 : s.cover.kg15),
      format: (v) => pc(Number(v)), align: 'right', bar: true,
    },
    {
      key: 'far', label: farLabel, hint: 'бууцны %',
      get: (s) => (isSchool ? s.cover.school50 : s.cover.kg30),
      format: (v) => pc(Number(v)), align: 'right', bar: true,
    },
    {
      key: 'per1000', label: 'E2SFCA', hint: '1000 хүнд',
      get: (s) => (isSchool ? s.schoolPer1000 : s.kgPer1000),
      format: (v) => n(Number(v), 2), align: 'right',
    },
    {
      key: 'Index', label: 'Индекс', hint: '0–100',
      get: (s) => (isSchool ? s.schoolIndex : s.kgIndex),
      format: (v) => n(Number(v), 1), align: 'right', bar: true,
    },
  ];

  const s = active === null ? null : soums.find((x) => x.idx === active) ?? null;

  return (
    <Screen>
      <TopBar title="Боловсролын байгууллагын хүртээмж">
        <div className="flex shrink-0 rounded-xl border border-ink-700 bg-ink-900/70 p-0.5">
          {MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={clsx(
                'rounded-lg px-2.5 py-1.5 text-left transition',
                mode === m.key
                  ? 'bg-sand-500/15 text-ink-100 ring-1 ring-sand-500/30'
                  : 'text-ink-400 hover:text-ink-200',
              )}
            >
              <span className="block text-[11.5px] font-medium leading-tight">{m.label}</span>
              <span className="block text-[9px] leading-tight text-ink-500">{m.hint}</span>
            </button>
          ))}
        </div>
      </TopBar>

      <KpiStrip
        items={[
          { label: isSchool ? 'Сургууль' : 'Цэцэрлэг', value: n(facilities), sub: `${aimag.schoolYear} он` },
          { label: 'Дундаж зай', value: n(aimag.dist.schoolMean, 1), unit: 'км', sub: 'бууц → сумын төв' },
          { label: nearLabel, value: pc(nearCover), sub: 'бууцны хамралт', accent: 'sand' },
          { label: farLabel, value: pc(farCover), sub: 'өргөтгөсөн бүс', accent: 'teal' },
          { label: 'Гадуур үлдсэн', value: n(farOut), unit: 'бууц', sub: pc(100 - farCover) },
          { label: 'Ачаалал', value: n(aimag.households / facilities, 0), sub: 'өрх / байгууллага' },
        ]}
      />

      <Board rows={5}>
        <Panel
          className="lg:col-span-5 lg:row-span-3"
          title={`${isSchool ? 'Ерөнхий боловсролын сургуулийн' : 'Цэцэрлэгийн'} хүртээмжийн орон зайн тархалт`}
          bodyClass="px-2 pb-2"
        >
          <MapPanel
            key={mode}
            metric={isSchool ? 'schoolIndex' : 'kgIndex'}
            campColoring={isSchool ? 'bandSchool' : 'bandKg'}
            showCamps
            height="100%"
            onSelectSoum={setActive}
            selectedSoum={active}
          />
        </Panel>

        <Panel
          className="lg:col-span-4 lg:row-span-3"
          title="Сумын төвөөс алслагдсан байдал"
          subtitle={`${n(aimag.camps)} бууц`}
        >
          <Fill>
            <BandBars labels={band.labels} counts={band.count} total={aimag.camps} />
          </Fill>
          <div className="mt-1 grid shrink-0 grid-cols-2 gap-1">
            <Gauge value={nearCover} label={isSchool ? 'Сургууль' : 'Цэцэрлэг'} sub={nearLabel} size={88} />
            <Gauge value={farCover} label="Өргөтгөсөн бүс" sub={farLabel} size={88} />
          </div>
        </Panel>

        <Panel
          className="lg:col-span-3 lg:row-span-3"
          title={s ? s.name : 'Сум сонгоно уу'}
          subtitle={s ? `эрэмбэ ${s.rank}/18 · ${s.centre.name}` : undefined}
          action={s ? <GradeChip score={s.overallIndex} showScore={false} /> : undefined}
          scroll
        >
          {s ? (
            <div className="grid grid-cols-2 gap-1">
              {(
                [
                  [isSchool ? 'Сургууль' : 'Цэцэрлэг', n(isSchool ? s.schools : s.kindergartens)],
                  ['Өрх', n(s.households)],
                  ['Бууц', n(s.camps)],
                  ['Хүн ам', n(s.population)],
                  ['Дундаж зай', km(s.dSchool.mean)],
                  ['Медиан зай', km(s.dSchool.median)],
                  ['90-р хувиар', km(s.dSchool.p90)],
                  ['Явах хугацаа', `${n(s.travelH, 2)} ц`],
                  [`Хамралт ${nearLabel}`, pc(isSchool ? s.cover.school25 : s.cover.kg15)],
                  [`Хамралт ${farLabel}`, pc(isSchool ? s.cover.school50 : s.cover.kg30)],
                  ['E2SFCA/1000 хүн', n(isSchool ? s.schoolPer1000 : s.kgPer1000, 2)],
                  ['Индекс', n(isSchool ? s.schoolIndex : s.kgIndex, 1)],
                ] as [string, string][]
              ).map(([k, v]) => (
                <Tile key={k} label={k} value={v} />
              ))}
            </div>
          ) : null}
        </Panel>

        <Panel
          className="lg:col-span-5 lg:row-span-2"
          title="Эрүүл мэндийн байгууллагын тоо, төрлөөр"
          subtitle={`${health[0]?.year ?? ''} он`}
          scroll
        >
          <div className="grid grid-cols-2 gap-x-3 gap-y-[3px]">
            {health.map((h) => (
              <BarRow
                key={h.name}
                label={h.name}
                value={n(h.value)}
                share={(h.value / healthMax) * 100}
                color="#e0a33c"
              />
            ))}
          </div>
        </Panel>

        <Panel
          className="lg:col-span-7 lg:row-span-2"
          title="Сумдын үндсэн үзүүлэлтийн харьцуулалт"
          bodyClass="overflow-auto px-2"
        >
          <DataTable
            soums={soums}
            columns={columns}
            initialSort="Index"
            onRowClick={(x) => setActive(x.idx === active ? null : x.idx)}
            activeIdx={active}
          />
        </Panel>
      </Board>
    </Screen>
  );
}
