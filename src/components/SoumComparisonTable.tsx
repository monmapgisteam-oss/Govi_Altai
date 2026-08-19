'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import DataTable, { type Column } from './DataTable';
import { Panel } from './ui';
import { n, pc } from '@/lib/format';
import type { Soum } from '@/lib/types';

const GROUPS = [
  { key: 'index', label: 'Нэгдсэн индекс' },
  { key: 'overview', label: 'Ерөнхий үзүүлэлт' },
  { key: 'education', label: 'Боловсролын хүртээмж' },
  { key: 'roads', label: 'Замын хүртээмж' },
] as const;

type GroupKey = (typeof GROUPS)[number]['key'];

const nameCol: Column = { key: 'name', label: 'Сум', get: (x) => x.name, align: 'left', sticky: true };
const rankCol: Column = { key: 'rank', label: '#', get: (x) => x.rank, format: (v) => String(v), align: 'right' };

export const SOUM_COLUMNS: Record<GroupKey, Column[]> = {
  index: [
    nameCol, rankCol,
    { key: 'schoolIndex', label: 'Сургууль', get: (x) => x.schoolIndex, format: (v) => n(Number(v), 1), align: 'right', bar: true },
    { key: 'kgIndex', label: 'Цэцэрлэг', get: (x) => x.kgIndex, format: (v) => n(Number(v), 1), align: 'right', bar: true },
    { key: 'healthIndex', label: 'Эмнэлэг', get: (x) => x.healthIndex, format: (v) => n(Number(v), 1), align: 'right', bar: true },
    { key: 'socialIndex', label: 'Нийгмийн дэд бүтэц', hint: '0.5·боловср + 0.5·эрүүл', get: (x) => x.socialIndex, format: (v) => n(Number(v), 1), align: 'right', bar: true },
    { key: 'roadIndex', label: 'Зам', get: (x) => x.roadIndex, format: (v) => n(Number(v), 1), align: 'right', bar: true },
    { key: 'overallIndex', label: 'Нэгдсэн', hint: '0.5·нийгэм + 0.5·зам', get: (x) => x.overallIndex, format: (v) => n(Number(v), 1), align: 'right', bar: true },
    { key: 'grade', label: 'Үнэлгээ', get: (x) => x.grade, align: 'right' },
  ],
  overview: [
    nameCol, rankCol,
    { key: 'population', label: 'Хүн ам', get: (x) => x.population, format: (v) => n(Number(v)), align: 'right', bar: true, invert: true },
    { key: 'households', label: 'Өрх', get: (x) => x.households, format: (v) => n(Number(v)), align: 'right', bar: true, invert: true },
    { key: 'herder', label: 'Малтай өрх', get: (x) => x.herderHouseholds, format: (v) => n(Number(v)), align: 'right' },
    { key: 'camps', label: 'Бууц', get: (x) => x.camps, format: (v) => n(Number(v)), align: 'right', bar: true, invert: true },
    { key: 'area', label: 'Талбай', hint: 'км²', get: (x) => x.areaKm2, format: (v) => n(Number(v), 0), align: 'right' },
    { key: 'popDensity', label: 'Нягтшил', hint: 'хүн/км²', get: (x) => x.popDensity, format: (v) => n(Number(v), 2), align: 'right' },
    { key: 'grade', label: 'Үнэлгээ', get: (x) => x.grade, align: 'right' },
  ],
  education: [
    nameCol,
    { key: 'schools', label: 'Сургууль', get: (x) => x.schools, format: (v) => n(Number(v)), align: 'right' },
    { key: 'kg', label: 'Цэцэрлэг', get: (x) => x.kindergartens, format: (v) => n(Number(v)), align: 'right' },
    { key: 'hf', label: 'Эмнэлэг', get: (x) => x.healthFacilities, format: (v) => n(Number(v)), align: 'right' },
    { key: 'dmean', label: 'Дундаж зай', hint: 'км', get: (x) => x.dSchool.mean, format: (v) => n(Number(v), 1), align: 'right' },
    { key: 'dmed', label: 'Медиан', hint: 'км', get: (x) => x.dSchool.median, format: (v) => n(Number(v), 1), align: 'right' },
    { key: 'travel', label: 'Явах хугацаа', hint: 'цаг', get: (x) => x.travelH, format: (v) => n(Number(v), 2), align: 'right' },
    { key: 's25', label: '≤25 км', hint: 'сургууль', get: (x) => x.cover.school25, format: (v) => pc(Number(v)), align: 'right', bar: true },
    { key: 'k15', label: '≤15 км', hint: 'цэцэрлэг', get: (x) => x.cover.kg15, format: (v) => pc(Number(v)), align: 'right', bar: true },
    { key: 'sp', label: 'E2SFCA сур', hint: '1000 хүнд', get: (x) => x.schoolPer1000, format: (v) => n(Number(v), 2), align: 'right' },
    { key: 'kp', label: 'E2SFCA цэц', hint: '1000 хүнд', get: (x) => x.kgPer1000, format: (v) => n(Number(v), 2), align: 'right' },
    { key: 'hp', label: 'E2SFCA эмн', hint: '1000 хүнд', get: (x) => x.healthPer1000, format: (v) => n(Number(v), 2), align: 'right' },
  ],
  roads: [
    nameCol,
    { key: 'roadKm', label: 'Зам', hint: 'км', get: (x) => x.roadKm, format: (v) => n(Number(v), 0), align: 'right', bar: true, invert: true },
    { key: 'paved', label: 'Улсын зам', hint: 'км', get: (x) => x.pavedKm, format: (v) => n(Number(v), 0), align: 'right' },
    { key: 'pavedShare', label: 'Эзлэх', hint: '%', get: (x) => x.pavedShare, format: (v) => pc(Number(v)), align: 'right' },
    { key: 'density', label: 'Нягтшил', hint: 'км/1000км²', get: (x) => x.roadDensity, format: (v) => n(Number(v), 1), align: 'right', bar: true, invert: true },
    { key: 'dRoad', label: 'Зам хүртэл', hint: 'дундаж, км', get: (x) => x.dRoad.mean, format: (v) => n(Number(v), 2), align: 'right' },
    { key: 'r5', label: '≤5 км', hint: '%', get: (x) => x.cover.road5, format: (v) => pc(Number(v)), align: 'right', bar: true },
    { key: 'r10', label: '≤10 км', hint: '%', get: (x) => x.cover.road10, format: (v) => pc(Number(v)), align: 'right', bar: true },
    { key: 'nat', label: 'Улсын зам хүртэл', hint: 'км', get: (x) => x.dNat.mean, format: (v) => n(Number(v), 1), align: 'right' },
    { key: 'nat20', label: '≤20 км', hint: '%', get: (x) => x.cover.nat20, format: (v) => pc(Number(v)), align: 'right', bar: true },
  ],
};

/**
 * The 18-soum comparison table with its metric-group switch.
 * Shared by the overview board and the soum-comparison page.
 */
export default function SoumComparisonTable({
  soums,
  className,
  title = 'Сумдын үндсэн үзүүлэлтийн харьцуулалт',
  subtitle,
  onRowClick,
  activeIdx,
  followGroup,
}: {
  soums: Soum[];
  className?: string;
  title?: string;
  subtitle?: string;
  onRowClick?: (s: Soum) => void;
  activeIdx?: number | null;
  /** the header metric decides which column group opens; a manual tab wins after that */
  followGroup?: GroupKey;
}) {
  const [group, setGroup] = useState<GroupKey>(followGroup ?? 'index');
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned && followGroup) setGroup(followGroup);
  }, [followGroup, pinned]);
  const columns = SOUM_COLUMNS[group];

  return (
    <Panel
      className={className}
      title={title}
      subtitle={subtitle}
      action={
        <div className="flex shrink-0 rounded-lg border border-ink-700 bg-ink-900/70 p-0.5">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => { setPinned(true); setGroup(g.key); }}
              className={clsx(
                'rounded-[5px] px-2 py-[3px] text-[10px] transition',
                group === g.key
                  ? 'bg-sand-500/15 text-ink-100 ring-1 ring-sand-500/25'
                  : 'text-ink-400 hover:text-ink-200',
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
      }
      bodyClass="overflow-auto px-2"
    >
      <DataTable
        soums={soums}
        columns={columns}
        initialSort={group === 'index' ? 'overallIndex' : columns[2]?.key}
        onRowClick={onRowClick}
        activeIdx={activeIdx}
      />
    </Panel>
  );
}
