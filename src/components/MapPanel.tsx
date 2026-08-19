'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type MapViewType from './MapView';

const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="grid h-full min-h-[320px] w-full place-items-center rounded-xl border border-ink-700 bg-ink-900/60 text-[12px] text-ink-400">
      <div className="flex items-center gap-2">
        <span className="size-3 animate-spin rounded-full border-2 border-ink-600 border-t-sand-500" />
        Газрын зураг бэлдэж байна…
      </div>
    </div>
  ),
});

export default function MapPanel(props: ComponentProps<typeof MapViewType>) {
  return <MapView {...props} />;
}
