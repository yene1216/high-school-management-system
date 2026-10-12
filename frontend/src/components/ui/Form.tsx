import { forwardRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from "react";

export function Field({ label, error, hint, required, children, htmlFor, className = "" }:
  { label: ReactNode; error?: string; hint?: ReactNode; required?: boolean; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {label}{required && <span className="text-absent" aria-hidden> *</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p role="alert" className="mt-1 text-xs text-absent">{error}</p>}
    </div>
  );
}

type Bare = { invalid?: boolean };
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Bare>(function Input({ invalid, className = "", ...p }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={`input ${invalid ? "input-invalid" : ""} ${className}`} {...p} />;
});
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & Bare>(function Select({ invalid, className = "", children, ...p }, ref) {
  return <select ref={ref} aria-invalid={invalid || undefined} className={`input ${invalid ? "input-invalid" : ""} ${className}`} {...p}>{children}</select>;
});
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & Bare>(function Textarea({ invalid, className = "", ...p }, ref) {
  return <textarea ref={ref} rows={3} aria-invalid={invalid || undefined} className={`input ${invalid ? "input-invalid" : ""} ${className}`} {...p} />;
});

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" className="h-4 w-4 rounded border-line" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function FileField({ label, accept, onChange, error, hint, id }: { label: ReactNode; accept?: string; onChange: (f: File | null) => void; error?: string; hint?: ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Field label={label} htmlFor={fid} error={error} hint={hint}>
      <input id={fid} type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-board file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-board-light" />
    </Field>
  );
}
