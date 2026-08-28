(async function(){
'use strict';
if(typeof state==='undefined'||typeof projectionAverage!=='function'||typeof runMonteCarloAsync!=='function')throw new Error('Apri prima la dashboard completa e attendi il Monte Carlo.');
if(!state.monteCarlo?.ready)throw new Error('Attendi il completamento delle 50.000 simulazioni AFTER.');
if(typeof districtState==='undefined'||!districtState.ready)throw new Error('Attendi il caricamento dei 299 collegi.');
const CORE=globalThis.InputIntegrity;if(!CORE)throw new Error('InputIntegrity core non disponibile.');
const civil=v=>CORE.calendarDateKey(v);
const norm=v=>CORE.normalizeInstituteName(v);
const isSupplement=p=>(norm(p?.institute)==='pollytix'&&civil(p?.date)==='2026-08-21')||(norm(p?.institute)==='verian'&&civil(p?.date)==='2026-08-28');
const pollFor=p=>{const o={institute:p.institute,date:civil(p.date)};for(const k of MC_KEYS)if(Number.isFinite(p[k]))o[k]=p[k];return o};
const avgFor=a=>{const o={date:civil(a?.date)};for(const k of MC_KEYS)if(Number.isFinite(a?.[k]))o[k]=a[k];return o};
const weightsFor=a=>{if(!a?.rows?.length)return[];const end=dayKey(a.date),tmp=[];let total=0;for(const p of a.rows){const age=Math.max(0,(end-dayKey(p.date))/DAY),rel=a.reliability?.get?.(String(p.institute||'').trim().toLowerCase())||1,raw=Math.pow(.5,age/7)*rel;tmp.push({institute:p.institute,date:civil(p.date),ageDays:age,reliability:rel,rawWeight:raw});total+=raw}return tmp.map(x=>({...x,weight:total?x.rawWeight/total:0}))};
const coalitionGroups={
  union_spd:['union','spd'],union_gruene:['union','gruene'],union_spd_gruene:['union','spd','gruene'],
  union_gruene_linke:['union','gruene','linke'],union_spd_linke:['union','spd','linke'],
  spd_gruene_linke:['spd','gruene','linke'],union_fdp:['union','fdp'],union_afd:['union','afd']
};
function mcSummary(mc){
  const stats={};for(const k of MC_SEAT_KEYS){const x=mc?.stats?.[k];if(x)stats[k]={low:x.low,median:x.median,high:x.high,positiveMedian:x.positiveMedian??null,entry:x.entry??null,over5:x.over5??null,threeSeat:x.threeSeat??null,leader:x.leader??null}}
  const coalitionMajority={};for(const [name,keys] of Object.entries(coalitionGroups)){const mask=coalitionMask(keys);coalitionMajority[name]=mask&&mc?.coalitionWins?.length?(mc.coalitionWins[mask]||0)/mc.n:null}
  const singlePartyMajority={};for(const k of MC_SEAT_KEYS){const mask=coalitionMask([k]);singlePartyMajority[k]=mask&&mc?.coalitionWins?.length?(mc.coalitionWins[mask]||0)/mc.n:null}
  return{n:mc?.n??null,seed:mc?.seed??null,centralSeats:{...(mc?.centralSeats||{})},stats,coalitionMajority,singlePartyMajority};
}
const deltaObj=(a,b)=>{const o={};for(const k of new Set([...Object.keys(a||{}),...Object.keys(b||{})]))if(Number.isFinite(a?.[k])&&Number.isFinite(b?.[k]))o[k]=b[k]-a[k];return o};
function resultDelta(before,after){
  const d={avg:deltaObj(before.avg,after.avg),centralSeats:deltaObj(before.results.centralSeats,after.results.centralSeats),leaderProbability:{},entryProbability:{},singlePartyMajority:deltaObj(before.results.singlePartyMajority,after.results.singlePartyMajority),coalitionMajority:deltaObj(before.results.coalitionMajority,after.results.coalitionMajority)};
  for(const k of MC_SEAT_KEYS){const bs=before.results.stats[k],as=after.results.stats[k];if(Number.isFinite(bs?.leader)&&Number.isFinite(as?.leader))d.leaderProbability[k]=as.leader-bs.leader;if(Number.isFinite(bs?.entry)&&Number.isFinite(as?.entry))d.entryProbability[k]=as.entry-bs.entry}
  return d;
}
const sourceVerification=await fetch(`./data/source-verification.json?v=${Date.now()}`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('source-verification HTTP '+r.status);return r.json()});
const acquiredAt=state.fetchedAt instanceof Date?state.fetchedAt.toISOString():new Date(state.fetchedAt).toISOString();
const originalPolls=state.polls;
const afterAvg=projectionAverage();
const afterFp=pollDatasetSignature();
const afterMcFp=mcFingerprint(afterAvg);
if(state.mcFingerprint!==afterMcFp)throw new Error('Il Monte Carlo AFTER non corrisponde al fingerprint corrente. Attendi il ricalcolo.');
const afterEligible=CORE.latestEligibleByInstitute(originalPolls,sourceVerification.asOfDate,sourceVerification.windowDays||14);
const afterIntegrity=CORE.evaluateIntegrity({now:new Date(),sourceVerification,acquiredAt:state.fetchedAt,datasetRows:afterEligible,usedRows:afterAvg.rows,staleAfterHours:sourceVerification.staleAfterHours||36});
const after={
  kind:'AFTER-recorded-current-runtime',appVersion:APP_VERSION,engineVersion:MC_ENGINE_VERSION,inputFingerprint:afterFp,mcFingerprint:afterMcFp,seed:state.monteCarlo.seed,
  acquiredAt,sourceVerification,pollsUsed:afterAvg.rows.map(pollFor),weights:weightsFor(afterAvg),avg:avgFor(afterAvg),integrity:afterIntegrity,results:mcSummary(state.monteCarlo)
};
let before;
try{
  const beforePolls=originalPolls.filter(p=>!isSupplement(p));
  if(beforePolls.length!==originalPolls.length-2)throw new Error(`Attese 2 righe supplementari da rimuovere, trovate ${originalPolls.length-beforePolls.length}.`);
  state.polls=beforePolls;
  const beforeAvg=projectionAverage(),beforeFp=pollDatasetSignature(),beforeMcFp=mcFingerprint(beforeAvg),beforeSeed=hashString(beforeMcFp+'|async1000|'+MC_SIMS+'|'+MC_SIGMA),token=state.mcToken;
  const beforeEligible=CORE.latestEligibleByInstitute(beforePolls,sourceVerification.asOfDate,sourceVerification.windowDays||14);
  const beforeIntegrity=CORE.evaluateIntegrity({now:new Date(),sourceVerification,acquiredAt:state.fetchedAt,datasetRows:beforeEligible,usedRows:beforeAvg.rows,staleAfterHours:sourceVerification.staleAfterHours||36});
  console.log('Audit BEFORE: ricalcolo 50.000 simulazioni in corso…');
  const beforeMc=await runMonteCarloAsync(beforeAvg,token);if(!beforeMc)throw new Error('Monte Carlo BEFORE interrotto.');
  if(beforeMc.seed!==beforeSeed)throw new Error(`Seed BEFORE inatteso: ${beforeMc.seed} != ${beforeSeed}`);
  before={
    kind:'BEFORE-controlled-replay',reconstruction:'Stesso dataset acquisito e stesso motore; rimosse soltanto pollytix 2026-08-21 e Verian 2026-08-28, cioè le due osservazioni recuperate dall’hotfix.',
    appVersion:'22.4.3/pre-input-hotfix',engineVersion:MC_ENGINE_VERSION,inputFingerprint:beforeFp,mcFingerprint:beforeMcFp,seed:beforeMc.seed,
    acquiredAt,sourceVerification,pollsUsed:beforeAvg.rows.map(pollFor),weights:weightsFor(beforeAvg),avg:avgFor(beforeAvg),integrity:beforeIntegrity,results:mcSummary(beforeMc)
  };
}finally{state.polls=originalPolls}
const out={
  schemaVersion:1,
  generatedAt:new Date().toISOString(),
  purpose:'v22.4.4 input-integrity hotfix controlled before/after',
  control:{sameEngine:before.engineVersion===after.engineVersion,afterFingerprintMatchesCurrent:after.inputFingerprint===pollDatasetSignature(),onlyRowsRestored:['pollytix @ 2026-08-21','verian @ 2026-08-28']},
  before,after,delta:resultDelta(before,after)
};
downloadBlob(`bundestag_v22.4.4_before_after_${civil(afterAvg.date)}.json`,JSON.stringify(out,null,2),'application/json');
console.log('Audit BEFORE/AFTER esportato.',out);
})();