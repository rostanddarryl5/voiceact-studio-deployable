import { readFileSync, writeFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { basename, join } from "node:path";

const [chunkPath, outputDirectory = ".", centralCompressedSize, centralUncompressedSize, centralMethod] = process.argv.slice(2);
if (!chunkPath) throw new Error("Usage: node scripts/extract-zip-entry.mjs <chunk.bin> [output-directory] [compressed-size] [uncompressed-size] [method]");

const chunk = readFileSync(chunkPath);
if (chunk.readUInt32LE(0) !== 0x04034b50) throw new Error("Ce fragment ne commence pas par une entrée ZIP locale.");
const flags = chunk.readUInt16LE(6);
const method = centralMethod == null ? chunk.readUInt16LE(8) : Number(centralMethod);
const compressedSize = centralCompressedSize == null ? chunk.readUInt32LE(18) : Number(centralCompressedSize);
const uncompressedSize = centralUncompressedSize == null ? chunk.readUInt32LE(22) : Number(centralUncompressedSize);
const nameLength = chunk.readUInt16LE(26);
const extraLength = chunk.readUInt16LE(28);
if ((flags & 0x08) && centralCompressedSize == null) throw new Error("Cette entrée exige les tailles du répertoire central.");
const name = chunk.subarray(30, 30 + nameLength).toString("utf8");
const dataStart = 30 + nameLength + extraLength;
const compressed = chunk.subarray(dataStart, dataStart + compressedSize);
const contents = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
if (!contents) throw new Error(`Compression ZIP non prise en charge : ${method}`);
if (contents.length !== uncompressedSize) throw new Error(`Taille incorrecte : ${contents.length}/${uncompressedSize}`);
const destination = join(outputDirectory, basename(name));
writeFileSync(destination, contents);
console.log(JSON.stringify({ name, destination, uncompressedSize }, null, 2));
