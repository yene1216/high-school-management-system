import { useEffect, useMemo, useState } from "react";
import { api, formErrors } from "../../api/client";
import { useAction, useLookup, useList } from "../../api/hooks";
import type { AttendanceRow, AttendanceStatus, RosterStudent, Section } from "../../api/types";
import { useItem } from "../../api/hooks";
import { STATUS_COLOR, STATUS_LETTER, STATUSES } from "../../components/domain/Attendance";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, Spinner, useToast } from "../../components/ui/Feedback";
import { Input, Select } from "../../components/ui/Form";
import { Card, PageHeader } from "../../components/ui/Layout";
import { useI18n } from "../../i18n";
import { localISODate } from "../../lib/format";

interface Mark { status: AttendanceStatus; note: string }

export default function AttendancePage() {
  const { t } = useI18n();
  const toast = useToast();
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [date, setDate] = useState(localISODate());
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [skipped, setSkipped] = useState<{ student: number; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sections = useLookup<Section>("sections");
  useEffect(() => { if (sectionId === null && sections.rows.length) setSectionId(sections.rows[0].id); }, [sections.rows, sectionId]);
  useEffect(() => { setMarks({}); setSkipped([]); setError(null); }, [sectionId, date]);

  const roster = useItem<RosterStudent[]>(sectionId ? `/sections/${sectionId}/roster/` : null);
  const existing = useList<AttendanceRow>("attendance", { section: sectionId ?? undefined, date, page_size: 200 }, sectionId !== null);
  const saved = useMemo(() => new Map((existing.data?.results ?? []).map((r) => [r.student, r] as const)), [existing.data]);
  const statusOf = (id: number): AttendanceStatus | undefined => marks[id]?.status ?? saved.get(id)?.status;

  const save = useAction(() => api<{ saved: unknown[]; skipped: { student: number; reason: string }[] }>("/attendance/", {
    method: "POST",
    json: { section: sectionId, date, records: Object.entries(marks).map(([student, m]) => ({ student: Number(student), status: m.status, note: m.note })) },
  }), {
    silentError: true,
    onSuccess: (r) => {
      setMarks({});
      setSkipped(r.skipped);
      toast.success(`Saved ${r.saved.length} record${r.saved.length === 1 ? "" : "s"}.`);
    },
  });

  const students = roster.data ?? [];
  const nameOf = (id: number) => students.find((s) => s.id === id)?.name ?? `#${id}`;
  const pending = Object.keys(marks).length;
  const counts = STATUSES.map((s) => ({ s, n: students.filter((st) => statusOf(st.id) === s).length }));
  const unmarked = students.filter((st) => !statusOf(st.id)).length;

  const setStatus = (id: number, status: AttendanceStatus) => setMarks((m) => ({ ...m, [id]: { status, note: m[id]?.note ?? saved.get(id)?.note ?? "" } }));
  const setNote = (id: number, note: string) => setMarks((m) => (statusOf(id) ? { ...m, [id]: { status: m[id]?.status ?? (statusOf(id) as AttendanceStatus), note } } : m));

  if (sections.isLoading) return <Spinner />;
  if (!sections.rows.length) return <><PageHeader title={t("nav.attendance", "Attendance")} /><EmptyState title="No classes to take attendance for">Ask a school admin to assign you a class or subject in School setup.</EmptyState></>;

  return (
    <>
      <PageHeader title={t("nav.attendance", "Attendance")} subtitle="Mark each student, then save. Families of absent or late students are notified automatically." />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Class
          <Select className="mt-1 w-56" value={sectionId ?? ""} onChange={(e) => setSectionId(Number(e.target.value))}>{sections.rows.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.student_count})</option>)}</Select>
        </label>
        <label className="text-sm font-medium">Date
          <Input className="mt-1" type="date" max={localISODate()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <Button variant="secondary" onClick={() => setMarks((m) => ({ ...m, ...Object.fromEntries(students.filter((s) => !statusOf(s.id)).map((s) => [s.id, { status: "present" as const, note: "" }])) }))}>{t("att.markAll", "Mark all present")}</Button>
      </div>

      <ul className="mb-4 flex flex-wrap gap-2 text-sm" aria-label="Summary">
        {counts.map(({ s, n }) => <li key={s} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1"><span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[s]}`} />{t(`status.${s}`, s)} <strong>{n}</strong></li>)}
        <li className="rounded-full border border-line bg-white px-3 py-1 text-muted">{t("status.unmarked", "Not marked")} <strong className="text-ink">{unmarked}</strong></li>
      </ul>

      {roster.isLoading || existing.isLoading ? <Spinner /> : roster.isError ? <ErrorNote message="Couldn't load this class." /> : students.length === 0 ? <EmptyState title="No students in this class yet" /> : (
        <Card flush>
          <ul className="divide-y divide-line">
            {students.map((s) => {
              const st = statusOf(s.id);
              const edited = !!marks[s.id];
              return (
                <li key={s.id} className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${edited ? "bg-chalk-soft/50" : ""}`}>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{s.name}</div><div className="text-xs text-muted">{s.code}{saved.has(s.id) && !edited ? " · recorded" : ""}</div></div>
                  {st && st !== "present" && <Input className="w-48" placeholder="Note (optional)" aria-label={`Note for ${s.name}`} value={marks[s.id]?.note ?? saved.get(s.id)?.note ?? ""} onChange={(e) => setNote(s.id, e.target.value)} />}
                  <div className="flex gap-1" role="group" aria-label={`Attendance for ${s.name}`}>
                    {STATUSES.map((o) => (
                      <button key={o} type="button" aria-pressed={st === o} title={t(`status.${o}`, o)} onClick={() => setStatus(s.id, o)}
                        className={`h-9 w-9 rounded-md text-sm font-semibold ${st === o ? `${STATUS_COLOR[o]} text-white` : "border border-line bg-white text-muted hover:bg-paper"}`}>{STATUS_LETTER[o]}</button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/95 py-3 backdrop-blur">
        <Button loading={save.isPending} disabled={!pending} onClick={() => { setError(null); save.mutate(undefined, { onError: (e) => setError(formErrors(e)._ ?? Object.values(formErrors(e))[0] ?? "Couldn't save.") }); }}>
          {t("att.save", "Save attendance")}{pending ? ` (${pending})` : ""}
        </Button>
        {pending > 0 && <span className="text-sm text-muted">Unsaved changes</span>}
      </div>
      <ErrorNote message={error} />
      {skipped.length > 0 && (
        <div role="status" className="mt-3 rounded-md border border-late/40 bg-late/10 px-4 py-3 text-sm">
          <p className="font-medium">{skipped.length} record{skipped.length === 1 ? " was" : "s were"} already recorded and not changed:</p>
          <p className="text-muted">{skipped.map((s) => nameOf(s.student)).join(", ")}. To change a recorded day, open the student's Attendance tab and request a correction.</p>
        </div>
      )}
    </>
  );
}
