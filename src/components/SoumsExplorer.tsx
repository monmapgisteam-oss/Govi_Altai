'use client';

import { useState } from 'react';
import MapPanel from './MapPanel';
import SoumComparisonTable from './SoumComparisonTable';
import { MiniLine, RankBars, SERIES } from './charts';
import {
  Board, Fill, GradeChip, IndexBar, KpiStrip, Panel, Screen, Tile, TopBar,
} from './ui';
import { GRADE_COLORS, GRADE_NAMES, hrs, km, n, pc } from '@/lib/format';
import type { Aimag, Soum } from '@/lib/types';

export default function SoumsExplorer({ aimag, soums }: { aimag: Aimag; soums: Soum[] }) {
  const [active, setActive] = useState<number | null>(soums[0]?.idx ?? null);
  const s = active === null ? null : soums.find((x) => x.idx === active) ?? null;

  const avg = soums.reduce((a, x) => a + x.overallIndex, 0) / soums.length;
  const spread =
    Math.max(...soums.map((x) => x.overallIndex)) - Math.min(...soums.map((x) => x.overallIndex));
  const counts = GRADE_NAMES.map((g) => soums.filter((x) => x.grade === g).length);

  return (
    <Screen>
      <TopBar title="Сумдын харьцуулалт ба эрэмбэ" />

      <KpiStrip
        items={[
          { label: 'Дундаж индекс', value: n(avg, 1), sub: '18 сумын дундаж', accent: 'sand' },
          { label: 'Хамгийн их зөрүү', value: n(spread, 1), unit: 'нэгж', sub: 'дээд ↔ доод сум', accent: 'teal' },
          { label: 'Хангалтгүй ангилалд', value: String(counts[3] + counts[4]), unit: 'сум', sub: 'индекс < 40' },
          { label: 'Хамрагдалтгүй бууц', value: n(Math.round((aimag.camps * (100 - aimag.cover.road10)) / 100)), sub: 'замаас 10+ км' },
          { label: 'Хүн ам', value: n(aimag.population), sub: `өрх ${n(aimag.households)}` },
        ]}
      />

      <Board rows={5}>
        <Panel
          className="lg:col-span-3 lg:row-span-5"
          title="Нэгдсэн хүртээмжийн индекс, сумдаар"
        >
          <Fill>
            <RankBars
              data={[...soums].sort((a, b) => b.overallIndex - a.overallIndex).map((x) => ({ name: x.name, value: x.overallIndex }))}
              domain={[0, 100]}
              reference={avg}
            />
          </Fill>
          <div className="mt-1 shrink-0 space-y-[3px] border-t border-ink-800 pt-1.5">
            {GRADE_NAMES.map((g, i) => (
              <div key={g} className="flex items-center gap-2">
                <span className="size-2 shrink-0 rounded-[2px]" style={{ background: GRADE_COLORS[i] }} />
                <span className="w-[74px] shrink-0 truncate text-[9.5px] text-ink-400">{g}</span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(counts[i] / soums.length) * 100}%`, background: GRADE_COLORS[i] }}
                  />
                </div>
                <span className="num w-4 shrink-0 text-right text-[9.5px] text-ink-300">{counts[i]}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          className="lg:col-span-4 lg:row-span-3"
          title="Сумдын хүртээмжийн орон зайн тархалт"
          bodyClass="px-2 pb-2"
        >
          <MapPanel metric="overallIndex" height="100%" onSelectSoum={setActive} selectedSoum={active} />
        </Panel>

        {s && (
          <Panel
            className="lg:col-span-5 lg:row-span-3"
            title={s.name}
            subtitle={`${s.centre.name} · ${n(s.areaKm2, 0)} км² · эрэмбэ ${s.rank}/18`}
            action={<GradeChip score={s.overallIndex} />}
            scroll
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.09em] text-ink-500">
                  Индексийн задаргаа
                </div>
                <div className="space-y-1.5">
                  {(
                    [
                      ['Сургууль', s.schoolIndex],
                      ['Цэцэрлэг', s.kgIndex],
                      ['Нийгмийн дэд бүтэц', s.socialIndex],
                      ['Зам', s.roadIndex],
                      ['Нэгдсэн', s.overallIndex],
                    ] as [string, number][]
                  ).map(([label, v]) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-[64px] shrink-0 text-[10px] text-ink-300">{label}</span>
                      <IndexBar value={v} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 border-t border-ink-800 pt-1.5">
                  <div className="text-[9px] font-medium uppercase tracking-[0.09em] text-ink-500">
                    Өрхийн тоо, 2003–{s.householdSeries[s.householdSeries.length - 1]?.year}
                  </div>
                  <MiniLine data={s.householdSeries} color={SERIES.secondary} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 self-start">
                {(
                  [
                    ['Хүн ам', n(s.population)],
                    ['Өрх', n(s.households)],
                    ['Малтай өрх', n(s.herderHouseholds)],
                    ['Бууц', n(s.camps)],
                    ['Сургууль', n(s.schools)],
                    ['Цэцэрлэг', n(s.kindergartens)],
                    ['Зам', km(s.roadKm, 0)],
                    ['Нягтшил', n(s.roadDensity, 1)],
                    ['Сумын төв хүртэл', km(s.dSchool.mean)],
                    ['Зам хүртэл', km(s.dRoad.mean, 2)],
                    ['Явах хугацаа', hrs(s.travelH)],
                    ['≤5 км замд', pc(s.cover.road5)],
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <Tile key={k} label={k} value={v} />
                ))}
              </div>
            </div>
          </Panel>
        )}

        <SoumComparisonTable
          soums={soums}
          className="lg:col-span-9 lg:row-span-2"
          onRowClick={(x) => setActive(x.idx)}
          activeIdx={active}
        />

      </Board>
    </Screen>
  );
}
