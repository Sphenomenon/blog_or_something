import { useMemo } from "react";
import { segmentText } from "torph";

const graphemeSegmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh-CN", { granularity: "grapheme" }) : null;

function prepareSegments(text, limit) {
  let end = 0;
  let count = 0;
  const characters = graphemeSegmenter ? graphemeSegmenter.segment(text) : Array.from(text, (segment) => ({ segment }));
  for (const character of characters) {
    if (count++ >= limit) break;
    end += character.segment.length;
  }
  let position = 0;
  return segmentText(text.slice(0, end), "zh-CN", false).flatMap((segment) => {
    const characters = graphemeSegmenter ? [...graphemeSegmenter.segment(segment.string)].map((part) => part.segment) : Array.from(segment.string);
    return characters.map((string, index) => {
      const result = { id: `${segment.id}-${index}`, string: text.slice(position, position + string.length), offset: position };
      position += string.length;
      return result;
    });
  });
}

export function SharedText({ children, limit = 80 }) {
  const text = typeof children === "string" || typeof children === "number" ? String(children) : null;
  const segments = useMemo(() => text === null ? [] : prepareSegments(text, limit), [text, limit]);
  if (text === null) return children;
  return (
    <span className="shared-text">
      {segments.map((segment) => (
        <span key={segment.id} data-shared-glyph={segment.string} data-shared-offset={segment.offset}>{segment.string}</span>
      ))}
      {text.slice(segments.at(-1) ? segments.at(-1).offset + segments.at(-1).string.length : 0)}
    </span>
  );
}
