export function getSelectionPreviewItemId(selection: Selection): string | null {
  const selectedNode = selection.rangeCount
    ? selection.getRangeAt(0).commonAncestorContainer
    : selection.anchorNode;
  const selectedElement =
    selectedNode instanceof HTMLElement
      ? selectedNode
      : selectedNode?.parentElement;

  return (
    selectedElement?.closest<HTMLElement>("[data-preview-item-id]")?.dataset
      .previewItemId ?? null
  );
}

function findStrikethroughRange(
  content: string,
  selectionIndex: number,
): { start: number; end: number; textStart: number; textEnd: number } | null {
  return (
    findStrikethroughRanges(content).find(
      (range) =>
        selectionIndex >= range.textStart && selectionIndex < range.textEnd,
    ) ?? null
  );
}

function findStrikethroughRanges(
  content: string,
): Array<{ start: number; end: number; textStart: number; textEnd: number }> {
  const markerPattern = /~~([\s\S]*?)~~/g;
  let match: RegExpExecArray | null;
  const ranges: Array<{
    start: number;
    end: number;
    textStart: number;
    textEnd: number;
  }> = [];

  while ((match = markerPattern.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const textStart = start + 2;
    const textEnd = end - 2;

    ranges.push({ start, end, textStart, textEnd });
  }

  return ranges;
}

function buildStrikethroughPart(value: string): string {
  const content = value.trim();

  if (!content) {
    return value;
  }

  const leadingSpace = value.match(/^\s*/)?.[0] ?? "";
  const trailingSpace = value.match(/\s*$/)?.[0] ?? "";

  return `${leadingSpace}~~${content}~~${trailingSpace}`;
}

function findTextIgnoringStrikethroughMarkers(
  content: string,
  selectedText: string,
): { start: number; end: number } | null {
  const cleanSelectedText = selectedText.trim();

  if (!cleanSelectedText) {
    return null;
  }

  let plainContent = "";
  const markdownIndexByPlainIndex: number[] = [];

  for (let index = 0; index < content.length; index += 1) {
    if (content.slice(index, index + 2) === "~~") {
      index += 1;
      continue;
    }

    markdownIndexByPlainIndex.push(index);
    plainContent += content[index];
  }

  const plainSelectionIndex = plainContent.indexOf(cleanSelectedText);

  if (plainSelectionIndex < 0) {
    return null;
  }

  const plainSelectionEnd = plainSelectionIndex + cleanSelectedText.length - 1;
  const start = markdownIndexByPlainIndex[plainSelectionIndex];
  const end = markdownIndexByPlainIndex[plainSelectionEnd] + 1;

  return typeof start === "number" && typeof end === "number"
    ? { start, end }
    : null;
}

function isRangeFullyStruck(content: string, start: number, end: number) {
  const ranges = findStrikethroughRanges(content);
  let hasText = false;

  for (let index = start; index < end; index += 1) {
    if (content.slice(index, index + 2) === "~~") {
      index += 1;
      continue;
    }

    if (!content[index] || content[index].trim() === "") {
      continue;
    }

    hasText = true;

    const isInsideStrikethrough = ranges.some(
      (range) => index >= range.textStart && index < range.textEnd,
    );

    if (!isInsideStrikethrough) {
      return false;
    }
  }

  return hasText;
}

export function toggleStrikethroughInContent(
  content: string,
  selectedText: string,
): string | null {
  const cleanSelectedText = selectedText.trim();

  if (!cleanSelectedText) {
    return null;
  }

  const selectionRange = findTextIgnoringStrikethroughMarkers(
    content,
    cleanSelectedText,
  );

  if (!selectionRange) {
    return null;
  }

  const selectedMarkdownText = content.slice(
    selectionRange.start,
    selectionRange.end,
  );
  const selectedMarkdownTextWithoutMarkers = selectedMarkdownText.replace(
    /~~/g,
    "",
  );
  const isSelectionFullyStruck = isRangeFullyStruck(
    content,
    selectionRange.start,
    selectionRange.end,
  );
  const strikethroughRange = findStrikethroughRange(
    content,
    selectionRange.start,
  );

  if (!isSelectionFullyStruck) {
    return (
      content.slice(0, selectionRange.start) +
      `~~${selectedMarkdownTextWithoutMarkers}~~` +
      content.slice(selectionRange.end)
    );
  }

  if (!strikethroughRange && selectedMarkdownText.includes("~~")) {
    return (
      content.slice(0, selectionRange.start) +
      selectedMarkdownTextWithoutMarkers +
      content.slice(selectionRange.end)
    );
  }

  if (!strikethroughRange) {
    return null;
  }

  const strikethroughText = content.slice(
    strikethroughRange.textStart,
    strikethroughRange.textEnd,
  );
  const relativeSelectionIndex =
    selectionRange.start - strikethroughRange.textStart;
  const beforeSelection = strikethroughText.slice(0, relativeSelectionIndex);
  const afterSelection = strikethroughText.slice(
    relativeSelectionIndex + cleanSelectedText.length,
  );
  const nextParts = [
    beforeSelection ? buildStrikethroughPart(beforeSelection) : "",
    cleanSelectedText,
    afterSelection ? buildStrikethroughPart(afterSelection) : "",
  ];

  return (
    content.slice(0, strikethroughRange.start) +
    nextParts.join("") +
    content.slice(strikethroughRange.end)
  );
}

