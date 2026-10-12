import { ReactNode, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="no-print mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, actions, children, className = "", flush }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: "bad" | "good"; hint?: ReactNode }) {
  return (
    <div className="card p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-1 font-display text-2xl ${tone === "bad" ? "text-absent" : tone === "good" ? "text-present" : ""}`}>{value}</dd>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Tab state kept in the URL (?tab=) so a tab can be linked to and survives reload. */
export function useTabParam(fallback: string, name = "tab"): [string, (t: string) => void] {
  const [params, setParams] = useSearchParams();
  const current = params.get(name) ?? fallback;
  const set = useCallback((t: string) => {
    setParams((p) => { const n = new URLSearchParams(p); n.set(name, t); return n; }, { replace: true });
  }, [setParams, name]);
  return [current, set];
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
          className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors ${active === t.id ? "border-board font-semibold" : "border-transparent text-muted hover:text-ink"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
