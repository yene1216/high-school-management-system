import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { api } from "../api/client";
import { useUser, useAuth } from "../auth/AuthContext";
import { FAMILY, ROLE_LABELS } from "../auth/roles";
import { useI18n } from "../i18n";
import { visibleNav } from "./nav";

export default function AppShell() {
  const user = useUser();
  const { logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const groups = visibleNav(user);
  const family = FAMILY.includes(user.role);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const unread = useQuery({
    queryKey: ["unread"],
    queryFn: () => api<{ count: number }>("/notifications/unread-count/"),
    refetchInterval: 60_000,
    enabled: user.role !== "super_admin",
  });

  const nav = (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-board-ink/50">{t(g.key, g.label)}</p>
          <ul className="space-y-0.5">
            {g.items.map((i) => {
              const text = family && i.familyLabel ? (user.role === "student" ? t("nav.myRecord", "My record") : t(i.familyLabel.key, i.familyLabel.label)) : t(i.key, i.label);
              return (
                <li key={i.to}>
                  <NavLink to={i.to} end={i.to === "/"}
                    className={({ isActive }) => `flex items-center justify-between rounded-md border-l-4 px-3 py-2 text-sm ${isActive ? "border-chalk bg-board-light font-medium text-white" : "border-transparent text-board-ink/85 hover:bg-board-light/60"}`}>
                    {text}
                    {i.to === "/notifications" && !!unread.data?.count && <span className="rounded-full bg-chalk px-1.5 text-xs font-semibold text-ink">{unread.data.count}</span>}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-chalk focus:p-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="no-print hidden w-64 shrink-0 flex-col bg-board text-board-ink md:sticky md:top-0 md:flex md:h-screen">
        <Link to="/" className="px-6 py-5 font-display text-xl font-semibold text-white">School<span className="text-chalk">.</span></Link>
        {nav}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-board text-board-ink">
            <div className="flex items-center justify-between px-6 py-5"><span className="font-display text-xl font-semibold text-white">School<span className="text-chalk">.</span></span>
              <button aria-label="Close menu" className="text-2xl leading-none" onClick={() => setOpen(false)}>×</button></div>
            {nav}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <button aria-label="Open menu" className="rounded p-2 text-xl leading-none hover:bg-black/5 md:hidden" onClick={() => setOpen(true)}>☰</button>
          <div className="ml-auto flex items-center gap-2 text-sm">
            <button className="btn btn-secondary btn-sm" onClick={() => setLang(lang === "en" ? "am" : "en")} aria-label="Change language">{lang === "en" ? "አማርኛ" : "English"}</button>
            {user.role !== "super_admin" && (
              <Link to="/notifications" aria-label="Notifications" className="relative rounded p-2 hover:bg-black/5">
                <span aria-hidden>🔔</span>
                {!!unread.data?.count && <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-chalk px-1 text-center text-[11px] font-semibold text-ink">{unread.data.count}</span>}
              </Link>
            )}
            <Link to="/settings" className="hidden rounded px-2 py-1 text-right leading-tight hover:bg-black/5 sm:block">
              <span className="block text-sm font-medium">{user.first_name} {user.last_name}</span>
              <span className="block text-xs text-muted">{ROLE_LABELS[user.role]}</span>
            </Link>
            <button className="btn btn-secondary btn-sm" onClick={() => logout()}>{t("auth.signOut", "Sign out")}</button>
          </div>
        </header>
        <main id="content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><Outlet /></main>
      </div>
    </div>
  );
}
