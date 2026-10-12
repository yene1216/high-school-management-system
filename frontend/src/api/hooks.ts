import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useToast } from "../components/ui/Feedback";
import { api, errorText, Params } from "./client";
import type { Page } from "./types";

/** Paginated list endpoint, e.g. useList<Student>("students", { search: "abel", page: 2 }). */
export function useList<T = any>(endpoint: string, params?: Params, enabled = true) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return useQuery({
    queryKey: ["list", endpoint, params ?? {}],
    queryFn: ({ signal }) => api<Page<T>>(`/${endpoint}/`, { params, signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** All rows (up to 200) of a small reference list, plus an id -> row map. Cached and shared between components. */
export function useLookup<T extends { id: number } = any>(endpoint: string, params?: Params, enabled = true) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const q = useList<T>(endpoint, { ...params, page_size: 200 }, enabled);
  const rows = useMemo(() => q.data?.results ?? [], [q.data]);
  const map = useMemo(() => new Map(rows.map((r) => [r.id, r] as const)), [rows]);
  return { rows, map, isLoading: q.isLoading, isError: q.isError, error: q.error };
}

/** A single resource or non-paginated endpoint, e.g. useItem<Student>("/students/5/"). Pass null to skip. */
export function useItem<T>(path: string | null, params?: Params) {
  return useQuery({
    queryKey: ["item", path, params ?? {}],
    queryFn: ({ signal }) => api<T>(path as string, { params, signal }),
    enabled: !!path,
  });
}

/** A write. Refreshes every cached query afterwards so lists, dashboards and badges never go stale. */
export function useAction<V, R = unknown>(fn: (v: V) => Promise<R>, opts: { success?: string; silentError?: boolean; onSuccess?: (r: R, v: V) => void } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: (r, v) => {
      qc.invalidateQueries();
      if (opts.success) toast.success(opts.success);
      opts.onSuccess?.(r, v);
    },
    onError: (e) => { if (!opts.silentError) toast.error(errorText(e)); },
  });
}
