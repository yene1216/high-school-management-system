import { useEffect, useState } from "react";
import { fetchBlob } from "../../api/client";

/** Private image (student photo): fetched with the bearer token, shown from a temporary object URL. */
export function AuthImage({ path, alt, className = "", fallback }: { path: string | null; alt: string; className?: string; fallback?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setSrc(null); return; }
    let url: string | null = null;
    let cancelled = false;
    fetchBlob(path.replace(/^\/api\/v1/, "")).then((b) => { if (!cancelled) { url = URL.createObjectURL(b); setSrc(url); } }).catch(() => setSrc(null));
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  if (!src) {
    return <div aria-label={alt} role="img" className={`flex items-center justify-center bg-board text-lg font-semibold text-board-ink ${className}`}>{fallback ?? alt.slice(0, 1)}</div>;
  }
  return <img src={src} alt={alt} className={`object-cover ${className}`} />;
}
