(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.InputIntegrity=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ALIASES=new Map([
    ['forschungsgruppe wahlen','fg wahlen'],['forschungsgruppe wahlen e.v.','fg wahlen'],['fg wahlen','fg wahlen'],
    ['ifd allensbach','ifd allensbach'],['institut für demoskopie allensbach','ifd allensbach'],['institut fuer demoskopie allensbach','ifd allensbach'],['allensbach','ifd allensbach'],
    ['infratest dimap','infratest dimap'],['ard-deutschlandtrend / infratest dimap','infratest dimap'],
    ['verian','verian'],['kantar public / verian','verian'],['kantar public','verian'],['pollytix','pollytix'],['yougov','yougov'],['insa','insa'],['forsa','forsa'],['gms','gms'],['ipsos','ipsos']
  ]);
  function cleanName(value){return String(value==null?'':value).trim().toLowerCase().replace(/\s+/g,' ')}
  function normalizeInstituteName(value){const k=cleanName(value);return ALIASES.get(k)||k}
  function toTime(v){if(v instanceof Date)return v.getTime();const t=new Date(v).getTime();return Number.isFinite(t)?t:NaN}
  function calendarDateKey(v){
    if(typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v.trim()))return v.trim();
    const d=v instanceof Date?v:new Date(v);if(!Number.isFinite(d.getTime()))return'';
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;
  }
  function civilDay(v){const k=calendarDateKey(v);if(!k)return NaN;const [y,m,d]=k.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000}
  function latestEligibleByInstitute(polls,asOf,windowDays=14){
    const end=civilDay(asOf),start=end-(Math.max(1,Number(windowDays)||14)-1),latest=new Map();if(!Number.isFinite(end))return[];
    for(const row of Array.isArray(polls)?polls:[]){const day=civilDay(row&&row.date);if(!Number.isFinite(day)||day<start||day>end)continue;const key=normalizeInstituteName(row&&row.institute);if(!key)continue;const prev=latest.get(key),prevDay=prev?civilDay(prev.date):NaN;if(!prev||prevDay<day||(prevDay===day&&toTime(prev.date)<=toTime(row.date)))latest.set(key,row)}
    return [...latest.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([,row])=>row);
  }
  function dateKey(v){return calendarDateKey(v)}
  function recordKey(row){const inst=normalizeInstituteName(row&&row.institute),date=dateKey(row&&row.date);return inst&&date?`${inst} @ ${date}`:''}
  function recordSet(rows){return new Set((Array.isArray(rows)?rows:[]).map(recordKey).filter(Boolean))}
  function sortedDiff(a,b){return [...a].filter(x=>!b.has(x)).sort((x,y)=>x.localeCompare(y))}
  function ageHours(timestamp,now){const a=toTime(timestamp),n=toTime(now);if(!Number.isFinite(a)||!Number.isFinite(n))return Infinity;return Math.max(0,(n-a)/3600000)}
  function evaluateIntegrity(args={}){
    const source=args.sourceVerification||{},expected=recordSet(source.eligible),dataset=recordSet(args.datasetRows),used=recordSet(args.usedRows),missingUpstream=sortedDiff(expected,dataset),missingModel=sortedDiff(dataset,used),unexpectedDataset=sortedDiff(dataset,expected),staleAfter=Math.max(1,Number(args.staleAfterHours)||36),sourceAgeHours=ageHours(source.verifiedAt,args.now||new Date()),acquisitionAgeHours=ageHours(args.acquiredAt,args.now||new Date());
    const knownMismatch=missingUpstream.length>0||missingModel.length>0||unexpectedDataset.length>0,sourceVerified=source.status==='verified'&&Number.isFinite(sourceAgeHours)&&sourceAgeHours<=staleAfter,acquisitionFresh=Number.isFinite(acquisitionAgeHours)&&acquisitionAgeHours<=staleAfter,sourceMode=cleanName(source.mode||'unknown'),sourceCertified=sourceVerified&&sourceMode==='automated',excluded=sortedDiff(expected,used);
    let state='green',reason='Fonte automatizzata, dataset e motore coerenti.';if(knownMismatch){state='red';reason='Le rilevazioni eleggibili divergono lungo la catena dati.'}else if(!sourceVerified||!acquisitionFresh){state='yellow';reason='Completezza o freschezza upstream non certificata.'}else if(!sourceCertified){state='yellow';reason='Input completo, ma la freshness upstream è verificata manualmente e non certificata automaticamente.'}
    return{state,reason,sourceVerified,sourceCertified,acquisitionFresh,sourceMode:source.mode||'unknown',sourceStatus:source.status||'unknown',sourceAgeHours:Number.isFinite(sourceAgeHours)?sourceAgeHours:null,acquisitionAgeHours:Number.isFinite(acquisitionAgeHours)?acquisitionAgeHours:null,counts:{expected:expected.size,dataset:dataset.size,used:used.size,excluded:excluded.length},missingUpstream,missingModel,unexpectedDataset};
  }
  function stableValue(value){if(Array.isArray(value))return value.map(stableValue);if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value).sort())out[key]=stableValue(value[key]);return out}return value}
  function sortedRows(rows){return (Array.isArray(rows)?rows:[]).map(r=>stableValue(r)).sort((a,b)=>{const ai=normalizeInstituteName(a.institute),bi=normalizeInstituteName(b.institute);if(ai!==bi)return ai.localeCompare(bi);return String(a.date||'').localeCompare(String(b.date||''))})}
  function buildRunManifest(args={}){const weights=(Array.isArray(args.weights)?args.weights:[]).map(x=>stableValue(x)).sort((a,b)=>normalizeInstituteName(a.institute).localeCompare(normalizeInstituteName(b.institute)));return stableValue({schemaVersion:args.schemaVersion||1,appVersion:args.appVersion||null,engineVersion:args.engineVersion||null,inputFingerprint:args.inputFingerprint||null,seed:Number.isFinite(args.seed)?args.seed:null,sourceVerification:stableValue(args.sourceVerification||{}),acquiredAt:args.acquiredAt||null,pollsUsed:sortedRows(args.pollsUsed||[]),weights,avg:stableValue(args.avg||{}),integrity:stableValue(args.integrity||{})})}
  return{normalizeInstituteName,calendarDateKey,latestEligibleByInstitute,evaluateIntegrity,buildRunManifest};
});
