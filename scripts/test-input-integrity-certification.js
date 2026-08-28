process.env.TZ='Europe/Rome';
const assert=require('node:assert/strict');
const I=require('./input-integrity-core.js');

const rows=[
  {institute:'Forsa',date:'2026-08-25'},
  {institute:'Verian',date:'2026-08-28'}
];
const common={
  now:'2026-08-28T19:00:00+02:00',
  acquiredAt:'2026-08-28T18:53:00+02:00',
  datasetRows:rows,
  usedRows:rows,
  staleAfterHours:36
};
const manual={
  status:'verified',
  mode:'manual',
  verifiedAt:'2026-08-28T18:29:00+02:00',
  eligible:rows
};
let r=I.evaluateIntegrity({...common,sourceVerification:manual});
assert.equal(r.state,'yellow','manual upstream verification must not self-certify green');
assert.equal(r.sourceVerified,true);
assert.equal(r.sourceCertified,false);
assert.equal(r.counts.expected,2);
assert.equal(r.counts.dataset,2);
assert.equal(r.counts.used,2);
assert.equal(r.counts.excluded,0);

const automated={...manual,mode:'automated'};
r=I.evaluateIntegrity({...common,sourceVerification:automated});
assert.equal(r.state,'green','fresh automated upstream verification may certify green');
assert.equal(r.sourceCertified,true);

r=I.evaluateIntegrity({...common,sourceVerification:manual,datasetRows:[rows[0]],usedRows:[rows[0]]});
assert.equal(r.state,'red','known missing eligible poll must override manual-yellow');
assert.equal(r.counts.excluded,1);

console.log('input-integrity certification tests passed');
