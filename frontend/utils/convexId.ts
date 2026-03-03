const CONVEX_ID_PATTERN = /^[a-z0-9]{10,64}$/;

export function normalizeConvexId(id: string | string[] | undefined): string | null {
  if (typeof id !== 'string') {
    return null;
  }
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!CONVEX_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}
