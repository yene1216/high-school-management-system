import { ReactNode } from "react";
import { Button } from "./Button";
import { EmptyState } from "./Feedback";

export interface Column<T> { key: string; header: ReactNode; cell: (row: T) => ReactNode; className?: string; align?: "right" }

export function DataTable<T>({ columns, rows, rowKey, loading, empty, onRowClick }:
  { columns: Column<T>[]; rows: T[] | undefined; rowKey: (row: T) => string | number; loading?: boolean; empty?: ReactNode; onRowClick?: (row: T) => void }) {
  if (loading && !rows) {
    return <div className="card animate-pulse space-y-3 p-5">{[0, 1, 2, 3].map((i) => <div key={i} className="h-4 rounded bg-black/5" />)}</div>;
  }
  if (!rows || rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead className="border-b border-line bg-paper/60">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={`th ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-b border-line last:border-0 ${onRowClick ? "cursor-pointer hover:bg-chalk-soft/50" : ""}`}>
              {columns.map((c) => <td key={c.key} className={`td ${c.align === "right" ? "text-right" : ""} ${c.className ?? ""}`}>{c.cell(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pageSize, count, onChange }: { page: number; pageSize: number; count: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="no-print mt-3 flex items-center justify-between text-sm text-muted">
      <span>{count} results · page {page} of {pages}</span>
      <span className="flex gap-2">
        <Button variant="secondary" small disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</Button>
        <Button variant="secondary" small disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</Button>
      </span>
    </nav>
  );
}
