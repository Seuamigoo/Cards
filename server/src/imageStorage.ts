import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ImageStorage {
  save(cardId: string, extension: string, bytes: Buffer): Promise<string>;
}

export class LocalImageStorage implements ImageStorage {
  constructor(private readonly directory: string) {}

  async save(cardId: string, extension: string, bytes: Buffer): Promise<string> {
    await mkdir(this.directory, { recursive: true });
    const filename = `${cardId}.${extension}`;
    await writeFile(join(this.directory, filename), bytes);
    return `uploads/${filename}`;
  }
}

export function imageExtension(bytes: Buffer, mime: string): string | null {
  const sniffed = sniff(bytes);
  if (sniffed === "png" && mime === "image/png") {
    return "png";
  }
  if (sniffed === "jpg" && (mime === "image/jpeg" || mime === "image/jpg")) {
    return "jpg";
  }
  if (sniffed === "webp" && mime === "image/webp") {
    return "webp";
  }
  return null;
}

function sniff(bytes: Buffer): "png" | "jpg" | "webp" | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}
