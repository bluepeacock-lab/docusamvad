const HIGHLIGHT_DURATION_MS = 3000;

export function parseSourcePageNumber(source: string): number | null {
  const match = source.match(/Page\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Page-level targeting only. The extracted document is wrapped with per-
// paragraph data-page/data-section attributes, but the model's cited
// "Section Y" is a label from its own reading of the document (e.g. a
// clause number), not the same thing as the auto-incremented paragraph
// index used to generate data-section — there's no reliable mapping
// between the two, so scrolling to a specific section would often land on
// the wrong paragraph. Scrolling to the page is the behavior that's
// actually reliable, since page numbers come from the same OCR page split
// the model was given.
export function scrollToSourcePage(pageNumber: number): boolean {
  const el = document.getElementById(`page-${pageNumber}`);
  if (!el) return false;

  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("source-highlight");
  setTimeout(() => {
    el.classList.remove("source-highlight");
  }, HIGHLIGHT_DURATION_MS);

  return true;
}
