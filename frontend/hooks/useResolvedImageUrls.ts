import { useEffect, useMemo, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

export function useResolvedImageUrls(imageIds: string[], listingId?: Id<'listings'>) {
  const convex = useConvex();
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string | null>>({});
  const resolvedUrlsRef = useRef<Record<string, string | null>>({});

  useEffect(() => {
    resolvedUrlsRef.current = {};
    setResolvedUrls({});
  }, [listingId]);

  useEffect(() => {
    let cancelled = false;

    async function resolveImageUrls() {
      const unresolved = imageIds.filter(
        (storageId) => resolvedUrlsRef.current[storageId] === undefined
      );
      if (unresolved.length === 0 || !listingId) {
        return;
      }

      const nextEntries = await Promise.all(
        unresolved.map(async (storageId) => {
          try {
            const url = await convex.query(api.listings.getListingImageUrl, {
              listingId,
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
  }, [convex, imageIds, listingId]);

  const mappedUrls = useMemo(
    () => imageIds.map((storageId) => resolvedUrls[storageId] ?? null),
    [imageIds, resolvedUrls]
  );

  return {
    resolvedUrls,
    mappedUrls,
  };
}
