const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.join(__dirname,'input-integrity-ui.js'),'utf8');
assert(s.includes("Input completo · upstream manuale"));
assert(s.includes("Freshness upstream"));
assert(s.includes("r.sourceCertified?'ok':'warn'"));
assert(s.includes("Fonte eleggibile: ${r.counts.expected} · Acquisiti: ${r.counts.dataset} · Usati: ${r.counts.used} · Esclusi: ${r.counts.excluded??0}"));
assert(s.includes("Il verde richiede una verifica upstream automatizzata/certificata"));
console.log('input-integrity certification UI structural test passed');
