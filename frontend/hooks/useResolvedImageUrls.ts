import { useEffect, useMemo, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from '../../backend/convex/_generated/dataModel';

function isRemoteUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

export function useResolvedImageUrls(imageIds: string[]) {
  const convex = useConvex();
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string | null>>({});
  const resolvedUrlsRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    let cancelled = false;

    async function resolveImageUrls() {
      const unresolved = imageIds.filter(
        (storageId) => !isRemoteUrl(storageId) && resolvedUrlsRef.current[storageId] === undefined
      );
      if (unresolved.length === 0) {
        return;
      }

      const nextEntries = await Promise.all(
        unresolved.map(async (storageId) => {
          try {
            const url = await convex.query(api.listings.getListingImageUrl, {
              storageId: storageId as Id<'_storage'>,
            });
            return [storageId, url ?? null] as const;
          } catch {
            return [storageId, null] as const;
          }
        })
      );

      if (cancelled) {
        return;
      }

      setResolvedUrls((prev) => {
        const next = { ...prev };
        for (const [storageId, url] of nextEntries) {
          next[storageId] = url;
        }
        resolvedUrlsRef.current = next;
        return next;
      });
    }

    void resolveImageUrls();

    return () => {
      cancelled = true;
    };
  }, [convex, imageIds]);

  const mappedUrls = useMemo(
    () =>
      imageIds.map((storageId) =>
        isRemoteUrl(storageId) ? storageId : (resolvedUrls[storageId] ?? null)
      ),
    [imageIds, resolvedUrls]
  );

  return {
    resolvedUrls,
    mappedUrls,
  };
}
