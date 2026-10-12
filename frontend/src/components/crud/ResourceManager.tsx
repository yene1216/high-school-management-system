import { ReactNode, useMemo, useState } from "react";
import { api, ApiError, formErrors, Params } from "../../api/client";
import { useAction, useList } from "../../api/hooks";
import { useDebounced } from "../../lib/useDebounced";
import { RemoteSelect, StudentPicker } from "../domain/Pickers";
import { Button } from "../ui/Button";
import { EmptyState, ErrorNote, useConfirm, useToast } from "../ui/Feedback";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/Form";
import { Modal } from "../ui/Modal";
import { Column, DataTable, Pagination } from "../ui/Table";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type FieldType = "text" | "email" | "number" | "date" | "checkbox" | "password" | "textarea" | "select" | "student";
export type Values = Record<string, any>;

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  options?: { value: string; label: string }[];
  remote?: { endpoint: string; params?: Params; text: (row: any) => string };
  createOnly?: boolean;
  editOnly?: boolean;
  showWhen?: (values: Values) => boolean;
  wide?: boolean;
  defaultValue?: string | boolean;
  step?: string;
}

export interface ResourceConfig<T extends { id: number }> {
  noun: string;                 // "grade level"
  endpoint: string;             // "grade-levels"
  columns: Column<T>[];
  fields: FieldDef[];
  params?: Params;              // fixed filters, e.g. { role: "teacher" }
  search?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  intro?: ReactNode;
  emptyHint?: ReactNode;
  toPayload?: (payload: Values, mode: "create" | "edit") => Values;
  toValues?: (row: T) => Values;
  rowActions?: (row: T) => ReactNode;
  toolbar?: ReactNode;
}

function initial(fields: FieldDef[], row?: Values): Values {
  const v: Values = {};
  for (const f of fields) {
    const raw = row?.[f.name];
    if (f.type === "checkbox") v[f.name] = raw ?? f.defaultValue ?? false;
    else v[f.name] = raw === null || raw === undefined ? (f.defaultValue ?? "") : String(raw);
  }
  return v;
}

function buildPayload(fields: FieldDef[], values: Values, mode: "create" | "edit"): Values {
  const out: Values = {};
  for (const f of fields) {
    if ((f.createOnly && mode === "edit") || (f.editOnly && mode === "create")) continue;
    const v = values[f.name] ?? (f.type === "checkbox" ? false : "");
    if (f.type === "checkbox") out[f.name] = !!v;
    else if (f.type === "number") { if (v !== "") out[f.name] = Number(v); }
    else if (f.type === "password") { if (v) out[f.name] = v; }
    else if (f.type === "select" || f.type === "student") {
      if (v === "") { if (mode === "edit" && !f.required) out[f.name] = null; }
      else out[f.name] = f.remote || f.type === "student" ? Number(v) : v;
    } else if (f.type === "date") { if (v !== "") out[f.name] = v; else if (mode === "edit" && !f.required) out[f.name] = null; }
    else out[f.name] = String(v).trim();
  }
  return out;
}

export function FieldInput({ f, value, onChange, error }: { f: FieldDef; value: any; onChange: (v: any) => void; error?: string }) {
  const id = `f-${f.name}`;
  if (f.type === "checkbox") return <div className={f.wide ? "sm:col-span-2" : ""}><Checkbox label={f.label} checked={!!value} onChange={onChange} />{f.hint && <p className="mt-1 text-xs text-muted">{f.hint}</p>}</div>;
  let control: ReactNode;
  if (f.type === "select" && f.remote) control = <RemoteSelect id={id} endpoint={f.remote.endpoint} params={f.remote.params} value={String(value ?? "")} onChange={onChange} text={f.remote.text} invalid={!!error} placeholder={f.required ? "Choose…" : "None"} />;
  else if (f.type === "select") control = (
    <Select id={id} value={String(value ?? "")} invalid={!!error} onChange={(e) => onChange(e.target.value)}>
      <option value="">{f.required ? "Choose…" : "None"}</option>
      {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </Select>
  );
  else if (f.type === "student") control = <StudentPicker id={id} value={value ? Number(value) : null} invalid={!!error} onChange={(n) => onChange(n === null ? "" : String(n))} />;
  else if (f.type === "textarea") control = <Textarea id={id} value={value ?? ""} invalid={!!error} onChange={(e) => onChange(e.target.value)} />;
  else control = <Input id={id} type={f.type} step={f.step} autoComplete={f.type === "password" ? "new-password" : "off"} value={value ?? ""} invalid={!!error} onChange={(e) => onChange(e.target.value)} />;
  return <Field label={f.label} htmlFor={id} required={f.required} hint={f.hint} error={error} className={f.wide ? "sm:col-span-2" : ""}>{control}</Field>;
}

/** Form in a modal: validates required fields, shows the server's field errors under the inputs. */
export function FormModal({ open, title, fields, initialValues, mode, onClose, onSubmit, saving, errors, submitLabel = "Save", children }:
  { open: boolean; title: string; fields: FieldDef[]; initialValues: Values; mode: "create" | "edit"; onClose: () => void; onSubmit: (payload: Values, raw: Values) => void; saving?: boolean; errors: Record<string, string>; submitLabel?: string; children?: ReactNode }) {
  const [values, setValues] = useState<Values>(initialValues);
  const [local, setLocal] = useState<Record<string, string>>({});
  const visible = fields.filter((f) => !((f.createOnly && mode === "edit") || (f.editOnly && mode === "create")) && (!f.showWhen || f.showWhen(values)));
  const submit = () => {
    const missing: Record<string, string> = {};
    for (const f of visible) if (f.required && f.type !== "checkbox" && (values[f.name] === "" || values[f.name] === undefined)) missing[f.name] = "Required";
    setLocal(missing);
    if (Object.keys(missing).length === 0) onSubmit(buildPayload(visible, values, mode), values);
  };
  return (
    <Modal open={open} title={title} onClose={onClose}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={saving}>{submitLabel}</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
        {visible.map((f) => <FieldInput key={f.name} f={f} value={values[f.name]} error={local[f.name] ?? errors[f.name]} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />)}
        {children}
        {errors._ && <div className="sm:col-span-2"><ErrorNote message={errors._} /></div>}
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}

export function ResourceManager<T extends { id: number }>({ config }: { config: ResourceConfig<T> }) {
  const { noun, endpoint, fields, canCreate = true, canEdit = true, canDelete = true } = config;
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState("");
  const search = useDebounced(term, 300);
  const [editing, setEditing] = useState<T | "new" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const confirm = useConfirm();
  const toast = useToast();
  const PAGE_SIZE = 25;

  const list = useList<T>(endpoint, { ...config.params, search: search || undefined, page, page_size: PAGE_SIZE });

  const save = useAction(
    (v: { id?: number; payload: Values }) => (v.id ? api(`/${endpoint}/${v.id}/`, { method: "PATCH", json: v.payload }) : api(`/${endpoint}/`, { method: "POST", json: v.payload })),
    { silentError: true, success: `${noun[0].toUpperCase()}${noun.slice(1)} saved.`, onSuccess: () => { setEditing(null); setErrors({}); } },
  );
  const remove = useAction((id: number) => api(`/${endpoint}/${id}/`, { method: "DELETE" }), { silentError: true, success: "Deleted." });

  const onDelete = async (row: T) => {
    if (!(await confirm({ title: `Delete this ${noun}?`, message: "This can't be undone.", confirmLabel: "Delete", danger: true }))) return;
    remove.mutate(row.id, {
      onError: (e) => toast.error(e instanceof ApiError && (e.status === 409 || e.status >= 500) ? `This ${noun} is in use elsewhere and can't be deleted.` : formErrors(e)._ ?? "Could not delete."),
    });
  };

  const columns = useMemo<Column<T>[]>(() => {
    const cols = [...config.columns];
    if (canEdit || canDelete || config.rowActions) {
      cols.push({
        key: "_actions", header: <span className="sr-only">Actions</span>, align: "right",
        cell: (row) => (
          <span className="flex justify-end gap-2">
            {config.rowActions?.(row)}
            {canEdit && <Button variant="secondary" small onClick={() => { setErrors({}); setEditing(row); }}>Edit</Button>}
            {canDelete && <Button variant="ghost" small onClick={() => onDelete(row)}>Delete</Button>}
          </span>
        ),
      });
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, canEdit, canDelete]);

  return (
    <div className="space-y-4">
      {config.intro && <p className="text-sm text-muted">{config.intro}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {config.search ? <Input className="max-w-xs" placeholder={`Search ${noun}s…`} aria-label={`Search ${noun}s`} value={term} onChange={(e) => { setTerm(e.target.value); setPage(1); }} /> : <span />}
        <div className="flex gap-2">{config.toolbar}{canCreate && <Button onClick={() => { setErrors({}); setEditing("new"); }}>Add {noun}</Button>}</div>
      </div>
      {list.isError ? <ErrorNote message="Couldn't load this list. You may not have access." /> : (
        <>
          <DataTable columns={columns} rows={list.data?.results} rowKey={(r) => r.id} loading={list.isLoading}
            empty={<EmptyState title={`No ${noun}s yet`}>{config.emptyHint ?? (canCreate ? `Use “Add ${noun}” to create the first one.` : undefined)}</EmptyState>} />
          <Pagination page={page} pageSize={PAGE_SIZE} count={list.data?.count ?? 0} onChange={setPage} />
        </>
      )}
      {editing && (
        <FormModal open mode={editing === "new" ? "create" : "edit"} title={editing === "new" ? `Add ${noun}` : `Edit ${noun}`} fields={fields}
          initialValues={initial(fields, editing === "new" ? undefined : config.toValues ? config.toValues(editing) : (editing as Values))}
          errors={errors} saving={save.isPending} onClose={() => setEditing(null)}
          onSubmit={(payload) => {
            const mode = editing === "new" ? "create" : "edit";
            save.mutate({ id: editing === "new" ? undefined : editing.id, payload: config.toPayload ? config.toPayload(payload, mode) : payload }, { onError: (e) => setErrors(formErrors(e)) });
          }} />
      )}
    </div>
  );
}
