'use client';

import { useState } from 'react';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import clsx from 'clsx';
import { BAND_COLORS, gradeColor, n } from '@/lib/format';

const AXIS = { stroke: '#1b2632', tickLine: false, axisLine: false } as const;

/**
 * One placement for every legend: a vertical list down the right-hand side, so
 * the plot keeps its full height and the labels never wrap under the axis.
 */
const LEGEND = {
  layout: 'horizontal' as const,
  align: 'center' as const,
  verticalAlign: 'bottom' as const,
  iconType: 'circle' as const,
  iconSize: 7,
  wrapperStyle: { color: '#8b9aa9', fontSize: 10, lineHeight: '14px', paddingTop: 2 },
};

/**
 * The whole app draws from three roles plus the five-step grade ramp:
 *   sand  — the primary series          teal — the secondary series
 *   muted — a reference or context line  ramp — anything scored good → poor
 * Nothing outside these is introduced per chart.
 */
export const SERIES = { primary: '#e0a33c', secondary: '#46c9b4', muted: '#8b9aa9' } as const;

/**
 * Legend rendered outside the SVG — polar charts overlap an internal one.
 * Sits beneath the plot, centred, matching the in-SVG legends.
 * Clicking an entry isolates that series; clicking it again brings the rest back.
 */
function BottomLegend({
  items,
  only,
  onPick,
}: {
  items: { key: string; name: string; color: string }[];
  only?: string | null;
  onPick?: (key: string | null) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-0.5 pt-1">
      {items.map((i) => {
        const dimmed = !!only && only !== i.key;
        return (
          <button
            key={i.key}
            onClick={() => onPick?.(only === i.key ? null : i.key)}
            className={clsx(
              'flex items-center gap-1.5 whitespace-nowrap text-left text-[9.5px] transition',
              dimmed ? 'text-ink-600' : 'text-ink-300 hover:text-ink-100',
            )}
          >
            <span
              className="size-2 shrink-0 rounded-full transition"
              style={{ background: i.color, opacity: dimmed ? 0.3 : 1 }}
            />
            {i.name}
          </button>
        );
      })}
    </div>
  );
}

function Box({
  title,
  rows,
}: {
  title?: string;
  rows: { label: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-xl border border-ink-600 bg-ink-850/95 px-3 py-2 shadow-xl backdrop-blur">
      {title && <div className="mb-1 text-[11.5px] font-semibold text-ink-100">{title}</div>}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4 text-[11.5px] leading-5">
          <span className="flex items-center gap-1.5 text-ink-300">
            {r.color && <span className="size-2 rounded-full" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="num text-ink-100">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const tip =
  (fmt: (v: any) => string, titleKey?: string) =>
  ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <Box
        title={titleKey ? String(payload[0]?.payload?.[titleKey] ?? label) : String(label)}
        rows={payload.map((p: any) => ({
          label: p.name,
          value: fmt(p.value),
          color: p.color || p.fill,
        }))}
      />
    );
  };

/* ------------------------------------------------------------------ trends */

export function TrendChart({
  data,
  series,
  height = '100%',
  unit = '',
}: {
  data: Record<string, unknown>[];
  /** `axis: 'right'` puts a series on its own scale — for counts an order of
   *  magnitude apart, which would otherwise flatten the smaller lines. */
  series: { key: string; name: string; color: string; axis?: 'left' | 'right' }[];
  height?: number | string;
  unit?: string;
}) {
  // clicking a legend entry isolates that series; clicking it again restores all
  const [only, setOnly] = useState<string | null>(null);
  const dual = series.some((s) => s.axis === 'right');
  // Overlapping areas at full strength read as one dark mass, and a zero
  // baseline flattens counts that only move between 25 and 31. So keep the area
  // look throughout, but thin the fill once several stack and let the axes hug
  // the data so the movement is actually visible.
  const solo = series.length === 1;
  const pad = (lo: number, hi: number) => [lo, hi] as [number, number];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: dual ? 0 : 6, left: 2, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={solo ? 0.35 : 0.18} />
              <stop offset="100%" stopColor={s.color} stopOpacity={solo ? 0.02 : 0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="year" {...AXIS} minTickGap={22} />
        <YAxis
          yAxisId="left"
          {...AXIS}
          width={dual ? 34 : 54}
          domain={solo ? [0, 'auto'] : pad('dataMin - 3' as never, 'dataMax + 3' as never)}
          allowDecimals={false}
        />
        {dual && (
          <YAxis
            yAxisId="right"
            orientation="right"
            {...AXIS}
            width={32}
            domain={['dataMin - 8', 'dataMax + 8']}
            allowDecimals={false}
            tick={{ fill: series.find((s) => s.axis === 'right')?.color, fontSize: 10 }}
          />
        )}
        <Tooltip content={tip((v) => `${n(v as number, 0)}${unit}`)} cursor={{ stroke: '#26333f' }} />
        {series.length > 1 && (
          <Legend
            {...LEGEND}
            onClick={(e: any) => setOnly((o) => (o === e.dataKey ? null : String(e.dataKey)))}
            formatter={(value: string, entry: any) => (
              <span
                style={{
                  cursor: 'pointer',
                  color: only && only !== entry.dataKey ? '#3f4a56' : '#8b9aa9',
                }}
              >
                {value}
              </span>
            )}
          />
        )}
        {series.map((s) => (
          <Area
            key={s.key}
            yAxisId={s.axis === 'right' ? 'right' : 'left'}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#g-${s.key})`}
            dot={false}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
            connectNulls={false}
            hide={!!only && only !== s.key}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MiniLine({ data, color }: { data: { year: number; value: number | null }[]; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={44}>
      <LineChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.6} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------- distance bands */

export function BandBars({
  labels,
  counts,
  height = '100%',
  total,
}: {
  labels: string[];
  counts: number[];
  height?: number | string;
  total?: number;
}) {
  const sum = total ?? counts.reduce((a, b) => a + b, 0);
  const data = labels.map((label, i) => ({
    label,
    count: counts[i] ?? 0,
    share: sum ? ((counts[i] ?? 0) / sum) * 100 : 0,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      {/* horizontal bars: the band labels read straight across instead of being
          squeezed under a narrow x-axis */}
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 34, left: 2, bottom: 2 }}
        barCategoryGap="18%"
      >
        <CartesianGrid strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" {...AXIS} tick={{ fontSize: 9.5 }} />
        {/* the unit repeats on every tick and wraps the label — the panel
            subtitle carries it instead */}
        <YAxis
          type="category"
          dataKey="label"
          {...AXIS}
          width={46}
          interval={0}
          tick={{ fontSize: 9.5 }}
          tickFormatter={(v: string) => v.replace(/\s*км$/, '')}
        />
        <Tooltip
          cursor={{ fill: '#141d2755' }}
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <Box
                title={d.label}
                rows={[
                  { label: 'Бууц', value: n(d.count) },
                  { label: 'Эзлэх хувь', value: `${d.share.toFixed(1)}%` },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="count" radius={[2, 5, 5, 2]} maxBarSize={22}>
          {data.map((_, i) => {
            const colour = BAND_COLORS[Math.min(i, BAND_COLORS.length - 1)];
            return <Cell key={i} fill={colour} fillOpacity={0.18} stroke={colour} strokeWidth={0.7} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ radar */

export type RadarDatum = {
  idx: number; name: string; social: number; road: number; overall: number;
  /** the header metric, rescaled to 0–100 so it shares the wheel */
  sel?: number;
  /** that metric in its own units, for the tooltip */
  selRaw?: string;
};

/**
 * The 18 soums as spokes of one wheel, each carrying the two halves of the
 * composite index. Clicking a spoke label focuses that soum on the map.
 */
export function SoumRadar({
  data,
  active,
  onSelect,
  showLegend = true,
  selName,
  names = { social: 'Нийгмийн дэд бүтэц', road: 'Зам' },
  only: onlyProp,
  onOnly,
  height = '100%',
}: {
  data: RadarDatum[];
  active?: number | null;
  onSelect?: (idx: number | null) => void;
  showLegend?: boolean;
  /** label of the header metric; omitted when it duplicates an existing series */
  selName?: string | null;
  /** what the two base series are called on this board */
  names?: { social: string; road: string };
  /** isolation lifted out, so both half-wheels filter together */
  only?: string | null;
  onOnly?: (key: string | null) => void;
  height?: number | string;
}) {
  const [ownOnly, setOwnOnly] = useState<string | null>(null);
  const only = onlyProp !== undefined ? onlyProp : ownOnly;
  const setOnly = onOnly ?? setOwnOnly;
  const byName = new Map(data.map((d) => [d.name, d]));

  const Tick = ({ payload, x, y, textAnchor }: any) => {
    const d = byName.get(payload.value);
    const on = d && d.idx === active;
    return (
      <text
        x={x}
        y={y}
        dy={3}
        textAnchor={textAnchor}
        fontSize={8.5}
        fill={on ? '#e0a33c' : '#8b9aa9'}
        fontWeight={on ? 600 : 400}
        style={{ cursor: 'pointer' }}
        onClick={() => d && onSelect?.(d.idx === active ? null : d.idx)}
      >
        {payload.value}
      </text>
    );
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="min-h-0 min-w-0 flex-1">
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart
        data={data}
        outerRadius="73%"
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        onClick={(e: any) => {
          const d = byName.get(e?.activeLabel);
          if (d) onSelect?.(d.idx === active ? null : d.idx);
        }}
      >
        <PolarGrid stroke="#243141" gridType="polygon" />
        <PolarAngleAxis dataKey="name" tick={Tick} />
        {/* the scale sits at 70°, between two spokes, so it clears the labels */}
        <PolarRadiusAxis
          domain={[0, 100]}
          angle={70}
          tickCount={5}
          tickFormatter={(v: number) => (v === 50 || v === 100 ? String(v) : '')}
          axisLine={false}
          tick={{ fontSize: 7.5, fill: '#5c6b7a' }}
        />
        <Tooltip
          content={({ active: on, payload }: any) => {
            if (!on || !payload?.length) return null;
            const d = payload[0].payload as RadarDatum;
            return (
              <Box
                title={d.name}
                rows={[
                  { label: names.social, value: n(d.social, 1), color: SERIES.secondary },
                  { label: names.road, value: n(d.road, 1), color: SERIES.primary },
                  { label: 'Нэгдсэн', value: n(d.overall, 1), color: gradeColor(d.overall) },
                  ...(selName ? [{ label: selName, value: d.selRaw ?? n(d.sel ?? 0, 1), color: SERIES.muted }] : []),
                ]}
              />
            );
          }}
        />
        {only !== 'road' && only !== 'sel' && (
          <Radar name={names.social} dataKey="social" stroke={SERIES.secondary} fill={SERIES.secondary} fillOpacity={0.22} strokeWidth={1.6} dot={{ r: 2.8, strokeWidth: 1, stroke: '#070a0e', fill: SERIES.secondary }} />
        )}
        {only !== 'social' && only !== 'sel' && (
          <Radar name={names.road} dataKey="road" stroke={SERIES.primary} fill={SERIES.primary} fillOpacity={0.16} strokeWidth={1.6} dot={{ r: 2.8, strokeWidth: 1, stroke: '#070a0e', fill: SERIES.primary }} />
        )}
        {selName && only !== 'social' && only !== 'road' && (
          <Radar name={selName} dataKey="sel" stroke={SERIES.muted} fill={SERIES.muted} fillOpacity={0} strokeWidth={1.4} strokeDasharray="4 3" dot={{ r: 2.2, strokeWidth: 1, stroke: '#070a0e', fill: SERIES.muted }} />
        )}
      </RadarChart>
    </ResponsiveContainer>
      </div>
      {showLegend && (
        <BottomLegend
          only={only}
          onPick={setOnly}
          items={[
            { key: 'social', name: names.social, color: SERIES.secondary },
            { key: 'road', name: names.road, color: SERIES.primary },
            ...(selName ? [{ key: 'sel', name: selName, color: SERIES.muted }] : []),
          ]}
        />
      )}
    </div>
  );
}

/** Five index components on one wheel, optionally against the aimag mean. */
export function ProfileBars({
  data,
  name,
  score,
  highlight,
  showCompare = false,
  height = '100%',
}: {
  data: { axis: string; value: number; aimag: number }[];
  name: string;
  /** composite index, shown as a badge above the bars */
  score: number;
  /** the row the header metric refers to, drawn in the primary colour */
  highlight?: string | null;
  showCompare?: boolean;
  height?: number | string;
}) {
  const Tick = ({ payload, x, y }: any) => {
    const on = payload.value === highlight;
    return (
      <text x={x} y={y} dy={3} textAnchor="end" fontSize={9.5} fill={on ? '#e0a33c' : '#8b9aa9'} fontWeight={on ? 600 : 400}>
        {payload.value}
      </text>
    );
  };

  return (
    <div className="relative flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="pointer-events-none absolute right-1 top-0 z-10 flex items-baseline gap-1">
        <span className="text-[7.5px] tracking-wide text-ink-400">нэгдсэн индекс</span>
        <span className="num text-[14px] font-semibold leading-none" style={{ color: gradeColor(score) }}>
          {n(score, 1)}
        </span>
      </div>
      <div className="min-h-0 min-w-0 flex-1">
        <ResponsiveContainer width="100%" height={height}>
          {/* a serial chart reads the four pillars off one common 0–100 scale,
              which a wheel cannot do without distorting the shape */}
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 26, right: 30, left: 2, bottom: 2 }}
            barCategoryGap="22%"
          >
            <CartesianGrid strokeDasharray="2 4" horizontal={false} />
            <XAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} {...AXIS} tick={{ fontSize: 9 }} />
            <YAxis type="category" dataKey="axis" {...AXIS} width={54} interval={0} tick={Tick} />
            <Tooltip
              cursor={{ fill: '#141d2755' }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { axis: string; value: number; aimag: number };
                return (
                  <Box
                    title={d.axis}
                    rows={[
                      { label: name, value: n(d.value, 1), color: gradeColor(d.value) },
                      ...(showCompare ? [{ label: 'Аймгийн дундаж', value: n(d.aimag, 1), color: SERIES.muted }] : []),
                    ]}
                  />
                );
              }}
            />
            <Bar dataKey="value" name={name} radius={[2, 5, 5, 2]} maxBarSize={showCompare ? 11 : 18}>
              {data.map((d, i) => {
                const colour = gradeColor(d.value);
                return <Cell key={i} fill={colour} fillOpacity={0.18} stroke={colour} strokeWidth={0.7} />;
              })}
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: any) => n(Number(v), 1)}
                fontSize={9}
                fill="#b9c6d3"
                stroke="none"
              />
            </Bar>
            {showCompare && (
              <Bar
                dataKey="aimag"
                name="Аймгийн дундаж"
                radius={[2, 5, 5, 2]}
                maxBarSize={11}
                fill={SERIES.muted}
                fillOpacity={0.14}
                stroke={SERIES.muted}
                strokeWidth={0.7}
              />
            )}
            {showCompare && <Legend {...LEGEND} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- rankings */

export function RankBars({
  data,
  height = '100%',
  unit = '',
  colorByValue = true,
  color = '#e0a33c',
  domain,
  reference,
}: {
  data: { name: string; value: number }[];
  height?: number | string;
  unit?: string;
  colorByValue?: boolean;
  color?: string;
  domain?: [number, number];
  reference?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 22, left: 4, bottom: 0 }} barCategoryGap="16%">
        <CartesianGrid strokeDasharray="2 4" horizontal={false} />
        <XAxis type="number" domain={domain ?? [0, 'dataMax']} {...AXIS} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" {...AXIS} width={72} interval={0} tick={{ fontSize: 9.5 }} />
        <Tooltip cursor={{ fill: '#141d2755' }} content={tip((v) => `${n(v as number, 1)}${unit}`)} />
        {reference !== undefined && (
          <ReferenceLine
            x={reference}
            stroke="#8b9aa9"
            strokeDasharray="4 3"
            label={{ value: 'аймгийн дундаж', fill: '#64748b', fontSize: 10, position: 'top' }}
          />
        )}
        <Bar dataKey="value" name="Утга" radius={[0, 5, 5, 0]} maxBarSize={17}>
          {data.map((d, i) => (
            <Cell key={i} fill={colorByValue ? gradeColor(d.value) : color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* -------------------------------------------------------------- gauge/donut */

export function Gauge({
  value,
  label,
  sub,
  color,
  size = 132,
}: {
  value: number;
  label: string;
  sub?: string;
  color?: string;
  size?: number;
}) {
  const c = color ?? gradeColor(value);
  return (
    <div className="flex flex-col items-center">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="97%"
            data={[{ value }]}
            startAngle={220}
            endAngle={-40}
            barSize={9}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: '#141d27' }} dataKey="value" cornerRadius={9} fill={c} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {/* type scales with the dial so the reading never clips at small sizes */}
          <span
            className="num font-semibold leading-none"
            style={{ color: c, fontSize: Math.round(size * 0.2) }}
          >
            {value.toFixed(1)}
            <span style={{ fontSize: Math.round(size * 0.12) }}>%</span>
          </span>
        </div>
      </div>
      <div className="mt-0.5 text-center">
        <div className="text-[10.5px] font-medium leading-tight text-ink-100">{label}</div>
        {sub && <div className="text-[9.5px] leading-tight text-ink-500">{sub}</div>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- scatter */

export function ScatterPlot({
  data,
  xName,
  yName,
  xUnit = '',
  yUnit = '',
  height = '100%',
}: {
  data: { x: number; y: number; name: string; z?: number }[];
  xName: string;
  yName: string;
  xUnit?: string;
  yUnit?: string;
  height?: number | string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 12, right: 16, left: -12, bottom: 16 }}>
        <CartesianGrid strokeDasharray="2 4" />
        <XAxis
          type="number"
          dataKey="x"
          name={xName}
          {...AXIS}
          tick={{ fontSize: 10 }}
          label={{ value: xName, position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 10.5 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yName}
          {...AXIS}
          width={52}
          tick={{ fontSize: 10 }}
          label={{ value: yName, angle: -90, position: 'insideLeft', offset: 16, fill: '#64748b', fontSize: 10.5 }}
        />
        <ZAxis type="number" dataKey="z" range={[42, 300]} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: '#26333f' }}
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload;
            return (
              <Box
                title={d.name}
                rows={[
                  { label: xName, value: `${n(d.x, 1)}${xUnit}` },
                  { label: yName, value: `${n(d.y, 1)}${yUnit}` },
                ]}
              />
            );
          }}
        />
        <Scatter data={data} fill="#e0a33c" fillOpacity={0.78} stroke="#0b1016" strokeWidth={1}>
          {data.map((d, i) => (
            <Cell key={i} fill={gradeColor(Math.max(0, Math.min(100, d.y)))} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
