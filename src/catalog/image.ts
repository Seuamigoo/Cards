import type { CardImage } from "../domain/state";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

export function readCardImage(value: unknown): CardImage | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.src !== "string" || !isValidImageSrc(record.src)) {
    return null;
  }
  if (record.alt !== undefined && typeof record.alt !== "string") {
    return null;
  }
  return {
    src: record.src,
    ...(typeof record.alt === "string" ? { alt: record.alt } : {}),
  };
}

export function isValidImageSrc(src: string): boolean {
  if (src.length === 0 || src.trim() !== src) {
    return false;
  }
  if (hasScheme(src)) {
    return isHttpsUrl(src);
  }
  if (src.startsWith("/") || src.startsWith("\\") || src.includes("..")) {
    return false;
  }
  const path = src.split("?")[0]?.split("#")[0] ?? "";
  const dot = path.lastIndexOf(".");
  if (dot < 0) {
    return false;
  }
  return IMAGE_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

function hasScheme(src: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src);
}

function isHttpsUrl(src: string): boolean {
  const match = /^https:\/\/([^/?#\s]+)(?:[/?#][^\s]*)?$/i.exec(src);
  return match !== null && (match[1]?.length ?? 0) > 0;
}
