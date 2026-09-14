/**
 * Minimal ZIP writer (store + deflate) — no third-party deps.
 * Creates ZIP with a single root directory for package safety.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createHash } from "node:crypto";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    }
  }
  return ~c >>> 0;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

/**
 * @param {string} outZipPath
 * @param {string} rootName zip internal root folder
 * @param {{ abs: string, rel: string }[]} files rel is path under rootName
 */
export function writeZipWithRoot(outZipPath, rootName, files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = fs.readFileSync(file.abs);
    const name = `${rootName}/${file.rel}`.replace(/\\/g, "/");
    if (name.includes("..") || path.isAbsolute(file.rel)) {
      throw new Error(`unsafe zip path: ${file.rel}`);
    }
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = zlib.deflateRawSync(data);
    const useStore = compressed.length >= data.length;
    const payload = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(data);

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      payload,
    ]);

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(0),
      u16(0),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);

    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  fs.mkdirSync(path.dirname(outZipPath), { recursive: true });
  fs.writeFileSync(outZipPath, Buffer.concat([...localParts, centralDir, end]));
}

export function sha256File(filePath) {
  const h = createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}
