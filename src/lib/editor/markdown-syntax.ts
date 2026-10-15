import { tags } from '@lezer/highlight';
import type { BlockContext, InlineContext, Line, MarkdownConfig } from '@lezer/markdown';

// Character codes the parsers look for.
const DOLLAR = 36;
const EQUALS = 61;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;
const CARET = 94;
const BACKSLASH = 92;
const SPACE = 32;
const TAB = 9;
const NEWLINE = 10;

const PUNCTUATION = /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~\xA1‐-‧]/;
const FOOTNOTE_DEFINITION = /^\[\^[^\]\s]+\]:/;

function isWhitespace(code: number): boolean {
  return code === SPACE || code === TAB || code === NEWLINE || code === -1;
}

function isDigit(code: number): boolean {
  return code >= 48 && code <= 57;
}

const highlightDelimiter = { resolve: 'Highlight', mark: 'HighlightMark' };

/** `==highlighted text==` (Obsidian, Typora, Bear). Opens and closes like `~~strikethrough~~`. */
const Highlight: MarkdownConfig = {
  defineNodes: [
    { name: 'Highlight', style: { 'Highlight/...': tags.special(tags.content) } },
    { name: 'HighlightMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'Highlight',
      parse(cx: InlineContext, next: number, position: number) {
        if (next !== EQUALS || cx.char(position + 1) !== EQUALS || cx.char(position + 2) === EQUALS) return -1;
        const before = cx.slice(position - 1, position);
        const after = cx.slice(position + 2, position + 3);
        const isSpaceBefore = /\s|^$/.test(before);
        const isSpaceAfter = /\s|^$/.test(after);
        const isPunctuationBefore = PUNCTUATION.test(before);
        const isPunctuationAfter = PUNCTUATION.test(after);
        return cx.addDelimiter(
          highlightDelimiter,
          position,
          position + 2,
          !isSpaceAfter && (!isPunctuationAfter || isSpaceBefore || isPunctuationBefore),
          !isSpaceBefore && (!isPunctuationBefore || isSpaceAfter || isPunctuationAfter),
        );
      },
      after: 'Emphasis',
    },
  ],
};

/**
 * Inline math, `$x^2$`, following GitHub's rules: no space just inside the dollars, and a closing `$` followed by
 * a digit doesn't count, so prices like "$5 and $10" stay text.
 */
const InlineMath: MarkdownConfig = {
  defineNodes: [
    { name: 'InlineMath', style: tags.monospace },
    { name: 'InlineMathMark', style: tags.processingInstruction },
  ],
  parseInline: [
    {
      name: 'InlineMath',
      parse(cx: InlineContext, next: number, position: number) {
        if (next !== DOLLAR || cx.char(position + 1) === DOLLAR || isWhitespace(cx.char(position + 1))) return -1;
        for (let end = position + 1; end < cx.end; end++) {
          const code = cx.char(end);
          if (code === NEWLINE) return -1;
          if (code === BACKSLASH) {
            end++;
            continue;
          }
          if (code !== DOLLAR || isWhitespace(cx.char(end - 1)) || isDigit(cx.char(end + 1))) continue;
          return cx.addElement(
            cx.elt('InlineMath', position, end + 1, [cx.elt('InlineMathMark', position, position + 1), cx.elt('InlineMathMark', end, end + 1)]),
          );
        }
        return -1;
      },
      before: 'Emphasis',
    },
  ],
};

/** Display math between `$$` lines (or `$$ … $$` on one line). Like a code fence, it runs to the closing `$$`. */
const BlockMath: MarkdownConfig = {
  defineNodes: [
    { name: 'BlockMath', block: true, style: tags.monospace },
    { name: 'BlockMathMark', style: tags.processingInstruction },
  ],
  parseBlock: [
    {
      name: 'BlockMath',
      parse(cx: BlockContext, line: Line) {
        const text = line.text.slice(line.pos);
        if (!text.startsWith('$$')) return false;
        const start = cx.lineStart + line.pos;
        const openingMark = cx.elt('BlockMathMark', start, start + 2);
        const isSingleLine = text.trimEnd().length > 4 && text.trimEnd().endsWith('$$');
        if (isSingleLine) {
          const closeEnd = start + text.trimEnd().length;
          cx.addElement(cx.elt('BlockMath', start, closeEnd, [openingMark, cx.elt('BlockMathMark', closeEnd - 2, closeEnd)]));
          cx.nextLine();
          return true;
        }
        let end = cx.lineStart + line.text.length;
        const children = [openingMark];
        while (cx.nextLine()) {
          end = cx.lineStart + line.text.length;
          const closeIndex = line.text.trimEnd().lastIndexOf('$$');
          if (closeIndex !== -1 && line.text.trimEnd().endsWith('$$')) {
            children.push(cx.elt('BlockMathMark', cx.lineStart + closeIndex, cx.lineStart + closeIndex + 2));
            end = cx.lineStart + closeIndex + 2;
            cx.nextLine();
            break;
          }
        }
        cx.addElement(cx.elt('BlockMath', start, end, children));
        return true;
      },
      before: 'FencedCode',
    },
  ],
};

/** Footnotes, as on GitHub: `[^note]` in the text and `[^note]: The footnote.` lines (until a blank line). */
const Footnotes: MarkdownConfig = {
  defineNodes: [
    { name: 'FootnoteReference', style: tags.link },
    { name: 'FootnoteMark', style: tags.processingInstruction },
    { name: 'FootnoteDefinition', block: true },
    { name: 'FootnoteLabel', style: tags.labelName },
  ],
  parseInline: [
    {
      name: 'FootnoteReference',
      parse(cx: InlineContext, next: number, position: number) {
        if (next !== OPEN_BRACKET || cx.char(position + 1) !== CARET) return -1;
        let end = position + 2;
        while (end < cx.end && cx.char(end) !== CLOSE_BRACKET) {
          const code = cx.char(end);
          if (isWhitespace(code) || code === OPEN_BRACKET) return -1;
          end++;
        }
        if (end >= cx.end || end === position + 2) return -1;
        return cx.addElement(
          cx.elt('FootnoteReference', position, end + 1, [cx.elt('FootnoteMark', position, position + 2), cx.elt('FootnoteMark', end, end + 1)]),
        );
      },
      before: 'Link',
    },
  ],
  parseBlock: [
    {
      name: 'FootnoteDefinition',
      parse(cx: BlockContext, line: Line) {
        const label = FOOTNOTE_DEFINITION.exec(line.text.slice(line.pos));
        if (!label) return false;
        const start = cx.lineStart + line.pos;
        const labelEnd = start + label[0].length;
        let content = line.text.slice(line.pos + label[0].length);
        let end = cx.lineStart + line.text.length;
        // Following lines belong to the footnote until a blank line or the next footnote.
        while (cx.nextLine() && line.text.trim() !== '' && !FOOTNOTE_DEFINITION.test(line.text.slice(line.pos))) {
          content += `\n${line.text}`;
          end = cx.lineStart + line.text.length;
        }
        cx.addElement(cx.elt('FootnoteDefinition', start, end, [cx.elt('FootnoteLabel', start, labelEnd), ...cx.parser.parseInline(content, labelEnd)]));
        return true;
      },
      before: 'LinkReference',
    },
  ],
};

/** Markdown syntax beyond GitHub Flavored Markdown's core that Jot understands: highlights, math and footnotes. */
export const markdownSyntaxExtensions: MarkdownConfig[] = [Highlight, InlineMath, BlockMath, Footnotes];
