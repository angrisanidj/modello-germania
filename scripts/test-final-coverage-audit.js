const fs=require('node:fs'),assert=require('node:assert/strict');
const s=fs.readFileSync('scripts/audit-final-coverage.js','utf8');
for(const x of ["'50'","'80'","'95'","bucketSummary(obs,3,7)","NATIONAL_BACKTEST_DATA","NATIONAL_BACKTEST_REFERENCE","NATIONAL_BACKTEST_SIMS","dual-regime conservative audit","evaluateRegimes(model)","noEngineChange:true"])assert(s.includes(x),x);
assert(!s.includes('index.html","w'));
console.log('final coverage audit structural test passed');
