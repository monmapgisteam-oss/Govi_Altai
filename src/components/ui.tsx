import clsx from 'clsx';
import { gradeColor, gradeName } from '@/lib/format';

/**
 * Every page is laid out as a single non-scrolling screen: this wrapper owns the
 * full height and its children divide it with `min-h-0` flex/grid tracks.
 */
export function Screen({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col gap-2.5">{children}</div>;
}

/** Fills the remaining height with a 12-column grid. */
export function Board({
  children,
  rows = 2,
  template,
  className,
}: {
  children: React.ReactNode;
  rows?: number;
  /** explicit grid-template-rows, for boards whose rows are not equal height */
  template?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx('grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-12', className)}
      style={{ gridTemplateRows: template ?? `repeat(${rows}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  );
}

/** Page title row. Any children sit at the right end (mode switches, links). */
export function TopBar({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="rise flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <h1 className="min-w-0 flex-1 truncate text-[19px] font-semibold uppercase leading-tight tracking-[0.05em] text-ink-100">
        {title}
      </h1>
      {children}
    </header>
  );
}

/** Full-width KPI strip, sitting on its own row beneath the title. */
export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="panel rise flex w-full shrink-0 flex-wrap items-stretch divide-x divide-ink-800/80 overflow-hidden">
      {items.map((k) => (
        <div key={k.label} className="min-w-[104px] flex-1 px-3 py-2">
          <div className="truncate text-[9px] font-medium uppercase tracking-[0.09em] text-ink-500">
            {k.label}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span
              className={clsx(
                'num text-[17px] font-semibold leading-none tracking-tight',
                k.accent === 'sand' ? 'text-sand-400' : k.accent === 'teal' ? 'text-teal-500' : 'text-ink-100',
              )}
            >
              {k.value}
            </span>
            {k.unit && <span className="text-[10px] text-ink-500">{k.unit}</span>}
          </div>
          {k.sub && <div className="truncate text-[9.5px] leading-tight text-ink-500">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export type KpiItem = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: 'sand' | 'teal' | 'plain';
};

export function Panel({
  title,
  subtitle,
  action,
  className,
  bodyClass,
  scroll = false,
  children,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClass?: string;
  /** let the body scroll internally instead of clipping */
  scroll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={clsx('panel rise flex min-h-0 min-w-0 flex-col overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex shrink-0 items-start justify-between gap-2 px-3 pb-1 pt-2">
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-[11.5px] font-semibold tracking-tight text-ink-100">{title}</h2>
            )}
            {subtitle && (
              <p className="truncate text-[9.5px] leading-tight text-ink-500">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div
        className={clsx(
          'flex min-h-0 flex-1 flex-col px-3 pb-2.5',
          scroll && 'overflow-auto',
          bodyClass,
        )}
      >
        {children}
      </div>
    </section>
  );
}

/** Chart slot: gives ResponsiveContainer a definite height inside a flex column. */
export function Fill({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('min-h-0 min-w-0 flex-1', className)}>{children}</div>;
}

export function GradeChip({ score, showScore = true }: { score: number; showScore?: boolean }) {
  const c = gradeColor(score);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-medium"
      style={{ background: `${c}1f`, color: c, boxShadow: `inset 0 0 0 1px ${c}33` }}
    >
      <span className="size-1 rounded-full" style={{ background: c }} />
      {gradeName(score)}
      {showScore && <span className="num opacity-70">{score.toFixed(1)}</span>}
    </span>
  );
}

export function IndexBar({ value, color }: { value: number; color?: string }) {
  const c = color ?? gradeColor(value);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <div className="h-1.5 w-full min-w-[36px] overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: c }}
        />
      </div>
      <span className="num w-7 shrink-0 text-right text-[10.5px] text-ink-200">{value.toFixed(0)}</span>
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1 text-[9.5px] text-ink-400">
          <span className="size-2 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function StatRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-ink-800/70 py-[3px] last:border-0">
      <div className="min-w-0">
        <div className="truncate text-[11px] leading-tight text-ink-200">{label}</div>
        {hint && <div className="truncate text-[9.5px] leading-tight text-ink-600">{hint}</div>}
      </div>
      <div className="num shrink-0 text-[11.5px] font-medium text-ink-100">{value}</div>
    </div>
  );
}

/** Small metric tile used inside dense panels. */
export function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-ink-700/70 bg-ink-850/45 px-2 py-1.5">
      <div className="truncate text-[9px] uppercase tracking-[0.06em] text-ink-500">{label}</div>
      <div className="num mt-0.5 truncate text-[14px] font-semibold leading-none text-ink-100">{value}</div>
      {hint && <div className="truncate text-[9px] leading-tight text-ink-600">{hint}</div>}
    </div>
  );
}

/** Compact labelled progress row (road classes, grade counts, …). */
export function BarRow({
  label,
  value,
  share,
  color,
}: {
  label: string;
  value: string;
  share: number;
  color: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[10.5px] text-ink-200">{label}</span>
        <span className="num shrink-0 text-[10.5px] text-ink-300">{value}</span>
      </div>
      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.max(1.5, Math.min(100, share))}%`, background: color }}
        />
      </div>
    </div>
  );
}
