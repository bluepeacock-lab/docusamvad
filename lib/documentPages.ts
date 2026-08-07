import type { DocumentBlock, DocumentPage } from "./types";

// Sarvam Doc AI separates multi-page markdown with a standalone "---" line.
// "## Page N" headings are also handled defensively in case that format
// shows up for other document/pipeline configurations.
const PAGE_SEPARATOR_REGEX = /^##\s*Page\s+\d+$/i;

export function splitIntoPages(markdown: string): DocumentPage[] {
  const lines = markdown.split("\n");
  const rawPages: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isSeparator = trimmed === "---" || PAGE_SEPARATOR_REGEX.test(trimmed);
    if (isSeparator) {
      rawPages.push(current.join("\n").trim());
      current = [];
    } else {
      current.push(line);
    }
  }
  rawPages.push(current.join("\n").trim());

  const nonEmptyPages = rawPages.filter((p) => p.length > 0);
  if (nonEmptyPages.length === 0) {
    return [{ pageNumber: 1, content: "" }];
  }

  return nonEmptyPages.map((content, i) => ({ pageNumber: i + 1, content }));
}

export function parseBlocks(content: string): DocumentBlock[] {
  const lines = content.split("\n");
  const blocks: DocumentBlock[] = [];
  let listItems: string[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
      paragraphLines = [];
    }
  };
  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);

    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushParagraph();
      listItems.push(trimmed.slice(2));
    } else if (trimmed.length === 0) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraphLines.push(trimmed);
    }
  }
  flushParagraph();
  flushList();

  return blocks;
}
