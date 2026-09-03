import { useEffect, useMemo, useState } from "react";
import { faviconCandidatesForHost, hostOf } from "@/lib/engines";
import { faviconOf, cn } from "@/lib/utils";

const LOAD_TIMEOUT_MS = 3000;
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

export default function BookmarkIcon({
  url,
  size = 32,
  className,
}: {
  url: string;
  size?: number;
  className?: string;
}) {
  const host = useMemo(() => hostOf(url), [url]);
  const candidates = useMemo(
    () => faviconCandidatesForHost(host),
    [host],
  );
  const localFavicon = useMemo(() => faviconOf(url, size), [url, size]);
  
  const [loadedUrl, setLoadedUrl] = useState<string | null>(() => {
    const cachedIndex = cachedCandidateIndex(candidates);
    return cachedIndex >= 0 ? candidates[cachedIndex] : null;
  });

  useEffect(() => {
    let cancelled = false;
    const cachedIndex = cachedCandidateIndex(candidates);
    setLoadedUrl(cachedIndex >= 0 ? candidates[cachedIndex] : null);

    if (cachedIndex >= 0) return () => {
      cancelled = true;
    };

    const findCandidate = async () => {
      for (let next = 0; next < candidates.length; next += 1) {
        if (await loadCandidate(candidates[next]) && !cancelled) {
          setLoadedUrl(candidates[next]);
          return;
        }
        if (cancelled) return;
      }
      // 所有在线候选都失败，保持 loadedUrl 为 null，使用本地 favicon
    };
    void findCandidate();
    return () => {
      cancelled = true;
    };
  }, [candidates]);

  return (
    <img
      src={loadedUrl || localFavicon}
      alt=""
      className={cn("rounded", className)}
    />
  );
}
