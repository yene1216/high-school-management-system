import { useMemo, useState } from "react";
import { useItem } from "../../api/hooks";
import type { AttendanceReport, AttendanceStatus, FinanceReport, Section } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { FINANCE, MANAGEMENT } from "../../auth/roles";
import { RemoteSelect } from "../../components/domain/Pickers";
import { STATUSES } from "../../components/domain/Attendance";
import { BarChart, StackedDays } from "../../components/domain/Charts";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Input } from "../../components/ui/Form";
import { Card, PageHeader, Stat, Tabs, useTabParam } from "../../components/ui/Layout";
import { useI18n } from "../../i18n";
import { addDays, downloadCsv, fmtDate, label, localISODate, money, num } from "../../lib/format";

function AttendanceReportView() {
  const { t } = useI18n();
  const [from, setFrom] = useState(addDays(localISODate(), -30));
  const [to, setTo] = useState(localISODate());
  const [section, setSection] = useState("");
  const q = useItem<AttendanceReport>("/reports/attendance/", { from, to, section: section || undefined });

  const days = useMemo(() => {
    const by = new Map<string, Partial<Record<AttendanceStatus, number>>>();
    for (const r of q.data?.daily ?? []) by.set(r.date, { ...by.get(r.date), [r.status]: r.n });
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, counts]) => ({ date, counts }));
  }, [q.data]);
  const totals = q.data?.totals ?? {};
  const total = STATUSES.reduce((s, k) => s + (totals[k] ?? 0), 0);
  const rate = total ? Math.round((((totals.present ?? 0) + (totals.late ?? 0)) / total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">From<Input className="mt-1" type="date" max={to} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></label>
        <label className="text-sm font-medium">To<Input className="mt-1" type="date" min={from} max={localISODate()} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></label>
        <label className="w-48 text-sm font-medium">Class<div className="mt-1"><RemoteSelect endpoint="sections" value={section} onChange={setSection} text={(s: Section) => s.label} placeholder="All classes" /></div></label>
        <Button variant="secondary" disabled={!days.length} onClick={() => downloadCsv(`attendance-${from}-to-${to}.csv`, [["Date", ...STATUSES.map(label)], ...days.map((d) => [d.date, ...STATUSES.map((s) => d.counts[s] ?? 0)])])}>Export CSV</Button>
      </div>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorNote message="Couldn't load the attendance report." /> : total === 0 ? <EmptyState title="No attendance in this period" /> : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {STATUSES.map((s) => <Stat key={s} label={t(`status.${s}`, label(s))} value={totals[s] ?? 0} tone={s === "absent" && (totals.absent ?? 0) > 0 ? "bad" : undefined} />)}
            <Stat label="Attendance rate" value={`${rate}%`} hint="Present + late" />
          </dl>
          <Card title="By day"><StackedDays days={days.map((d) => ({ label: fmtDate(d.date).replace(/,? \d{4}$/, ""), counts: d.counts }))} /></Card>
        </>
      )}
    </div>
  );
}

function FinanceReportView() {
  const q = useItem<FinanceReport>("/reports/finance/");
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorNote message="Couldn't load the finance report." />;
  const { summary: s, aging } = q.data;
  const labels: Record<string, string> = { current: "Not yet due", "1_30": "1–30 days late", "31_60": "31–60", "61_90": "61–90", over_90: "Over 90" };
  const rows = Object.entries(aging).map(([k, v]) => ({ label: labels[k] ?? k, value: num(v) }));
  const rate = num(s.billed) ? Math.round((num(s.collected) / num(s.billed)) * 100) : 0;
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Billed" value={money(s.billed)} /><Stat label="Collected" value={money(s.collected)} tone="good" />
        <Stat label="Outstanding" value={money(s.outstanding)} /><Stat label="Overdue invoices" value={s.overdue_count} tone={s.overdue_count ? "bad" : undefined} />
        <Stat label="Collection rate" value={`${rate}%`} />
      </dl>
      <Card title="Outstanding by age" actions={<Button variant="secondary" small onClick={() => downloadCsv("aging.csv", [["Age", "Outstanding"], ...rows.map((r) => [r.label, r.value])])}>Export CSV</Button>}>
        <BarChart data={rows} format={(n) => money(n)} />
      </Card>
    </div>
  );
}

export default function ReportsPage() {
  const user = useUser();
  const canAttendance = user.role !== "accountant";
  const canFinance = FINANCE.includes(user.role) || MANAGEMENT.includes(user.role);
  const tabs = [...(canAttendance ? [{ id: "attendance", label: "Attendance" }] : []), ...(canFinance ? [{ id: "finance", label: "Finance" }] : [])];
  const [tab, setTab] = useTabParam(tabs[0]?.id ?? "attendance");
  const active = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;
  return (
    <>
      <PageHeader title="Reports" />
      {tabs.length > 1 && <Tabs tabs={tabs} active={active} onChange={setTab} />}
      {active === "attendance" && <AttendanceReportView />}
      {active === "finance" && <FinanceReportView />}
    </>
  );
}
