export interface OutlineHeading {
  level: number;
  text: string;
  /** Zero-based line the heading is on. */
  lineIndex: number;
  /** GitHub-style anchor, so `[link](#my-heading)` can find it. */
  slug: string;
}

const ATX_HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/** Heading text without inline Markdown: `**bold**`, `` `code` ``, `[label](url)` and the like. */
function plainHeadingText(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`]/g, '')
    .trim();
}

/** The anchor GitHub gives a heading: lower case, punctuation removed, spaces as dashes. */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

/** The headings of a Markdown document, in order. Headings inside fenced code are skipped. */
export function extractOutline(text: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const slugCounts = new Map<string, number>();
  const lines = text.split('\n');
  let openFence: string | null = null;

  function addHeading(level: number, rawText: string, lineIndex: number) {
    const headingText = plainHeadingText(rawText);
    if (!headingText) return;
    const baseSlug = slugifyHeading(headingText);
    const count = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, count + 1);
    headings.push({ level, text: headingText, lineIndex, slug: count === 0 ? baseSlug : `${baseSlug}-${count}` });
  }

  lines.forEach((line, lineIndex) => {
    const fence = FENCE.exec(line)?.[1];
    if (openFence) {
      if (fence && fence[0] === openFence[0] && fence.length >= openFence.length) openFence = null;
      return;
    }
    if (fence) {
      openFence = fence;
      return;
    }
    const atx = ATX_HEADING.exec(line);
    if (atx) {
      addHeading(atx[1].length, atx[2], lineIndex);
      return;
    }
    const previousLine = lines[lineIndex - 1];
    const underline = SETEXT_UNDERLINE.exec(line)?.[1];
    if (underline && previousLine?.trim() && !ATX_HEADING.test(previousLine) && !/^\s*([-*+]|\d+[.)])\s/.test(previousLine)) {
      addHeading(underline.startsWith('=') ? 1 : 2, previousLine, lineIndex - 1);
    }
  });
  return headings;
}

/** The heading the cursor is under: the last one at or above its line. */
export function findCurrentHeading(headings: OutlineHeading[], cursorLineIndex: number): OutlineHeading | null {
  let current: OutlineHeading | null = null;
  for (const heading of headings) {
    if (heading.lineIndex > cursorLineIndex) break;
    current = heading;
  }
  return current;
}
