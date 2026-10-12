import type { AttendanceStatus } from "../../api/types";
import { STATUS_COLOR, STATUSES } from "./Attendance";

/** Simple vertical bars. `data` values are plain numbers. */
export function BarChart({ data, format = (n: number) => String(n), height = 160 }: { data: { label: string; value: number }[]; format?: (n: number) => string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
      <div className="flex items-end gap-3" style={{ height }}>
        {data.map((d) => (
          <div key={d.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-xs tabular-nums text-muted">{format(d.value)}</span>
            <div className="w-full rounded-t bg-board" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3">{data.map((d) => <span key={d.label} className="flex-1 text-center text-xs text-muted">{d.label}</span>)}</div>
    </div>
  );
}

/** One stacked column per day, split by attendance status. */
export function StackedDays({ days, height = 160 }: { days: { label: string; counts: Partial<Record<AttendanceStatus, number>> }[]; height?: number }) {
  const max = Math.max(1, ...days.map((d) => STATUSES.reduce((s, k) => s + (d.counts[k] ?? 0), 0)));
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }} role="img" aria-label="Attendance by day">
        {days.map((d) => (
          <div key={d.label} className="flex h-full min-w-[10px] flex-1 flex-col justify-end" title={STATUSES.map((s) => `${s}: ${d.counts[s] ?? 0}`).join(", ")}>
            {STATUSES.slice().reverse().map((s) => ((d.counts[s] ?? 0) > 0 ? <div key={s} className={STATUS_COLOR[s]} style={{ height: `${((d.counts[s] ?? 0) / max) * 100}%` }} /> : null))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1">{days.map((d, i) => <span key={d.label} className="min-w-[10px] flex-1 truncate text-center text-[10px] text-muted">{days.length <= 16 || i % Math.ceil(days.length / 12) === 0 ? d.label : ""}</span>)}</div>
      <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted">{STATUSES.map((s) => <li key={s} className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${STATUS_COLOR[s]}`} />{s}</li>)}</ul>
    </div>
  );
}
