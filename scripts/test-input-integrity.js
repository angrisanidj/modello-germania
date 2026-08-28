process.env.TZ='Europe/Rome';
const assert=require('node:assert/strict');
const I=require('./input-integrity-core.js');
const polls=[{institute:'YouGov',date:'2026-08-21',afd:28},{institute:'pollytix',date:'2026-08-21',afd:28},{institute:'Forsa',date:'2026-08-25',afd:28},{institute:'Verian',date:'2026-08-28',afd:28},{institute:'Infratest dimap',date:'2026-08-06',afd:28},{institute:'YouGov',date:'2026-08-10',afd:27}];
const eligible=I.latestEligibleByInstitute(polls,'2026-08-28',14);
assert.deepEqual(eligible.map(x=>I.normalizeInstituteName(x.institute)).sort(),['forsa','pollytix','verian','yougov']);
assert.equal(I.normalizeInstituteName('Forschungsgruppe Wahlen'),'fg wahlen');assert.equal(I.normalizeInstituteName('FG Wahlen'),'fg wahlen');assert.equal(I.normalizeInstituteName('IfD Allensbach'),'ifd allensbach');assert.equal(I.normalizeInstituteName('Allensbach'),'ifd allensbach');
const base={now:'2026-08-28T18:00:00Z',sourceVerification:{status:'verified',verifiedAt:'2026-08-28T17:00:00Z',mode:'manual',eligible:[{institute:'YouGov',date:'2026-08-21'},{institute:'pollytix',date:'2026-08-21'},{institute:'Forsa',date:'2026-08-25'},{institute:'Verian',date:'2026-08-28'}]},acquiredAt:'2026-08-28T17:30:00Z',datasetRows:eligible,usedRows:eligible,staleAfterHours:36};
let r=I.evaluateIntegrity(base);assert.equal(r.state,'yellow');assert.equal(r.sourceCertified,false);
r=I.evaluateIntegrity({...base,datasetRows:eligible.filter(x=>x.institute!=='pollytix')});assert.equal(r.state,'red');assert.deepEqual(r.missingUpstream,['pollytix @ 2026-08-21']);
r=I.evaluateIntegrity({...base,usedRows:eligible.filter(x=>x.institute!=='Verian')});assert.equal(r.state,'red');assert.deepEqual(r.missingModel,['verian @ 2026-08-28']);

r=I.evaluateIntegrity({...base,datasetRows:eligible.map(x=>x.institute==='Verian'?{...x,date:'2026-08-27'}:x)});assert.equal(r.state,'red');assert.ok(r.missingUpstream.includes('verian @ 2026-08-28'));assert.ok(r.unexpectedDataset.includes('verian @ 2026-08-27'));
r=I.evaluateIntegrity({...base,datasetRows:[...eligible,{institute:'Ipsos',date:'2026-08-28'}],usedRows:[...eligible,{institute:'Ipsos',date:'2026-08-28'}]});assert.equal(r.state,'red');assert.deepEqual(r.unexpectedDataset,['ipsos @ 2026-08-28']);
r=I.evaluateIntegrity({...base,sourceVerification:{...base.sourceVerification,status:'unverified'}});assert.equal(r.state,'yellow');
r=I.evaluateIntegrity({...base,sourceVerification:{...base.sourceVerification,verifiedAt:'2026-08-25T00:00:00Z'}});assert.equal(r.state,'yellow');
const ma=I.buildRunManifest({schemaVersion:1,appVersion:'22.4.4',engineVersion:'v22.4.1-residual-fix',inputFingerprint:'abc',seed:123,sourceVerification:base.sourceVerification,acquiredAt:base.acquiredAt,avg:{date:'2026-08-28',afd:28.06,union:21.1},weights:[{institute:'YouGov',weight:.2},{institute:'Forsa',weight:.3}],integrity:I.evaluateIntegrity(base)});
const mb=I.buildRunManifest({schemaVersion:1,appVersion:'22.4.4',engineVersion:'v22.4.1-residual-fix',inputFingerprint:'abc',seed:123,sourceVerification:base.sourceVerification,acquiredAt:base.acquiredAt,avg:{union:21.1,date:'2026-08-28',afd:28.06},weights:[{institute:'Forsa',weight:.3},{institute:'YouGov',weight:.2}],integrity:I.evaluateIntegrity(base)});
assert.equal(JSON.stringify(ma),JSON.stringify(mb));console.log('input-integrity tests passed');

// Regression: poll publication dates are civil dates, not UTC instants.
// In Europe/Rome a native parsed 25.08.2026 at local midnight serializes to 24T22:00Z.
const localMidnightForsa=new Date(2026,7,25,0,0,0,0);
const noonVerian=new Date('2026-08-28T12:00:00+02:00');
const civilEligible=I.latestEligibleByInstitute([
  {institute:'Forsa',date:localMidnightForsa},
  {institute:'Verian',date:noonVerian}
],'2026-08-28',14);
assert.equal(civilEligible.length,2,'same-day Verian must not be excluded by UTC-midnight asOf');
const civilIntegrity=I.evaluateIntegrity({
  now:'2026-08-28T18:00:00+02:00',
  sourceVerification:{status:'verified',verifiedAt:'2026-08-28T17:00:00+02:00',mode:'manual',eligible:[{institute:'Forsa',date:'2026-08-25'},{institute:'Verian',date:'2026-08-28'}]},
  acquiredAt:'2026-08-28T17:30:00+02:00',
  datasetRows:civilEligible,usedRows:civilEligible,staleAfterHours:36
});
assert.equal(civilIntegrity.state,'yellow','civil publication dates must match while manual upstream remains uncertified');
