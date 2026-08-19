'use client';

import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { gradeColor } from '@/lib/format';
import type { Soum } from '@/lib/types';

export type Column = {
  key: string;
  label: string;
  hint?: string;
  /** value getter */
  get: (s: Soum) => number | string | null;
  format?: (v: number | string | null, s: Soum) => string;
  /** render a 0–100 index bar behind the value */
  bar?: boolean;
  /** lower is better (colours the bar) */
  invert?: boolean;
  align?: 'left' | 'right';
  sticky?: boolean;
};

export default function DataTable({
  soums,
  columns,
  initialSort,
  initialDir = 'desc',
  onRowClick,
  activeIdx,
}: {
  soums: Soum[];
  columns: Column[];
  initialSort?: string;
  initialDir?: 'asc' | 'desc';
  onRowClick?: (s: Soum) => void;
  activeIdx?: number | null;
}) {
  const [sort, setSort] = useState(initialSort ?? columns[0].key);
  const [dir, setDir] = useState<'asc' | 'desc'>(initialDir);

  const col = columns.find((c) => c.key === sort) ?? columns[0];
  const rows = useMemo(() => {
    const arr = [...soums];
    arr.sort((a, b) => {
      const va = col.get(a);
      const vb = col.get(b);
      if (typeof va === 'string' || typeof vb === 'string')
        return String(va).localeCompare(String(vb), 'mn') * (dir === 'asc' ? 1 : -1);
      const na = va ?? -Infinity;
      const nb = vb ?? -Infinity;
      return (na - nb) * (dir === 'asc' ? 1 : -1);
    });
    return arr;
  }, [soums, col, dir]);

  const toggle = (key: string) => {
    if (key === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('desc');
    }
  };

  const maxima = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of columns) {
      if (!c.bar) continue;
      m[c.key] = Math.max(...soums.map((s) => Number(c.get(s) ?? 0)), 1);
    }
    return m;
  }, [columns, soums]);

  return (
    <div className="min-w-full">
      <table className="w-full min-w-[520px] border-collapse text-[11px]">
        <thead className="sticky top-0 z-20 bg-ink-900">
          <tr className="border-b border-ink-700">
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggle(c.key)}
                className={clsx(
                  'group cursor-pointer select-none whitespace-nowrap px-2 py-1.5 align-bottom font-medium transition',
                  c.align === 'left' ? 'text-left' : 'text-right',
                  c.sticky && 'sticky left-0 z-10 bg-ink-900',
                  sort === c.key ? 'text-sand-500' : 'text-ink-400 hover:text-ink-200',
                )}
              >
                <span className="inline-flex items-center gap-1">
                  {c.align === 'left' && sortMark(sort === c.key, dir)}
                  <span className="flex flex-col">
                    <span className="text-[10.5px] leading-tight">{c.label}</span>
                    {c.hint && (
                      <span className="text-[8.5px] font-normal leading-tight text-ink-600">{c.hint}</span>
                    )}
                  </span>
                  {c.align !== 'left' && sortMark(sort === c.key, dir)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.code}
              onClick={() => onRowClick?.(s)}
              className={clsx(
                'border-b border-ink-800/60 transition',
                onRowClick && 'cursor-pointer',
                activeIdx === s.idx ? 'bg-sand-500/10' : 'hover:bg-ink-800/45',
              )}
            >
              {columns.map((c) => {
                const raw = c.get(s);
                const text = c.format ? c.format(raw, s) : String(raw ?? '—');
                const num = Number(raw ?? 0);
                return (
                  <td
                    key={c.key}
                    className={clsx(
                      'relative whitespace-nowrap px-2 py-[4px]',
                      c.align === 'left' ? 'text-left text-ink-100' : 'num text-right text-ink-200',
                      c.sticky && 'sticky left-0 z-10 bg-inherit font-medium',
                    )}
                  >
                    {c.bar && (
                      <span
                        className="absolute inset-y-[3px] right-1 -z-0 rounded-[3px] opacity-[0.17]"
                        style={{
                          width: `${Math.max(3, (num / (maxima[c.key] || 1)) * 82)}%`,
                          background: c.invert ? '#8b9aa9' : gradeColor(c.key.includes('Index') ? num : (num / (maxima[c.key] || 1)) * 100),
                        }}
                      />
                    )}
                    <span className="relative">{text}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function sortMark(active: boolean, dir: 'asc' | 'desc') {
  return (
    <svg
      viewBox="0 0 10 10"
      className={clsx('size-2.5 shrink-0 transition', active ? 'opacity-100' : 'opacity-0 group-hover:opacity-40')}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      {dir === 'desc' ? <path d="M2.5 4L5 6.6L7.5 4" /> : <path d="M2.5 6.6L5 4L7.5 6.6" />}
    </svg>
  );
}
