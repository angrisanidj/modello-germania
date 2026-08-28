const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const s=fs.readFileSync(path.join(__dirname,'audit-v2244-before-after.js'),'utf8');
for(const x of [
  "BEFORE-controlled-replay",
  "AFTER-recorded-current-runtime",
  "pollDatasetSignature()",
  "mcFingerprint(beforeAvg)",
  "runMonteCarloAsync(beforeAvg,token)",
  "beforeMc.seed!==beforeSeed",
  "pollytix @ 2026-08-21",
  "verian @ 2026-08-28",
  "sameEngine",
  "delta:resultDelta(before,after)"
])assert(s.includes(x),`missing audit invariant: ${x}`);
console.log('v22.4.4 paired audit structural test passed');
