import { useEffect, useMemo, useState } from "react";
import type { EngineDef } from "@/lib/engines";
import { faviconCandidates } from "@/lib/engines";
import { cn } from "@/lib/utils";

const LOAD_TIMEOUT_MS = 2000;
const candidateResults = new Map<string, boolean>();
const candidateLoads = new Map<string, Promise<boolean>>();

function loadCandidate(url: string): Promise<boolean> {
  const cached = candidateResults.get(url);
  if (cached !== undefined) return Promise.resolve(cached);

  const existing = candidateLoads.get(url);
  if (existing) return existing;

  const promise = new Promise<boolean>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (valid: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      candidateResults.set(url, valid);
      candidateLoads.delete(url);
      resolve(valid);
    };
    const timer = window.setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
    image.onload = () =>
      finish(image.naturalWidth >= 16 && image.naturalHeight >= 16);
    image.onerror = () => finish(false);
    image.src = url;
  });
  candidateLoads.set(url, promise);
  return promise;
}

function cachedCandidateIndex(candidates: string[]): number {
  return candidates.findIndex((url) => candidateResults.get(url) === true);
}

export default function EngineIcon({
  engine,
  className,
}: {
  engine: EngineDef;
  className?: string;
}) {
  const candidates = useMemo(
    () => faviconCandidates(engine),
    [engine.id, engine.host],
  );
  const [index, setIndex] = useState(() => cachedCandidateIndex(candidates));
  const [loadedUrl, setLoadedUrl] = useState(() => {
    const cachedIndex = cachedCandidateIndex(candidates);
    return cachedIndex >= 0 ? candidates[cachedIndex] : null;
  });

  useEffect(() => {
    let cancelled = false;
    const cachedIndex = cachedCandidateIndex(candidates);
    setIndex(cachedIndex);
    setLoadedUrl(cachedIndex >= 0 ? candidates[cachedIndex] : null);

    if (cachedIndex >= 0) return () => {
      cancelled = true;
    };

    const findCandidate = async () => {
      for (let next = 0; next < candidates.length; next += 1) {
        if (await loadCandidate(candidates[next]) && !cancelled) {
          setIndex(next);
          setLoadedUrl(candidates[next]);
          return;
        }
        if (cancelled) return;
      }
      if (!cancelled) setIndex(candidates.length);
    };
    void findCandidate();
    return () => {
      cancelled = true;
    };
  }, [candidates]);

  const fallback = (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded bg-muted text-[0.65em] font-semibold text-muted-foreground",
        className,
      )}
      aria-hidden="true"
    >
      {(engine.name.trim()[0] || "?").toUpperCase()}
    </span>
  );

  if (index >= candidates.length) return fallback;

  return loadedUrl ? (
    <img
      src={loadedUrl}
      alt=""
      className={cn("rounded", className)}
    />
  ) : fallback;
}
