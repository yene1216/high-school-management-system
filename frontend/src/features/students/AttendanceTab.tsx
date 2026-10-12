import { Fragment, useState } from "react";
import { api, formErrors } from "../../api/client";
import { useAction, useItem } from "../../api/hooks";
import type { AttendanceRow, AttendanceStatus, Student } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { ATTENDANCE_TAKERS } from "../../auth/roles";
import { AttendancePill, RegisterStrip, STATUSES } from "../../components/domain/Attendance";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Field, Input, Select } from "../../components/ui/Form";
import { Card, Stat } from "../../components/ui/Layout";
import { fmtDate } from "../../lib/format";

function CorrectionForm({ record, onDone }: { record: AttendanceRow; onDone: () => void }) {
  const [status, setStatus] = useState<AttendanceStatus>(record.status === "present" ? "absent" : "present");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = useAction(() => api(`/attendance/${record.id}/correct/`, { method: "POST", json: { new_status: status, reason } }), {
    silentError: true, success: "Correction requested.", onSuccess: onDone,
  });
  return (
    <div className="grid gap-3 bg-paper p-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <Field label="Change to" htmlFor={`ns-${record.id}`}><Select id={`ns-${record.id}`} value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></Field>
      <Field label="Reason (required)" htmlFor={`rs-${record.id}`}><Input id={`rs-${record.id}`} value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Doctor's note received" /></Field>
      <Button disabled={!reason.trim()} loading={send.isPending} onClick={() => { setErr(null); send.mutate(undefined, { onError: (e) => setErr(formErrors(e)._ ?? Object.values(formErrors(e))[0] ?? "Failed") }); }}>Send request</Button>
      {err && <div className="sm:col-span-3"><ErrorNote message={err} /></div>}
    </div>
  );
}

export function AttendanceTab({ student }: { student: Student }) {
  const user = useUser();
  const q = useItem<AttendanceRow[]>(`/students/${student.id}/attendance/`);
  const [correcting, setCorrecting] = useState<number | null>(null);
  const canCorrect = ATTENDANCE_TAKERS.includes(user.role);
  if (q.isLoading) return <Spinner />;
  if (q.isError) return <ErrorNote message="Couldn't load attendance." />;
  const rows = q.data ?? [];
  if (!rows.length) return <EmptyState title="No attendance recorded yet">Attendance appears here once a teacher takes the register.</EmptyState>;
  const count = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;
  const attended = count("present") + count("late");
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Days recorded" value={rows.length} />
        <Stat label="Present" value={count("present")} tone="good" />
        <Stat label="Absent" value={count("absent")} tone={count("absent") ? "bad" : undefined} />
        <Stat label="Late" value={count("late")} />
        <Stat label="Attendance rate" value={`${Math.round((attended / rows.length) * 100)}%`} />
      </dl>
      <Card title="Last 30 school days"><RegisterStrip records={[...rows].slice(0, 30).reverse().map((r) => ({ date: r.date, status: r.status }))} /></Card>
      <Card title="Register" flush>
        <table className="w-full">
          <thead className="border-b border-line"><tr><th className="th">Date</th><th className="th">Status</th><th className="th">Note</th><th className="th" /></tr></thead>
          <tbody>
            {rows.slice(0, 60).map((r) => (
              <Fragment key={r.id}>
                <tr className="border-b border-line last:border-0">
                  <td className="td">{fmtDate(r.date)}</td><td className="td"><AttendancePill status={r.status} /></td><td className="td text-muted">{r.note}</td>
                  <td className="td text-right">{canCorrect && <Button variant="ghost" small onClick={() => setCorrecting(correcting === r.id ? null : r.id)}>Request correction</Button>}</td>
                </tr>
                {correcting === r.id && <tr><td colSpan={4}><CorrectionForm record={r} onDone={() => setCorrecting(null)} /></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
