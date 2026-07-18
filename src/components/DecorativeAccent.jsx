import { decorativeAccents } from "../data/decorative-accents.js";

const decorativeAccentsById = new Map(
  decorativeAccents.map((accent) => [accent.id, accent])
);

function escapeCssString(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\a ")
    .replace(/\r/g, "\\d ")
    .replace(/\f/g, "\\c ");
}

export function DecorativeAccent({ id }) {
  const accent = decorativeAccentsById.get(id);

  if (!accent) {
    if (import.meta.env.PROD) {
      return null;
    }

    throw new Error(`[DecorativeAccent] Unknown decorative accent ID: "${String(id)}".`);
  }

  return (
    <div
      className="decorative-accent dusk-cropped-strip"
      aria-hidden="true"
      data-testid={`decorative-accent-${id}`}
      data-accent-id={id}
      style={{
        "--decorative-accent-image": `url("${escapeCssString(accent.publicUrl)}")`,
        "--decorative-accent-position": accent.backgroundPosition,
      }}
    />
  );
}
