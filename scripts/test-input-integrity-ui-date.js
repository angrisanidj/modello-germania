const assert=require('node:assert/strict');
const fs=require('node:fs');
const s=fs.readFileSync(__dirname+'/input-integrity-ui.js','utf8');
assert.match(s,/const pollDate=v=>CORE\.calendarDateKey\(v\)/,'UI must use core civil-date normalization for poll dates');
assert.match(s,/date:pollDate\(p\.date\)/,'manifest poll rows must use civil poll dates');
assert.match(s,/avgData=\{date:pollDate\(avg\?\.date\)\}/,'manifest average date must use civil poll date');
assert.doesNotMatch(s,/date:isoDate\(p\.date\)\?\.slice\(0,10\)/,'poll rows must not be serialized through UTC ISO date');
console.log('input-integrity UI civil-date structural test passed');
