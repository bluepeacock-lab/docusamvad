import { renderInlineMarkdown } from "@/lib/markdown";
import { parseBlocks, splitIntoPages } from "@/lib/documentPages";
import type { JSX } from "react";

interface DocumentViewerProps {
  extractedText: string;
}

const HEADING_CLASSES: Record<number, string> = {
  1: "font-serif text-lg font-semibold text-heading",
  2: "font-serif text-base font-semibold text-heading",
  3: "font-serif text-sm font-semibold text-heading",
};

export default function DocumentViewer({ extractedText }: DocumentViewerProps) {
  const pages = splitIntoPages(extractedText);

  return (
    <div className="bg-background p-5">
      {pages.map((page) => {
        const blocks = parseBlocks(page.content);
        let sectionCounter = 0;

        return (
          <div key={page.pageNumber} id={`page-${page.pageNumber}`}>
            <div
              className={`text-center text-xs text-muted ${
                page.pageNumber === 1 ? "" : "mt-4 border-t border-border pt-3"
              }`}
            >
              — Page {page.pageNumber} —
            </div>

            <div className="mt-3 space-y-3">
              {blocks.map((block, i) => {
                sectionCounter += 1;
                const key = `${page.pageNumber}-${i}`;

                return (
                  <div key={key} data-page={page.pageNumber} data-section={sectionCounter}>
                    {block.type === "heading" ? (
                      (() => {
                        const Tag = `h${Math.min(block.level, 3)}` as keyof JSX.IntrinsicElements;
                        return (
                          <Tag className={HEADING_CLASSES[Math.min(block.level, 3)]}>
                            {renderInlineMarkdown(block.text, `h-${key}`)}
                          </Tag>
                        );
                      })()
                    ) : block.type === "list" ? (
                      <ul className="ml-4 list-disc space-y-1 text-sm text-body marker:text-muted">
                        {block.items.map((item, j) => (
                          <li key={j}>{renderInlineMarkdown(item, `li-${key}-${j}`)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm leading-relaxed text-body">
                        {renderInlineMarkdown(block.text, `p-${key}`)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
