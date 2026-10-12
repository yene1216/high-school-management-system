import { ReactNode, useState } from "react";
import { useItem, useList, useLookup } from "../../api/hooks";
import type { Params } from "../../api/client";
import type { Student } from "../../api/types";
import { useDebounced } from "../../lib/useDebounced";
import { Input, Select } from "../ui/Form";

/** Renders a value looked up from a small reference list, e.g. <Ref endpoint="grade-levels" id={row.grade_level} text={(g) => g.name} />. */
export function Ref<T extends { id: number }>({ endpoint, id, text, params }: { endpoint: string; id: number | null | undefined; text: (row: T) => ReactNode; params?: Params }) {
  const { map, isLoading } = useLookup<T>(endpoint, params);
  if (id === null || id === undefined) return <>—</>;
  const row = map.get(id);
  return <>{row ? text(row) : isLoading ? "…" : `#${id}`}</>;
}

/** A <select> filled from a reference endpoint. Value is the row id as a string ("" = none). */
export function RemoteSelect<T extends { id: number }>({ endpoint, params, value, onChange, text, placeholder = "Choose…", disabled, invalid, id, allowEmpty = true }:
  { endpoint: string; params?: Params; value: string; onChange: (v: string) => void; text: (row: T) => string; placeholder?: string; disabled?: boolean; invalid?: boolean; id?: string; allowEmpty?: boolean }) {
  const { rows, isLoading, isError } = useLookup<T>(endpoint, params);
  if (isError) return <Input disabled value="Not available for your role" readOnly />;
  return (
    <Select id={id} value={value} invalid={invalid} disabled={disabled || isLoading} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">{isLoading ? "Loading…" : placeholder}</option>}
      {rows.map((r) => <option key={r.id} value={r.id}>{text(r)}</option>)}
    </Select>
  );
}

/** Type-ahead student search (school lists can be far larger than a dropdown should hold). */
export function StudentPicker({ value, onChange, invalid, id }: { value: number | null; onChange: (id: number | null) => void; invalid?: boolean; id?: string }) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(term, 250);
  const results = useList<Student>("students", { search: debounced, page_size: 8 }, open && debounced.length > 0);
  const selected = useItem<Student>(value ? `/students/${value}/` : null);

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm">
        <span>{selected.data ? `${selected.data.full_name} · ${selected.data.student_code ?? ""}` : "Loading…"}</span>
        <button type="button" className="text-xs text-muted underline" onClick={() => { onChange(null); setTerm(""); }}>Change</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <Input id={id} invalid={invalid} value={term} placeholder="Type a name or student ID…" autoComplete="off"
        onChange={(e) => { setTerm(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && debounced && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-white shadow-lg">
          {results.isLoading && <li className="px-3 py-2 text-sm text-muted">Searching…</li>}
          {results.data?.results.length === 0 && <li className="px-3 py-2 text-sm text-muted">No matching students.</li>}
          {results.data?.results.map((s) => (
            <li key={s.id}><button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-chalk-soft" onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(s.id); setOpen(false); }}>{s.full_name} <span className="text-muted">· {s.student_code} · {s.current_section?.name ?? "not enrolled"}</span></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
