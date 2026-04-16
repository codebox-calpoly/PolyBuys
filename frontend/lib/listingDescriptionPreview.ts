/**
 * Turns listing descriptions into a short card preview: bullet key points when
 * structure is detectable (lists, semicolons, sentences); otherwise a plain snippet.
 * No ML — lightweight heuristics only.
 */

export const DESC_PREVIEW_BULLET_MAX = 3;
const DESC_BULLET_MAX_CHARS = 78;
const DESC_LINE_LEADING_MARKERS = /^\s*(?:[-•*]|\d{1,2}(?:\.|\)|\]))\s+/;

export type DescriptionPreview =
  | { kind: 'none' }
  | { kind: 'plain'; text: string }
  | { kind: 'bullets'; items: string[] };

export function normalizeDescriptionWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function capOneLine(oneLine: string): string {
  if (oneLine.length <= DESC_BULLET_MAX_CHARS) {
    return oneLine;
  }
  return `${oneLine.slice(0, DESC_BULLET_MAX_CHARS - 1)}…`;
}

function stripLeadingMarker(line: string): string {
  return line.replace(DESC_LINE_LEADING_MARKERS, '').trim();
}

/** Newlines / explicit list markers → bullets. */
function tryLineBasedBullets(trimmed: string): string[] | null {
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const markedLines = lines.filter((line) => DESC_LINE_LEADING_MARKERS.test(line));

  // Two or more real list lines: only those — omit trailing prose after the last bullet.
  if (markedLines.length >= 2) {
    return markedLines.slice(0, DESC_PREVIEW_BULLET_MAX).map((line) => {
      const stripped = stripLeadingMarker(line);
      return capOneLine(normalizeDescriptionWhitespace(stripped));
    });
  }

  const looksLikeList =
    lines.length >= 2 &&
    lines.length <= 10 &&
    lines.every((line) => line.length <= 220) &&
    (lines.some((line) => DESC_LINE_LEADING_MARKERS.test(line)) ||
      lines.every((line) => line.length <= 140));

  if (!looksLikeList) {
    return null;
  }

  return lines.slice(0, DESC_PREVIEW_BULLET_MAX).map((line) => {
    const stripped = stripLeadingMarker(line);
    return capOneLine(normalizeDescriptionWhitespace(stripped));
  });
}

/** "Pickup on campus; cash only; includes charger" → bullets. */
function trySemicolonBullets(text: string): string[] | null {
  if (!text.includes(';')) {
    return null;
  }
  const parts = text
    .split(';')
    .map((p) => normalizeDescriptionWhitespace(p))
    .filter((p) => p.length >= 10);
  if (parts.length < 2 || parts.length > 8) {
    return null;
  }
  if (!parts.every((p) => p.length <= 200)) {
    return null;
  }
  return parts.slice(0, DESC_PREVIEW_BULLET_MAX).map(capOneLine);
}

function segmentSentencesIntl(text: string): string[] | null {
  try {
    const Ctor = Intl.Segmenter;
    if (typeof Ctor !== 'function') {
      return null;
    }
    const segmenter = new Ctor('en', { granularity: 'sentence' });
    const out: string[] = [];
    for (const { segment } of segmenter.segment(text)) {
      const s = normalizeDescriptionWhitespace(segment);
      if (s.length >= 18 && s.length <= 280) {
        out.push(s);
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/** Rough sentence split when Intl.Segmenter is unavailable (e.g. some Hermes builds). */
function segmentSentencesFallback(text: string): string[] {
  const normalized = normalizeDescriptionWhitespace(text);
  if (!normalized) {
    return [];
  }
  const chunks = normalized.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).map((s) => s.trim());
  return chunks.filter((s) => s.length >= 18 && s.length <= 280);
}

function trySentenceBullets(text: string): string[] | null {
  const sentences = segmentSentencesIntl(text) ?? segmentSentencesFallback(text);
  if (sentences.length < 2) {
    return null;
  }
  return sentences.slice(0, DESC_PREVIEW_BULLET_MAX).map(capOneLine);
}

/**
 * Prefer structured bullets; otherwise one normalized paragraph for a 2-line ellipsis in the UI.
 */
export function buildDescriptionPreview(raw: string): DescriptionPreview {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    return { kind: 'none' };
  }

  const fromLines = tryLineBasedBullets(trimmed);
  if (fromLines) {
    return { kind: 'bullets', items: fromLines };
  }

  const normalizedOneLine = normalizeDescriptionWhitespace(trimmed);

  const fromSemi = trySemicolonBullets(trimmed);
  if (fromSemi) {
    return { kind: 'bullets', items: fromSemi };
  }

  const fromSentences = trySentenceBullets(trimmed);
  if (fromSentences) {
    return { kind: 'bullets', items: fromSentences };
  }

  if (!normalizedOneLine) {
    return { kind: 'none' };
  }
  return { kind: 'plain', text: normalizedOneLine };
}
