import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";

/* ---------- Toasts ---------- */
type ToastItem = { id: number; kind: "success" | "error"; text: string };
const ToastCtx = createContext<{ success: (t: string) => void; error: (t: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const push = useCallback((kind: ToastItem["kind"], text: string) => {
    const id = nextId.current++;
    setItems((xs) => [...xs.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === "error" ? 8000 : 4000);
  }, []);
  const value = useMemo(() => ({ success: (t: string) => push("success", t), error: (t: string) => push("error", t) }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-md px-4 py-3 text-sm text-white shadow-lg ${t.kind === "error" ? "bg-absent" : "bg-board"}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast must be used inside ToastProvider");
  return c;
}

/* ---------- Confirm dialog ---------- */
type ConfirmOpts = { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<((o: ConfirmOpts) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);
  const confirm = useCallback((opts: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ opts, resolve })), []);
  const done = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal open={!!state} size="sm" title={state?.opts.title ?? ""} onClose={() => done(false)}
        footer={<><Button variant="secondary" onClick={() => done(false)}>Cancel</Button><Button variant={state?.opts.danger ? "danger" : "primary"} onClick={() => done(true)}>{state?.opts.confirmLabel ?? "Confirm"}</Button></>}>
        <div className="text-sm">{state?.opts.message}</div>
      </Modal>
    </ConfirmCtx.Provider>
  );
}
export function useConfirm() {
  const c = useContext(ConfirmCtx);
  if (!c) throw new Error("useConfirm must be used inside ConfirmProvider");
  return c;
}

/* ---------- Small pieces ---------- */
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 py-8 text-sm text-muted"><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{label}</div>;
}

export function ErrorNote({ message }: { message?: string | null }) {
  return message ? <p role="alert" className="rounded-md border border-absent/30 bg-red-50 px-3 py-2 text-sm text-absent">{message}</p> : null;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-lg">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-black/5 text-ink", good: "bg-present/15 text-present", warn: "bg-late/15 text-late",
  bad: "bg-absent/15 text-absent", info: "bg-excused/15 text-excused",
};
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TONES[tone]}`}>{children}</span>;
}

const STATUS_TONE: Record<string, Tone> = {
  active: "good", paid: "good", confirmed: "good", verified: "good", approved: "good", sent: "good", present: "good", published: "good",
  partial: "warn", pending: "warn", requested: "warn", late: "warn", draft: "neutral", issued: "info", excused: "info", info: "neutral",
  void: "bad", failed: "bad", rejected: "bad", absent: "bad", withdrawn: "bad", reversed: "bad", urgent: "bad", warning: "warn",
  overdue: "bad", transferred: "neutral", graduated: "info", completed: "info", promoted: "info",
};
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}
