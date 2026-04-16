/**
 * Turns listing descriptions into a short card preview: bullet key points when
 * structure is detectable (lists, semicolons, sentences); otherwise a plain snippet.
 * No ML — lightweight heuristics only.
 */

export const DESC_PREVIEW_BULLET_MAX = 3;
const DESC_BULLET_MAX_CHARS = 78;

/** Line starts a list item: dash/bullet, or 1. / 1) (space after dot optional; avoids 2.0 decimals). */
const LINE_START_MARKER = /^\s*(?:[-•*]\s+|\d{1,2}\)\s+|\d{1,2}\.(?!\d)(?:\s+|$|(?=\S)))/;

/** Same markers appear after newline or space — for inline "1. a 2. b" without line breaks. */
const NUMBERED_ITEM_MARKER = /(?:^|[\n\s])(\d{1,2})\.(?!\d)(?:\s+|$|(?=\S)|(?=\n))/g;

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
  return line.replace(LINE_START_MARKER, '').trim();
}

/**
 * Finds "1. … 2. …" (and "1.Item" without space after the dot) anywhere in the text.
 * Does not treat "2.0" as a list marker.
 */
function tryNumberedSpans(trimmed: string): string[] | null {
  const t = trimmed.replace(/\r\n/g, '\n');
  const indices: { markStart: number; contentStart: number }[] = [];
  for (const m of t.matchAll(NUMBERED_ITEM_MARKER)) {
    if (m.index !== undefined) {
      indices.push({ markStart: m.index, contentStart: m.index + m[0].length });
    }
  }
  if (indices.length < 2) {
    return null;
  }
  const items: string[] = [];
  for (let i = 0; i < indices.length; i++) {
    const from = indices[i].contentStart;
    const to = i + 1 < indices.length ? indices[i + 1].markStart : t.length;
    let chunk = t.slice(from, to);
    if (i === indices.length - 1) {
      const firstPara = chunk.split(/\n\s*\n/)[0];
      if (firstPara !== undefined) {
        chunk = firstPara;
      }
    }
    const normalized = normalizeDescriptionWhitespace(chunk.trim());
    if (normalized.length > 0) {
      items.push(normalized);
    }
  }
  return items.length >= 2 ? items : null;
}

/** Newlines / explicit list markers → bullets. */
function tryLineBasedBullets(trimmed: string): string[] | null {
  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const markedLines = lines.filter((line) => LINE_START_MARKER.test(line));

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
    (lines.some((line) => LINE_START_MARKER.test(line)) ||
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

  const fromNumbered = tryNumberedSpans(trimmed);
  if (fromNumbered) {
    return {
      kind: 'bullets',
      items: fromNumbered.slice(0, DESC_PREVIEW_BULLET_MAX).map(capOneLine),
    };
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
