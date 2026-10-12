import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import type { Notice } from "../../api/types";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorNote, Spinner } from "../../components/ui/Feedback";
import { Select } from "../../components/ui/Form";
import { PageHeader, Tabs } from "../../components/ui/Layout";
import { Pagination } from "../../components/ui/Table";
import { useI18n } from "../../i18n";
import { fmtDateTime, label } from "../../lib/format";

const BAR = { info: "border-l-line", warning: "border-l-late", urgent: "border-l-absent" } as const;

function linkFor(n: Notice): string | null {
  if (n.data?.invoice) return `/invoices/${n.data.invoice}`;
  if (n.data?.student) return `/students/${n.data.student}`;
  if (n.data?.announcement) return "/announcements";
  return null;
}

export default function NotificationsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState("unread");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const q = useList<Notice>("notifications", { is_read: tab === "unread" ? "false" : undefined, category: category || undefined, page, page_size: 20 });
  const readOne = useAction((id: number) => api(`/notifications/${id}/read/`, { method: "POST" }));
  const readAll = useAction(() => api("/notifications/read-all/", { method: "POST" }), { success: "All marked as read." });

  return (
    <>
      <PageHeader title={t("nav.notifications", "Notifications")} actions={<Button variant="secondary" loading={readAll.isPending} onClick={() => readAll.mutate(undefined)}>Mark all as read</Button>} />
      <Tabs active={tab} onChange={(x) => { setTab(x); setPage(1); }} tabs={[{ id: "unread", label: "Unread" }, { id: "all", label: "All" }]} />
      <div className="mb-4"><Select className="w-48" aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">Any type</option>{["attendance", "grades", "billing", "announcement", "event", "general"].map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select></div>
      {q.isLoading ? <Spinner /> : q.isError ? <ErrorNote message="Couldn't load notifications." /> : !q.data?.results.length ? <EmptyState title={tab === "unread" ? "You're all caught up" : "No notifications yet"} /> : (
        <ul className="space-y-2">
          {q.data.results.map((n) => {
            const to = linkFor(n);
            return (
              <li key={n.id} className={`card border-l-4 p-4 ${BAR[n.priority]} ${n.is_read ? "opacity-75" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><h2 className={`text-sm ${n.is_read ? "" : "font-semibold"}`}>{n.title}</h2><p className="mt-1 text-sm text-muted">{n.body}</p>
                    <p className="mt-1 text-xs text-muted">{fmtDateTime(n.created_at)} · {label(n.category)}</p></div>
                  <div className="flex shrink-0 gap-2">{to && <Link to={to} className="btn btn-secondary btn-sm" onClick={() => !n.is_read && readOne.mutate(n.id)}>Open</Link>}{!n.is_read && <Button variant="ghost" small onClick={() => readOne.mutate(n.id)}>Mark read</Button>}</div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pagination page={page} pageSize={20} count={q.data?.count ?? 0} onChange={setPage} />
    </>
  );
}
