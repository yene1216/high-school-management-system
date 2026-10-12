import type { AttendanceStatus } from "../../api/types";
import { useI18n } from "../../i18n";
import { fmtDate } from "../../lib/format";

export const STATUS_COLOR: Record<AttendanceStatus, string> = { present: "bg-present", absent: "bg-absent", late: "bg-late", excused: "bg-excused" };
export const STATUS_LETTER: Record<AttendanceStatus, string> = { present: "P", absent: "A", late: "L", excused: "E" };
export const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];

/** The school register as a strip: one square per day, letter + colour so it never relies on colour alone. */
export function RegisterStrip({ records }: { records: { date: string; status: AttendanceStatus }[] }) {
  if (!records.length) return <p className="text-sm text-muted">No attendance recorded yet.</p>;
  return (
    <ol className="flex flex-wrap gap-1" aria-label="Recent attendance">
      {records.map((r) => (
        <li key={r.date} title={`${fmtDate(r.date)}: ${r.status}`}
          className={`flex h-7 w-7 items-center justify-center rounded text-xs font-semibold text-white ${STATUS_COLOR[r.status]}`}>
          <span aria-hidden>{STATUS_LETTER[r.status]}</span><span className="sr-only">{fmtDate(r.date)} {r.status}</span>
        </li>
      ))}
    </ol>
  );
}

export function AttendancePill({ status }: { status: AttendanceStatus | null | undefined }) {
  const { t } = useI18n();
  if (!status) return <span className="rounded-full border border-line px-2 py-0.5 text-xs text-muted">{t("status.unmarked", "Not marked")}</span>;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium text-white ${STATUS_COLOR[status]}`}>{t(`status.${status}`, status)}</span>;
}
