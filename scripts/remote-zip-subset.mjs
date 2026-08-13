import { inflateRawSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import https from "node:https";

const [url, command = "list", patternSource = ".*", outputDirectory = "output/remote-zip", limitSource = "20"] = process.argv.slice(2);

if (!url) {
  console.error("Usage: node scripts/remote-zip-subset.mjs <url> <list|extract> <regex> [output-dir] [limit]");
  process.exit(1);
}

const pattern = new RegExp(patternSource, "i");
const limit = Math.max(1, Number.parseInt(limitSource, 10) || 20);

function requestBuffer(target, range, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(target, { headers: { Range: range } }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects >= 5) return reject(new Error("Trop de redirections HTTP."));
        return resolve(requestBuffer(new URL(response.headers.location, target), range, redirects + 1));
      }
      if (response.statusCode !== 206) {
        response.resume();
        return reject(new Error(`Le serveur n'a pas respecté la plage HTTP (${response.statusCode}).`));
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    request.setTimeout(120000, () => request.destroy(new Error("Délai réseau dépassé.")));
    request.on("error", reject);
  });
}

async function fetchRange(start, end) {
  return requestBuffer(url, `bytes=${start}-${end}`);
}

async function fetchTail(size) {
  return requestBuffer(url, `bytes=-${size}`);
}

function findSignatureFromEnd(buffer, signature) {
  for (let index = buffer.length - 4; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === signature) return index;
  }
  return -1;
}

let entryCount;
let directorySize;
let directory;

if (url.startsWith("local:")) {
  directory = readFileSync(url.slice("local:".length));
  directorySize = directory.length;
} else {
  const tail = await fetchTail(131072);
  const eocdOffset = findSignatureFromEnd(tail, 0x06054b50);
  if (eocdOffset < 0) throw new Error("Fin du répertoire ZIP introuvable.");
  entryCount = tail.readUInt16LE(eocdOffset + 10);
  directorySize = tail.readUInt32LE(eocdOffset + 12);
  const directoryOffset = tail.readUInt32LE(eocdOffset + 16);
  directory = await fetchRange(directoryOffset, directoryOffset + directorySize - 1);
}
const entries = [];
let cursor = 0;

while (cursor + 46 <= directory.length && directory.readUInt32LE(cursor) === 0x02014b50) {
  const method = directory.readUInt16LE(cursor + 10);
  const compressedSize = directory.readUInt32LE(cursor + 20);
  const uncompressedSize = directory.readUInt32LE(cursor + 24);
  const fileNameLength = directory.readUInt16LE(cursor + 28);
  const extraLength = directory.readUInt16LE(cursor + 30);
  const commentLength = directory.readUInt16LE(cursor + 32);
  const localHeaderOffset = directory.readUInt32LE(cursor + 42);
  const name = directory.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");
  entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
  cursor += 46 + fileNameLength + extraLength + commentLength;
}

const matches = entries.filter((entry) => pattern.test(entry.name) && !entry.name.endsWith("/")).slice(0, limit);
console.log(JSON.stringify({ entryCount: entryCount ?? entries.length, parsedEntries: entries.length, directorySize, matches }, null, 2));

if (command === "extract") {
  mkdirSync(outputDirectory, { recursive: true });
  for (const entry of matches) {
    const header = await fetchRange(entry.localHeaderOffset, entry.localHeaderOffset + 29);
    if (header.readUInt32LE(0) !== 0x04034b50) throw new Error(`En-tête local invalide : ${entry.name}`);
    const nameLength = header.readUInt16LE(26);
    const extraLength = header.readUInt16LE(28);
    const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
    const compressed = await fetchRange(dataStart, dataStart + entry.compressedSize - 1);
    const contents = entry.method === 0
      ? compressed
      : entry.method === 8
        ? inflateRawSync(compressed)
        : null;
    if (!contents) throw new Error(`Compression ZIP non prise en charge (${entry.method}) : ${entry.name}`);
    if (contents.length !== entry.uncompressedSize) throw new Error(`Taille extraite incorrecte : ${entry.name}`);
    const destination = join(outputDirectory, basename(entry.name));
    writeFileSync(destination, contents);
    console.log(`Extrait : ${destination}`);
  }
}
