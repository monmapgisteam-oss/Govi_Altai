export const nf = new Intl.NumberFormat('mn-MN');

export const n = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : v.toLocaleString('mn-MN', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const pc = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${n(v, digits)}%`;

export const km = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${n(v, digits)} км`;

/** Hours -> "2ц 40м" */
export const hrs = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return h ? `${h}ц ${String(m).padStart(2, '0')}м` : `${m} мин`;
};

/** Five-step accessibility palette: good -> poor. */
export const GRADE_COLORS = ['#228b22', '#7cb342', '#ffeb3b', '#ff9800', '#e53935'];
export const GRADE_NAMES = ['Маш өндөр', 'Өндөр', 'Дунд', 'Бага', 'Маш бага'];

export const gradeIndex = (score: number) => Math.min(4, Math.max(0, Math.floor((100 - score) / 20)));
export const gradeColor = (score: number) => GRADE_COLORS[gradeIndex(score)];
export const gradeName = (score: number) => GRADE_NAMES[gradeIndex(score)];

/**
 * Distance bands reuse the very same five-step suitability palette, so a colour
 * carries one meaning across the whole app — map, bars and legends alike.
 */
export const BAND_COLORS = GRADE_COLORS;
