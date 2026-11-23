#!/usr/bin/env node
/*
 * Syntaxcontrole voor HomeyScript-bestanden.
 *
 * HomeyScript voert een script uit als de body van een async functie.
 * Daardoor mogen `await` en `return` op het hoogste niveau staan, wat
 * `node --check` normaal afkeurt. Dit script verpakt elk bestand op
 * dezelfde manier en controleert alleen de syntax; er wordt niets uitgevoerd.
 *
 * Gebruik:
 *   node tools/check-scripts.js                 # alle scripts in scripts/
 *   node tools/check-scripts.js pad/naar/a.js   # specifieke bestanden
 *
 * Geen dependencies nodig.
 */

"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

function collect(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(full);
    return entry.isFile() && entry.name.endsWith(".js") ? [full] : [];
  });
}

const files = process.argv.length > 2
  ? process.argv.slice(2).map(f => path.resolve(f))
  : collect(path.join(root, "scripts"));

if (files.length === 0) {
  console.log("Geen scripts gevonden.");
  process.exit(0);
}

const WRAP_OFFSET = 1; // de wrapper voegt één regel toe vóór de code
let failed = 0;

for (const file of files) {
  const rel = path.relative(root, file);
  const code = fs.readFileSync(file, "utf8");
  try {
    new vm.Script(`(async function () {\n${code}\n})`, { filename: rel, lineOffset: -WRAP_OFFSET });
    console.log(`OK    ${rel}`);
  } catch (error) {
    failed++;
    const location = (error.stack || "").split("\n")[0];
    console.log(`FOUT  ${rel}`);
    console.log(`      ${location}`);
    console.log(`      ${error.message}`);
  }
}

console.log(`\n${files.length - failed}/${files.length} scripts zonder syntaxfouten.`);
process.exit(failed ? 1 : 0);
