import { useId, useState } from 'react';
import { cx } from '@/lib/format';

/**
 * Chart primitives for the creator and admin dashboards.
 *
 * The categorical palette below was validated with the data-visualisation
 * validator for both surfaces: OKLCH lightness band, chroma floor, adjacent-pair
 * separation under deuteranopia and tritanopia, normal-vision separation, and
 * 3:1 contrast against the chart surface. Light steps are validated against the
 * cream surface, dark steps are a separate selection validated against the deep
 * navy surface — not an automatic flip of the light values.
 *
 * Hues are assigned in fixed order and never cycled: a fifth series folds into
 * "Other" rather than generating a new colour.
 */
export const SERIES_LIGHT = ['#2C63B5', '#B07F2E', '#7B54B8', '#12876A'] as const;
export const SERIES_DARK = ['#4A85D6', '#B5852F', '#9375CE', '#28A07B'] as const;

function useSeriesColors(): readonly string[] {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return dark ? SERIES_DARK : SERIES_LIGHT;
}

export interface Point {
  date: string;
  value: number;
}

export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger';
}) {
  const tones = {
    neutral: '',
    good: 'text-verified',
    warn: 'text-warn',
    danger: 'text-danger',
  };
  return (
    <div className="ft-card p-4">
      <p className="text-xs font-medium ft-muted">{label}</p>
      {/* The number is the headline — no chart, no color-coding of the label. */}
      <p className={cx('mt-1 font-display text-2xl font-semibold tabular-nums', tones[tone])}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs ft-muted">{hint}</p> : null}
    </div>
  );
}

/**
 * Single-series line chart with a crosshair and tooltip. One series means no
 * legend box — the title names it.
 */
export function LineChart({
  data,
  label,
  height = 180,
  colorIndex = 0,
  formatValue = (value: number) => String(value),
}: {
  data: Point[];
  label: string;
  height?: number;
  colorIndex?: number;
  formatValue?: (value: number) => string;
}) {
  const colors = useSeriesColors();
  const colour = colors[colorIndex % colors.length];
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (!data.length) {
    return <p className="py-10 text-center text-sm ft-muted">No data for this period yet.</p>;
  }

  const width = 720;
  const padding = { top: 10, right: 8, bottom: 22, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((point) => point.value));

  const x = (index: number) => padding.left + (data.length === 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - (value / max) * innerHeight;

  const linePath = data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${x(data.length - 1).toFixed(1)} ${padding.top + innerHeight} L ${x(0).toFixed(1)} ${padding.top + innerHeight} Z`;

  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={`${label}: ${data.length} days, peak ${formatValue(max)}`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left) / rect.width;
          const index = Math.round(ratio * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, index)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity="0.22" />
            <stop offset="100%" stopColor={colour} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Recessive gridlines — three is enough to read magnitude. */}
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerHeight * ratio}
            y2={padding.top + innerHeight * ratio}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
          />
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {hover !== null ? (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padding.top}
              y2={padding.top + innerHeight}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            {/* A surface ring keeps the marker legible where it overlaps the line. */}
            <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill={colour} stroke="var(--chart-surface, #FBF7EF)" strokeWidth="2" />
          </>
        ) : null}

        <text x={padding.left} y={height - 4} className="fill-current text-[10px] opacity-45">
          {data[0].date.slice(5)}
        </text>
        <text x={width - padding.right} y={height - 4} textAnchor="end" className="fill-current text-[10px] opacity-45">
          {data[data.length - 1].date.slice(5)}
        </text>
      </svg>

      {active ? (
        <div
          className="pointer-events-none absolute top-0 rounded-lg bg-navy px-2.5 py-1.5 text-xs text-cream shadow-lift"
          style={{ left: `${(x(hover!) / width) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <span className="block opacity-70">{active.date}</span>
          <span className="font-semibold tabular-nums">{formatValue(active.value)}</span>
        </div>
      ) : null}

      <figcaption className="sr-only">
        {label}. Values by day: {data.map((point) => `${point.date}: ${formatValue(point.value)}`).join(', ')}.
      </figcaption>
    </figure>
  );
}

/**
 * Horizontal bars for a small labelled set. Every bar is directly labelled, so
 * identity never depends on colour.
 */
export function BarList({
  items,
  formatValue = (value: number) => String(value),
}: {
  items: Array<{ label: string; value: number }>;
  formatValue?: (value: number) => string;
}) {
  const colors = useSeriesColors();
  const max = Math.max(1, ...items.map((item) => item.value));

  if (!items.length) return <p className="py-6 text-center text-sm ft-muted">No data yet.</p>;

  return (
    <ul className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums ft-muted">{formatValue(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-navy/[0.07] dark:bg-white/[0.08]">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, backgroundColor: colors[index % colors.length] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Retention curve — a single series, so it needs no legend. */
export function RetentionCurve({ data }: { data: Array<{ percent: number; retention: number }> }) {
  const colors = useSeriesColors();
  const colour = colors[0];
  if (!data.length) return <p className="py-6 text-center text-sm ft-muted">Not enough watch data yet.</p>;

  const width = 720;
  const height = 160;
  const padding = 16;
  const x = (index: number) => padding + (index / (data.length - 1)) * (width - padding * 2);
  const y = (value: number) => padding + (1 - value / 100) * (height - padding * 2);

  const path = data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.retention).toFixed(1)}`).join(' ');

  return (
    <figure>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Audience retention across the video">
        {[0, 50, 100].map((value) => (
          <line
            key={value}
            x1={padding}
            x2={width - padding}
            y1={y(value)}
            y2={y(value)}
            stroke="currentColor"
            strokeOpacity="0.08"
          />
        ))}
        <path d={path} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] opacity-50">
        <span>Start</span>
        <span>Halfway</span>
        <span>End</span>
      </div>
      <figcaption className="sr-only">
        Retention: {data.map((point) => `${point.percent}% in: ${point.retention}% still watching`).join(', ')}.
      </figcaption>
    </figure>
  );
}

/** Two-series comparison with a legend, used on the admin overview. */
export function DualSeriesChart({
  series,
  height = 190,
  formatValue = (value: number) => String(value),
}: {
  series: Array<{ label: string; data: Point[] }>;
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const colors = useSeriesColors();
  const [hover, setHover] = useState<number | null>(null);

  const length = Math.max(...series.map((entry) => entry.data.length), 0);
  if (!length) return <p className="py-10 text-center text-sm ft-muted">No data for this period yet.</p>;

  const width = 720;
  const padding = { top: 10, right: 8, bottom: 22, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Both series share one scale. A second y-axis would make the comparison a lie.
  const max = Math.max(1, ...series.flatMap((entry) => entry.data.map((point) => point.value)));
  const x = (index: number) => padding.left + (length === 1 ? innerWidth / 2 : (index / (length - 1)) * innerWidth);
  const y = (value: number) => padding.top + innerHeight - (value / max) * innerHeight;

  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-4">
        {series.map((entry, index) => (
          <span key={entry.label} className="flex items-center gap-1.5 text-xs ft-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors[index % colors.length] }} aria-hidden />
            {entry.label}
          </span>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label={series.map((entry) => entry.label).join(' and ')}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const index = Math.round(((event.clientX - rect.left) / rect.width) * (length - 1));
          setHover(Math.max(0, Math.min(length - 1, index)));
        }}
      >
        {[0, 0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerHeight * ratio}
            y2={padding.top + innerHeight * ratio}
            stroke="currentColor"
            strokeOpacity="0.08"
          />
        ))}

        {series.map((entry, seriesIndex) => (
          <path
            key={entry.label}
            d={entry.data.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(' ')}
            fill="none"
            stroke={colors[seriesIndex % colors.length]}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hover !== null ? (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padding.top}
              y2={padding.top + innerHeight}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeDasharray="3 3"
            />
            {series.map((entry, seriesIndex) =>
              entry.data[hover] ? (
                <circle
                  key={entry.label}
                  cx={x(hover)}
                  cy={y(entry.data[hover].value)}
                  r="5"
                  fill={colors[seriesIndex % colors.length]}
                  stroke="var(--chart-surface, #FBF7EF)"
                  strokeWidth="2"
                />
              ) : null,
            )}
          </>
        ) : null}
      </svg>

      {hover !== null ? (
        <p className="mt-1 text-center text-xs ft-muted">
          <span className="font-medium">{series[0].data[hover]?.date}</span>
          {series.map((entry) => ` · ${entry.label}: ${formatValue(entry.data[hover]?.value ?? 0)}`).join('')}
        </p>
      ) : null}

      <figcaption className="sr-only">
        {series.map((entry) => `${entry.label}: ${entry.data.map((point) => `${point.date} ${formatValue(point.value)}`).join(', ')}`).join('. ')}
      </figcaption>
    </figure>
  );
}
