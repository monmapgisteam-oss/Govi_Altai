'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import esriConfig from '@arcgis/core/config';
import WebMap from '@arcgis/core/WebMap';
import EsriMapView from '@arcgis/core/views/MapView';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Attribution from '@arcgis/core/widgets/Attribution';
import Zoom from '@arcgis/core/widgets/Zoom';
import ScaleBar from '@arcgis/core/widgets/ScaleBar';
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import type Layer from '@arcgis/core/layers/Layer';
import type GeoJSONLayerView from '@arcgis/core/views/layers/GeoJSONLayerView';
import type Extent from '@arcgis/core/geometry/Extent';
import type { ResourceHandle } from '@arcgis/core/core/Handles';
import { GRADE_COLORS, GRADE_NAMES, gradeColor, n } from '@/lib/format';
import { METRICS, PICKABLE_METRICS, type MetricDef, type MetricKey } from '@/lib/metrics';

export { METRICS };
export type { MetricKey };

/** The user's web map — every basemap and symbology decision lives there. */
export const WEBMAP_ID = 'e5166cb6feab4301b7dc70de3bca6347';

const SDK_VERSION = '5.1';
const CDN = `https://js.arcgis.com/${SDK_VERSION}/@arcgis/core/assets`;

esriConfig.assetsPath = CDN;

export type CampColoring = 'none' | 'bandRoad' | 'bandSchool' | 'bandKg';

const CAMP_BAND_LABELS: Record<Exclude<CampColoring, 'none'>, string[]> = {
  bandRoad: ['0–2 км', '2–5 км', '5–10 км', '10–20 км', '20+ км'],
  bandSchool: ['0–10 км', '10–25 км', '25–50 км', '50–80 км', '80+ км'],
  bandKg: ['0–5 км', '5–15 км', '15–30 км', '30–50 км', '50+ км'],
};

type CampData = {
  n: number; lon: number[]; lat: number[]; soum: number[];
  dRoad: number[]; dNat: number[]; dCentre: number[]; travelH: number[];
  bandSchool: number[]; bandKg: number[]; bandRoad: number[];
};

const hexToRgba = (hex: string, a: number) => {
  const v = hex.replace('#', '');
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16), a];
};

/**
 * Five-class suitability renderer.
 * The palette is always the shared accessibility scale — Маш бага … Маш
 * өндөр — so a colour means the same thing on every map in the app.
 */
function suitabilityRenderer(def: MetricDef) {
  const colours = def.invert ? GRADE_COLORS : [...GRADE_COLORS].reverse();
  const names = def.invert ? GRADE_NAMES : [...GRADE_NAMES].reverse();
  const edges = [-Infinity, ...def.stops, Infinity];
  return {
    type: 'class-breaks' as const,
    field: def.key,
    classBreakInfos: colours.map((c, i) => ({
      minValue: edges[i],
      maxValue: edges[i + 1],
      label: `${names[i]} · ${classRange(def, i)}`,
      symbol: {
        type: 'simple-fill' as const,
        color: hexToRgba(c, 0.45),
        outline: { color: [255, 230, 90, 0.85], width: 0.45 },
      },
    })),
    defaultSymbol: {
      type: 'simple-fill' as const,
      color: [38, 51, 63, 0.45],
      outline: { color: [255, 230, 90, 0.85], width: 0.45 },
    },
  };
}

function classRange(def: MetricDef, i: number) {
  const d = def.digits ?? 0;
  const u = def.unit ?? '';
  const s = def.stops;
  if (i === 0) return `< ${n(s[0], d)}${u}`;
  if (i === s.length) return `> ${n(s[s.length - 1], d)}${u}`;
  return `${n(s[i - 1], d)}–${n(s[i], d)}${u}`;
}

function campRenderer(field: Exclude<CampColoring, 'none'>) {
  return {
    type: 'unique-value' as const,
    field,
    uniqueValueInfos: CAMP_BAND_LABELS[field].map((label, i) => ({
      value: i,
      label,
      symbol: {
        type: 'simple-marker' as const,
        style: 'circle' as const,
        size: 2.2,
        color: hexToRgba(GRADE_COLORS[i], 0.85),
        outline: { width: 0 },
      },
    })),
    defaultSymbol: {
      type: 'simple-marker' as const,
      style: 'circle' as const,
      size: 2,
      color: [139, 154, 169, 0.7],
      outline: { width: 0 },
    },
  };
}

export default function MapView({
  metric: initialMetric = 'overallIndex',
  /** supply this to drive the metric from outside; the in-map picker is then hidden */
  onMetricChange,
  metricPicker = true,
  campColoring = 'none',
  showCamps = false,
  /** focus the selected soum: filter the analysis layers to it and zoom in */
  focusSelection = false,
  height = 520,
  onSelectSoum,
  selectedSoum,
}: {
  metric?: MetricKey;
  onMetricChange?: (m: MetricKey) => void;
  metricPicker?: boolean;
  campColoring?: CampColoring;
  /** start with the analysis camp layer switched on */
  showCamps?: boolean;
  focusSelection?: boolean;
  height?: number | string;
  onSelectSoum?: (idx: number | null) => void;
  selectedSoum?: number | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<EsriMapView | null>(null);
  const soumLayer = useRef<GeoJSONLayer | null>(null);
  const campLayer = useRef<GeoJSONLayer | null>(null);
  const soumLV = useRef<GeoJSONLayerView | null>(null);
  const highlight = useRef<ResourceHandle | null>(null);
  const blobUrl = useRef<string | null>(null);
  const userMoved = useRef(false);
  const fullExtent = useRef<Extent | null>(null);
  const selectRef = useRef(onSelectSoum);
  selectRef.current = onSelectSoum;
  // the pointer handler is bound once, so it reads the live metric off a ref
  const defRef = useRef<MetricDef | null>(null);
  const hitBusy = useRef(false);

  const [ready, setReady] = useState(false);
  const [innerMetric, setInnerMetric] = useState<MetricKey>(initialMetric);
  const metric = onMetricChange ? initialMetric : innerMetric;
  const [panelOpen, setPanelOpen] = useState(false);
  const [webLayers, setWebLayers] = useState<{ id: string; title: string; visible: boolean }[]>([]);
  const [analysis, setAnalysis] = useState({ soums: true, camps: showCamps && campColoring !== 'none' });
  const [hover, setHover] = useState<{
    x: number;
    y: number;
    name: string;
    score: number;
    rows: { label: string; value: string }[];
  } | null>(null);

  const def = useMemo(() => METRICS.find((m) => m.key === metric) ?? METRICS[0], [metric]);
  defRef.current = def;

  /* --------------------------------------------------- stylesheet (CDN) --- */
  useEffect(() => {
    const id = 'arcgis-theme';
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `${CDN}/esri/themes/dark/main.css`;
    document.head.appendChild(link);
  }, []);

  /* ------------------------------------------------------------- the map --- */
  useEffect(() => {
    if (!box.current || view.current) return;
    let disposed = false;

    const map = new WebMap({ portalItem: { id: WEBMAP_ID } });
    const v = new EsriMapView({
      container: box.current,
      map,
      ui: { components: [] },
      // snapToZoom defaults to true, which rounds a fitted extent down to the
      // basemap's nearest whole LOD — at some panel sizes that lands a full zoom
      // level out and leaves the aimag floating in a sea of neighbours
      constraints: { rotationEnabled: false, snapToZoom: false, minZoom: 4, maxZoom: 14 },
      // no click-through popups anywhere — soum detail lives in the side panels,
      // and the web map's own popups would otherwise fire on every layer
      popupEnabled: false,
    });
    view.current = v;
    v.ui.add(new Zoom({ view: v }), 'top-right');
    v.ui.add(new Attribution({ view: v }), 'bottom-right');
    // the legend owns the bottom-left corner now, so the scale bar moves across
    v.ui.add(new ScaleBar({ view: v, unit: 'metric' }), 'bottom-right');

    (async () => {
      await map.loadAll().catch(() => map.load());
      if (disposed) return;

      // ---- analysis overlay: soum suitability, painted on the five-step scale
      const soums = new GeoJSONLayer({
        url: '/data/geo/soums.geojson',
        title: 'Шинжилгээ · сумын хүртээмжийн зэрэглэл',
        // hit-test graphics only carry the fields needed for drawing unless we
        // ask for the rest — the click handler reads `idx` off them
        outFields: ['*'],
        renderer: suitabilityRenderer(def) as never,
        opacity: 1,
        labelsVisible: true,
        labelingInfo: [
          {
            labelExpressionInfo: { expression: '$feature.name' },
            labelPlacement: 'always-horizontal',
            symbol: {
              type: 'text',
              color: [14, 20, 28, 1],
              haloColor: [255, 255, 255, 0.85],
              haloSize: 1.4,
              font: { size: 8.5, family: 'sans-serif', weight: 'bold' },
            },
          },
        ] as never,
      });
      soumLayer.current = soums;
      // Sit directly above the web map's own polygon layers but below its lines
      // and points. Lower than that and the soum choropleths in the web map
      // ("… ТОО") cover the grading completely; higher and the roads, railways
      // and camp points would be buried under it.
      const opLayers = map.layers.toArray();
      let insertAt = 0;
      for (let i = 0; i < opLayers.length; i++) {
        const g = (opLayers[i] as { geometryType?: string }).geometryType;
        if (g === 'polygon' || g === undefined) insertAt = i + 1;
        else break;
      }
      map.add(soums, insertAt);

      // ---- analysis overlay: camps by distance band
      const raw: CampData = await (await fetch('/data/camps.json')).json();
      if (disposed) return;
      const fc = {
        type: 'FeatureCollection',
        features: Array.from({ length: raw.n }, (_, i) => ({
          type: 'Feature',
          id: i,
          properties: {
            OBJECTID: i + 1,
            soum: raw.soum[i],
            dRoad: raw.dRoad[i],
            dNat: raw.dNat[i],
            dCentre: raw.dCentre[i],
            travelH: raw.travelH[i],
            bandRoad: raw.bandRoad[i],
            bandSchool: raw.bandSchool[i],
            bandKg: raw.bandKg[i],
          },
          geometry: { type: 'Point', coordinates: [raw.lon[i], raw.lat[i]] },
        })),
      };
      blobUrl.current = URL.createObjectURL(new Blob([JSON.stringify(fc)], { type: 'application/json' }));

      const camps = new GeoJSONLayer({
        url: blobUrl.current,
        title: 'Шинжилгээ · бууц зайн бүсээр',
        outFields: ['*'],
        objectIdField: 'OBJECTID',
        renderer: campRenderer(campColoring === 'none' ? 'bandRoad' : campColoring) as never,
        visible: showCamps && campColoring !== 'none',
      });
      campLayer.current = camps;
      map.add(camps);

      await v.when();
      if (disposed) return;

      // frame the aimag — the panel is still settling into its grid track when
      // the view first reports a size, so refit whenever the size changes until
      // the user takes over. This also keeps the framing right on window resize.
      await reactiveUtils.whenOnce(() => v.ready && v.width > 0 && v.height > 0);
      const full = soums.fullExtent ?? (await soums.queryExtent().catch(() => null))?.extent ?? null;
      fullExtent.current = full;
      const fit = () => {
        if (!full || userMoved.current) return;
        v.goTo({ target: full.clone().expand(1.04) }, { animate: false }).catch(() => {});
      };
      fit();
      for (const ev of ['drag', 'mouse-wheel', 'double-click', 'key-down'] as const)
        v.on(ev, () => { userMoved.current = true; });
      reactiveUtils.watch(() => [v.width, v.height].join('x'), fit);

      setWebLayers(
        (map.layers.toArray() as Layer[])
          .filter((l) => !(l.title ?? '').startsWith('Шинжилгээ'))
          .map((l) => ({ id: l.id, title: l.title ?? l.id, visible: l.visible }))
          .reverse(),
      );

      soumLV.current = await v.whenLayerView(soums);

      v.on('click', async (e) => {
        const hit = await v.hitTest(e, { include: [soums] }).catch(() => null);
        const g = hit?.results.find((r) => r.type === 'graphic');
        const idx = g && 'graphic' in g ? (g.graphic.attributes?.idx as number | undefined) : undefined;
        selectRef.current?.(idx ?? null);
      });

      // hover read-out: the soum under the cursor, headed by the active metric
      v.on('pointer-move', async (e) => {
        if (hitBusy.current) return;
        hitBusy.current = true;
        const hit = await v.hitTest(e, { include: [soums] }).catch(() => null);
        hitBusy.current = false;
        const g = hit?.results.find((r) => r.type === 'graphic');
        const a = g && 'graphic' in g ? (g.graphic.attributes as Record<string, number | string>) : null;
        if (!a) {
          setHover(null);
          return;
        }
        const d = defRef.current ?? METRICS[0];
        const raw = Number(a[d.key] ?? 0);
        setHover({
          x: e.x,
          y: e.y,
          name: String(a.name),
          score: Number(a.overallIndex ?? 0),
          rows: [
            { label: d.label, value: `${n(raw, d.digits ?? 0)}${d.unit ?? ''}` },
            ...(d.key === 'overallIndex'
              ? []
              : [{ label: 'Нэгдсэн индекс', value: n(Number(a.overallIndex ?? 0), 1) }]),
            { label: 'Хүн ам', value: n(Number(a.population ?? 0)) },
            { label: 'Өрх', value: n(Number(a.households ?? 0)) },
            { label: 'Өвөлжөө, хаваржаа', value: n(Number(a.camps ?? 0)) },
            { label: 'Авто зам', value: `${n(Number(a.roadKm ?? 0), 0)} км` },
          ],
        });
      });

      v.on('pointer-leave', () => setHover(null));

      setReady(true);
    })();

    return () => {
      disposed = true;
      highlight.current?.remove();
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      view.current?.destroy();
      view.current = null;
      soumLayer.current = null;
      campLayer.current = null;
      soumLV.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ----------------------------------------------------- renderer updates --- */
  useEffect(() => {
    if (soumLayer.current) soumLayer.current.renderer = suitabilityRenderer(def) as never;
  }, [def]);

  useEffect(() => {
    if (campLayer.current && campColoring !== 'none')
      campLayer.current.renderer = campRenderer(campColoring) as never;
  }, [campColoring]);

  /* --------------------------------------------------------- visibility --- */
  useEffect(() => {
    if (soumLayer.current) soumLayer.current.visible = analysis.soums;
    if (campLayer.current) campLayer.current.visible = analysis.camps;
  }, [analysis]);

  /* ---------------------------------------------------- soum highlighting --- */
  useEffect(() => {
    const lv = soumLV.current;
    const layer = soumLayer.current;
    if (!lv || !layer || !ready) return;
    highlight.current?.remove();
    highlight.current = null;
    if (selectedSoum === null || selectedSoum === undefined) return;
    layer
      .queryFeatures({ where: `idx = ${selectedSoum}`, returnGeometry: false, outFields: ['*'] })
      .then((res) => {
        if (res.features.length) highlight.current = lv.highlight(res.features);
      })
      .catch(() => {});
  }, [selectedSoum, ready]);

  /* --------------------------------------------- focus: filter + zoom in --- */
  useEffect(() => {
    const soums = soumLayer.current;
    const camps = campLayer.current;
    const v = view.current;
    if (!soums || !v || !ready || !focusSelection) return;

    if (selectedSoum === null || selectedSoum === undefined) {
      soums.featureEffect = null as never;
      if (camps) camps.definitionExpression = undefined as never;
      userMoved.current = false;
      if (fullExtent.current)
        v.goTo({ target: fullExtent.current.clone().expand(1.04) }, { duration: 550 }).catch(() => {});
      return;
    }

    const where = `idx = ${selectedSoum}`;
    soums.featureEffect = {
      filter: { where },
      excludedEffect: 'opacity(12%) grayscale(70%)',
    } as never;
    if (camps) camps.definitionExpression = `soum = ${selectedSoum}`;

    soums
      .queryExtent({ where })
      .then((r) => {
        if (!r.extent) return;
        userMoved.current = true; // a focused view must survive the resize refit
        return v.goTo({ target: r.extent.clone().expand(1.35) }, { duration: 550 });
      })
      .catch(() => {});
  }, [selectedSoum, ready, focusSelection]);

  const toggleWebLayer = (id: string) => {
    const map = view.current?.map;
    const l = map?.findLayerById(id);
    if (!l) return;
    l.visible = !l.visible;
    setWebLayers((s) => s.map((x) => (x.id === id ? { ...x, visible: l.visible } : x)));
  };

  // classes run low -> high on the map; the legend lists them best -> worst
  const classOrder = def.invert ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  const legendRows = classOrder.map((i) => ({
    colour: (def.invert ? GRADE_COLORS : [...GRADE_COLORS].reverse())[i],
    name: (def.invert ? GRADE_NAMES : [...GRADE_NAMES].reverse())[i],
    range: classRange(def, i),
  }));
  const activeCount =
    webLayers.filter((l) => l.visible).length + (analysis.soums ? 1 : 0) + (analysis.camps ? 1 : 0);

  return (
    <div
      className={clsx(
        'relative overflow-hidden rounded-xl border border-ink-700 bg-ink-950',
        height === '100%' && 'min-h-0 flex-1',
      )}
      style={{ height }}
    >
      <div ref={box} style={{ position: 'absolute', inset: 0 }} />

      {/* metric picker */}
      {metricPicker && !onMetricChange && (
        <div className="absolute left-3 top-3 z-10 max-w-[min(320px,calc(100%-92px))]">
          <select
            value={metric}
            onChange={(e) => setInnerMetric(e.target.value as MetricKey)}
            className="w-full cursor-pointer truncate rounded-lg border border-ink-600 bg-ink-900/92 px-2.5 py-1.5 text-[11.5px] text-ink-100 shadow-lg outline-none backdrop-blur hover:border-sand-500/50 focus:border-sand-500"
          >
            {PICKABLE_METRICS.map((mm) => (
              <option key={mm.key} value={mm.key} className="bg-ink-900">
                {mm.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* layer panel — the user's own web-map layers plus the analysis overlays */}
      <div className={clsx('absolute left-3 z-10', metricPicker && !onMetricChange ? 'top-14' : 'top-3')}>
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className={clsx(
            'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] backdrop-blur transition',
            panelOpen
              ? 'border-sand-600/70 bg-ink-100/72 text-ink-950'
              : 'border-ink-400/50 bg-ink-100/62 text-ink-800 hover:text-ink-950',
          )}
        >
          <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M12 3l9 5-9 5-9-5 9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
          Давхарга
          <span className="num text-ink-600">{activeCount}</span>
        </button>

        {panelOpen && (
          <div className="mt-1 max-h-[min(52vh,420px)] w-[228px] overflow-y-auto rounded-xl border border-ink-400/50 bg-ink-100/72 p-1.5 shadow-lg backdrop-blur">
            <div className="px-1.5 pb-1 pt-0.5 text-[9px] font-medium tracking-wide text-ink-600/80">
              Шинжилгээний давхарга
            </div>
            <Toggle
              label="Сумын хүртээмжийн зэрэглэл"
              on={analysis.soums}
              onClick={() => setAnalysis((s) => ({ ...s, soums: !s.soums }))}
            />
            <Toggle
              label="Өвөлжөө, хаваржаа · зайн бүсээр"
              on={analysis.camps}
              disabled={campColoring === 'none'}
              onClick={() => setAnalysis((s) => ({ ...s, camps: !s.camps }))}
            />

            <div className="mt-1.5 border-t border-ink-400/50 px-1.5 pb-1 pt-1.5 text-[9px] font-medium tracking-wide text-ink-600/80">
              Вэб газрын зураг · эх загвар
            </div>
            {webLayers.length === 0 && (
              <div className="px-1.5 py-1 text-[10px] text-ink-600">ачаалж байна…</div>
            )}
            {webLayers.map((l) => (
              <Toggle key={l.id} label={l.title} on={l.visible} onClick={() => toggleWebLayer(l.id)} />
            ))}
          </div>
        )}
      </div>

      {/* focus reset — only while a soum is filtered in */}
      {focusSelection && selectedSoum !== null && selectedSoum !== undefined && (
        <button
          onClick={() => onSelectSoum?.(null)}
          className={clsx(
            'absolute left-3 z-10 flex items-center gap-1.5 rounded-lg border border-sand-600/70 bg-ink-100/72 px-2 py-1 text-[10.5px] text-ink-950 backdrop-blur transition hover:border-sand-600',
            metricPicker && !onMetricChange ? 'top-[88px]' : 'top-11',
          )}
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 3.5L5.5 8L10 12.5" />
          </svg>
          Бүх аймаг
        </button>
      )}

      {/* legend — the five-step suitability scale */}
      {/* bottom-left, clearing the scale bar that Esri parks in the same corner */}
      <div className="pointer-events-none absolute bottom-9 left-3 z-10 max-w-[228px] rounded-xl border border-ink-400/50 bg-ink-100/70 p-2.5 shadow-lg backdrop-blur">
        <div className="mb-1.5 text-[10px] font-medium tracking-wide text-ink-800">
          {def.label}
        </div>
        <div className="space-y-[3px]">
          {legendRows.map((r) => (
            <div key={r.name} className="flex items-center gap-1.5 text-[9.5px] leading-tight">
              <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: r.colour }} />
              <span className="w-[72px] shrink-0 truncate text-ink-900">{r.name}</span>
              <span className="num truncate text-ink-600">{r.range}</span>
            </div>
          ))}
        </div>
        {analysis.camps && campColoring !== 'none' && (
          <div className="mt-2 border-t border-ink-400/50 pt-1.5">
            <div className="mb-1 text-[10px] font-medium tracking-wide text-ink-800">
              Өвөлжөө, хаваржаа
            </div>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
              {CAMP_BAND_LABELS[campColoring].map((l, i) => (
                <span key={l} className="flex items-center gap-1 text-[9px] text-ink-800">
                  <span className="size-1.5 rounded-full" style={{ background: GRADE_COLORS[i] }} />
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-20 w-[198px] rounded-xl border border-ink-400/50 bg-ink-100/88 p-2 shadow-xl backdrop-blur"
          style={{
            left: Math.min(hover.x + 14, (box.current?.clientWidth ?? 0) - 208),
            top: Math.min(hover.y + 14, (box.current?.clientHeight ?? 0) - 132),
          }}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <span className="size-2 shrink-0 rounded-full" style={{ background: gradeColor(hover.score) }} />
            <span className="truncate text-[11px] font-semibold text-ink-950">{hover.name}</span>
          </div>
          <div className="space-y-[2px]">
            {hover.rows.map((r, i) => (
              <div
                key={r.label}
                className={clsx(
                  'flex items-baseline justify-between gap-2 text-[9.5px]',
                  i === 0 && 'border-b border-ink-400/40 pb-[3px] font-medium',
                )}
              >
                <span className="truncate text-ink-700">{r.label}</span>
                <span className="num shrink-0 text-ink-950">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!ready && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-ink-950/70 text-[12px] text-ink-400 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="size-3 animate-spin rounded-full border-2 border-ink-600 border-t-sand-500" />
            Вэб газрын зураг ачаалж байна…
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  on,
  onClick,
  disabled,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={clsx(
        'flex w-full items-start gap-2 rounded-md px-1.5 py-[3px] text-left text-[10px] leading-tight transition',
        disabled ? 'cursor-not-allowed text-ink-400' : on ? 'text-ink-950' : 'text-ink-600 hover:text-ink-950',
      )}
    >
      <span
        className={clsx(
          'mt-[1px] grid size-3 shrink-0 place-items-center rounded-[3px] border transition',
          disabled ? 'border-ink-300' : on ? 'border-sand-600 bg-sand-600' : 'border-ink-400',
        )}
      >
        {on && !disabled && (
          <svg viewBox="0 0 10 10" className="size-2 text-ink-100" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1.5 5.2L4 7.6L8.6 2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="line-clamp-2">{label}</span>
    </button>
  );
}
