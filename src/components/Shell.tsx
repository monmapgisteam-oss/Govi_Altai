'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import Image from 'next/image';

type IconProps = { className?: string };
const svg = (d: React.ReactNode) =>
  function Icon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {d}
      </svg>
    );
  };

const GridIcon = svg(
  <>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </>,
);
const SchoolIcon = svg(
  <>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M5.5 10.5V16c0 1.7 2.9 3 6.5 3s6.5-1.3 6.5-3v-5.5" />
  </>,
);
const RoadIcon = svg(
  <>
    <path d="M7 3L5 21M17 3l2 18" />
    <path d="M12 4v3M12 10.5v3M12 17v3" />
  </>,
);
const TableIcon = svg(
  <>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M3 15h18M9 4v16" />
  </>,
);

const RAIL_KEY = 'ga-sidebar-rail';

/**
 * The nav. The three sub-boards stay routable by URL but are kept out of the
 * menu — flip `hidden` to false to bring one back.
 */
const NAV = [
  { href: '/', label: 'Ерөнхий самбар', icon: GridIcon, hidden: false },
  { href: '/education', label: 'Боловсролын хүртээмж', icon: SchoolIcon, hidden: true },
  { href: '/roads', label: 'Замын хүртээмж', icon: RoadIcon, hidden: true },
  { href: '/soums', label: 'Сумын харьцуулалт', icon: TableIcon, hidden: true },
].filter((x) => !x.hidden);

export default function Shell({
  children,
  generatedAt,
  webmapUrl,
}: {
  children: React.ReactNode;
  generatedAt: string;
  webmapUrl: string;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [rail, setRail] = useState(false);

  // remembered across visits; read after mount so the server and client markup match
  useEffect(() => {
    setRail(window.localStorage.getItem(RAIL_KEY) === '1');
  }, []);
  const toggleRail = () =>
    setRail((v) => {
      window.localStorage.setItem(RAIL_KEY, v ? '0' : '1');
      return !v;
    });

  // formatted from the ISO string, not via toLocaleString — a timezone- or
  // ICU-dependent render would differ between server and client and break hydration
  const stamp = `${generatedAt.slice(0, 10).replace(/-/g, '.')} ${generatedAt.slice(11, 16)} UTC`;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ---- sidebar ---- */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-ink-700/70 bg-ink-950/95 backdrop-blur-xl transition-[transform,width] duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
          rail && 'lg:w-[62px]',
        )}
      >
        <div
          className={clsx(
            'relative flex items-center gap-3 border-b border-ink-700/70 py-5',
            rail ? 'justify-center px-2' : 'px-4',
          )}
        >
          <Mark small={rail} />
          {!rail && (
            <div className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-ink-100">
              Говь-Алтай аймаг
            </div>
          )}
          <button
            onClick={toggleRail}
            aria-label={rail ? 'Цэсийг дэлгэх' : 'Цэсийг хумих'}
            title={rail ? 'Дэлгэх' : 'Хумих'}
            className={clsx(
              'hidden shrink-0 rounded-md p-1 text-ink-500 transition hover:bg-ink-800/60 hover:text-ink-100 lg:block',
              rail && 'absolute right-1 top-1',
            )}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9.5 4v16" />
              {rail ? <path d="M14 9.5l2.5 2.5L14 14.5" /> : <path d="M16.5 9.5L14 12l2.5 2.5" />}
            </svg>
          </button>
        </div>

        <nav className={clsx('flex-1 space-y-1 overflow-y-auto py-3', rail ? 'px-2' : 'px-3')}>
          {NAV.map((item) => {
            const active = item.href === '/' ? path === '/' : path.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                title={item.label}
                className={clsx(
                  'group flex items-center gap-3 rounded-xl py-2.5 transition',
                  rail ? 'justify-center px-2' : 'px-3',
                  active
                    ? 'bg-sand-500/12 text-ink-100 ring-1 ring-sand-500/25'
                    : 'text-ink-300 hover:bg-ink-800/60 hover:text-ink-100',
                )}
              >
                <Icon
                  className={clsx(
                    'size-4 shrink-0 transition',
                    active ? 'text-sand-500' : 'text-ink-400 group-hover:text-ink-200',
                  )}
                />
                {!rail && (
                  <span className="min-w-0 truncate text-[13px] font-medium leading-tight">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

      </aside>

      {open && (
        <button
          aria-label="Хаах"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink-950/70 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ---- content ---- */}
      <div
        className={clsx(
          'flex min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-200',
          rail ? 'lg:pl-[62px]' : 'lg:pl-[272px]',
        )}
      >
        <button
          onClick={() => setOpen(true)}
          className="fixed left-4 top-4 z-20 rounded-lg border border-ink-700 bg-ink-900/90 p-2 text-ink-200 backdrop-blur lg:hidden"
          aria-label="Цэс"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
          </svg>
        </button>
        {/* one screen, no page scroll from lg up; smaller viewports fall back to scrolling */}
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-6 pt-16 sm:px-4 lg:overflow-hidden lg:px-4 lg:pb-3 lg:pt-3">
          {children}
        </main>
      </div>
    </div>
  );
}

function Mark({ small = false }: { small?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="Говь-Алтай аймгийн сүлд"
      width={344}
      height={512}
      priority
      className={clsx('w-auto shrink-0 transition-[height] duration-200', small ? 'h-10' : 'h-16')}
    />
  );
}
