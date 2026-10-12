import { Link } from "react-router-dom";
import { useItem, useList } from "../../api/hooks";
import type { Announcement, ChildCard, Dashboard, Finance, Notice } from "../../api/types";
import { useUser } from "../../auth/AuthContext";
import { AttendancePill, RegisterStrip, STATUSES } from "../../components/domain/Attendance";
import { BarChart } from "../../components/domain/Charts";
import { Badge, EmptyState, ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Card, PageHeader, Stat } from "../../components/ui/Layout";
import { useI18n } from "../../i18n";
import { fmtDate, label, money, num } from "../../lib/format";

function Child({ c }: { c: ChildCard }) {
  const { t } = useI18n();
  const owing = num(c.outstanding_balance) > 0;
  return (
    <Card className="print-sheet">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold">{c.name}</h2><p className="text-sm text-muted">{c.section ?? "Not enrolled"} · {c.code}</p></div>
        <div className="text-right text-sm"><div className="mb-1 text-muted">{t("dash.today", "Today")}</div><AttendancePill status={c.today} /></div>
      </div>
      <div className="mt-4"><RegisterStrip records={c.recent_attendance} /></div>
      <div className="mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-2">
        <div>
          <h3 className="mb-1 font-medium">{t("dash.latest", "Latest results")}</h3>
          {c.latest_grades.length ? <ul className="space-y-0.5">{c.latest_grades.map((g, i) => <li key={i}>{g.subject} · {g.assessment}: <strong>{num(g.score)}/{num(g.max_score)}</strong></li>)}</ul> : <p className="text-muted">No published results yet.</p>}
        </div>
        <div>
          <h3 className="mb-1 font-medium">{t("dash.balance", "Balance due")}</h3>
          <p className={owing ? "font-semibold text-late" : "text-muted"}>{owing ? money(c.outstanding_balance, c.currency) : "Nothing due"}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link className="btn btn-secondary btn-sm" to={`/students/${c.id}`}>Details</Link>
        <Link className="btn btn-secondary btn-sm" to={`/students/${c.id}?tab=results`}>Results</Link>
        {owing && <Link className="btn btn-primary btn-sm" to={`/students/${c.id}?tab=fees`}>View fees</Link>}
      </div>
    </Card>
  );
}

function FinanceStats({ f }: { f: Finance }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Billed" value={money(f.billed)} />
      <Stat label="Collected" value={money(f.collected)} tone="good" />
      <Stat label="Outstanding" value={money(f.outstanding)} />
      <Stat label="Overdue invoices" value={f.overdue_count} tone={f.overdue_count ? "bad" : undefined} />
    </dl>
  );
}

const AGING_LABELS: Record<string, string> = { current: "Not yet due", "1_30": "1–30 days", "31_60": "31–60", "61_90": "61–90", over_90: "90+" };

function Feed() {
  const ann = useList<Announcement>("announcements", { page_size: 3 });
  const notes = useList<Notice>("notifications", { is_read: "false", page_size: 4 });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Announcements" actions={<Link className="text-sm underline" to="/announcements">All</Link>}>
        {ann.data?.results.length ? (
          <ul className="space-y-3">{ann.data.results.map((a) => <li key={a.id}><p className="flex items-center gap-2 text-sm font-medium">{a.title}{a.priority !== "info" && <Badge tone={a.priority === "urgent" ? "bad" : "warn"}>{a.priority}</Badge>}</p><p className="line-clamp-2 text-sm text-muted">{a.body}</p><p className="text-xs text-muted">{fmtDate(a.published_at)}</p></li>)}</ul>
        ) : <p className="text-sm text-muted">No announcements.</p>}
      </Card>
      <Card title="Unread notifications" actions={<Link className="text-sm underline" to="/notifications">All</Link>}>
        {notes.data?.results.length ? (
          <ul className="space-y-3">{notes.data.results.map((n) => <li key={n.id} className={`border-l-4 pl-3 ${n.priority === "urgent" ? "border-absent" : n.priority === "warning" ? "border-late" : "border-line"}`}><p className="text-sm font-medium">{n.title}</p><p className="line-clamp-2 text-sm text-muted">{n.body}</p></li>)}</ul>
        ) : <p className="text-sm text-muted">You're all caught up.</p>}
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const user = useUser();
  const { t } = useI18n();
  const q = useItem<Dashboard>("/dashboard/summary/");
  if (q.isLoading) return <Spinner />;
  if (q.isError || !q.data) return <ErrorNote message="Couldn't load the dashboard." />;
  const d = q.data;

  return (
    <div className="space-y-6">
      <PageHeader title={`${t("nav.dashboard", "Dashboard")}`} subtitle={`Welcome, ${user.first_name || user.email}.`} />
      {d.kind === "family" && (d.children.length
        ? <div className="grid gap-5 lg:grid-cols-2">{d.children.map((c) => <Child key={c.id} c={c} />)}</div>
        : <EmptyState title="No children linked yet">Ask the school office to link your children to your account.</EmptyState>)}

      {d.kind === "teacher" && (
        d.sections.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {d.sections.map((s) => (
              <Card key={s.section}>
                <div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{s.label}</h2><p className="text-sm text-muted">{s.students} students</p></div>
                  {s.attendance_marked_today ? <Badge tone="good">Taken today</Badge> : <Badge tone="warn">Not taken</Badge>}</div>
                <div className="mt-4 flex gap-2"><Link className="btn btn-primary btn-sm" to="/attendance">Take attendance</Link><Link className="btn btn-secondary btn-sm" to="/gradebook">Gradebook</Link></div>
              </Card>
            ))}
          </div>
        ) : <EmptyState title="No classes assigned yet">Ask a school admin to assign you a class in School setup.</EmptyState>
      )}

      {d.kind === "finance" && (
        <>
          <FinanceStats f={d.finance} />
          <Card title="Outstanding by age"><BarChart data={Object.entries(d.aging).map(([k, v]) => ({ label: AGING_LABELS[k] ?? k, value: num(v) }))} format={(n) => money(n)} /></Card>
          <div className="flex gap-2"><Link className="btn btn-primary" to="/invoices">Open invoices</Link><Link className="btn btn-secondary" to="/payments">Payments</Link></div>
        </>
      )}

      {d.kind === "management" && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat label="Active students" value={d.students_active} />
            {STATUSES.map((s) => <Stat key={s} label={`${label(s)} today`} value={d.attendance_today[s] ?? 0} tone={s === "absent" && (d.attendance_today.absent ?? 0) > 0 ? "bad" : undefined} />)}
          </dl>
          {d.finance && <FinanceStats f={d.finance} />}
          <div className="flex flex-wrap gap-2"><Link className="btn btn-secondary" to="/reports">Reports</Link><Link className="btn btn-secondary" to="/students">Students</Link>{d.finance && <Link className="btn btn-secondary" to="/invoices">Invoices</Link>}</div>
        </>
      )}

      {d.kind === "basic" && <EmptyState title="Welcome">Your role doesn't have dashboard widgets yet. Use the menu to get around.</EmptyState>}
      {user.role !== "super_admin" && <Feed />}
    </div>
  );
}
