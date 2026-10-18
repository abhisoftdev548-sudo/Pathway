import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EmptyState } from './States';

const AXIS = { stroke: '#9aa0ad', fontSize: 11 };
const GRID = { stroke: '#e4e6ec', strokeDasharray: '3 3' };

export interface SeriesDef {
  key: string;
  label: string;
  color: string;
}

const SERIES_COLORS = ['#6139cd', '#0e9f6e', '#d97706', '#0284c7', '#be123c'];

export function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

/**
 * Charts render only real data. When the series has no non-zero points we show
 * an explicit empty state rather than drawing a synthetic line.
 */
function hasAnyData(data: Record<string, unknown>[], keys: string[]): boolean {
  return data.some((row) => keys.some((key) => Number(row[key] ?? 0) !== 0));
}

export function ChartFrame({
  title,
  description,
  height = 240,
  children,
  empty,
}: {
  title?: string;
  description?: string;
  height?: number;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <section className="surface p-4">
      {title && (
        <header className="mb-3">
          <h3 className="text-[13px] font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
        </header>
      )}
      <div style={{ height }}>
        {empty ? (
          <EmptyState
            compact
            title="No data in this range yet"
            description="Chart data appears once there is recorded activity."
            className="h-full border-none bg-transparent"
          />
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function TimeSeriesChart({
  data,
  series,
  xKey = 'day',
  height = 240,
  title,
  description,
  area = true,
}: {
  data: Record<string, unknown>[];
  series: SeriesDef[];
  xKey?: string;
  height?: number;
  title?: string;
  description?: string;
  area?: boolean;
}) {
  const empty = data.length === 0 || !hasAnyData(data, series.map((s) => s.key));
  const Chart = area ? AreaChart : LineChart;

  return (
    <ChartFrame title={title} description={description} height={height} empty={empty}>
      <ResponsiveContainer width="100%" height="100%">
        <Chart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid {...GRID} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: '#e4e6ec' }}
            tickFormatter={(value: string) => value?.slice(5) ?? value}
            minTickGap={16}
          />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: '1px solid #e4e6ec',
              fontSize: 12,
              boxShadow: '0 8px 24px -6px rgb(16 18 27 / 0.16)',
            }}
            labelStyle={{ color: '#4a4f5c', fontWeight: 600 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="plainline" />
          {series.map((s) =>
            area ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                fill={s.color}
                fillOpacity={0.08}
                strokeWidth={1.75}
                dot={false}
              />
            ) : (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={1.75} dot={false} />
            ),
          )}
        </Chart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function BarSeriesChart({
  data,
  series,
  xKey = 'name',
  height = 240,
  title,
  description,
  layout = 'vertical',
}: {
  data: Record<string, unknown>[];
  series: SeriesDef[];
  xKey?: string;
  height?: number;
  title?: string;
  description?: string;
  layout?: 'vertical' | 'horizontal';
}) {
  const empty = data.length === 0 || !hasAnyData(data, series.map((s) => s.key));
  const horizontal = layout === 'horizontal';

  return (
    <ChartFrame title={title} description={description} height={height} empty={empty}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={horizontal ? 'horizontal' : 'vertical'}
          margin={{ top: 4, right: 12, bottom: 0, left: horizontal ? -18 : 8 }}
        >
          <CartesianGrid {...GRID} vertical={horizontal} horizontal={!horizontal} />
          {horizontal ? (
            <>
              <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: '#e4e6ec' }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            </>
          ) : (
            <>
              <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={AXIS}
                tickLine={false}
                axisLine={{ stroke: '#e4e6ec' }}
                width={110}
              />
            </>
          )}
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: '1px solid #e4e6ec',
              fontSize: 12,
              boxShadow: '0 8px 24px -6px rgb(16 18 27 / 0.16)',
            }}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={3} maxBarSize={28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
