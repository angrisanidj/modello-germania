#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('./final-coverage-core.js');

const LEVELS=[
  {name:'50',lo:.25,hi:.75,p:.50},
  {name:'80',lo:.10,hi:.90,p:.80},
  {name:'95',lo:.025,hi:.975,p:.95},
];

function fail(msg){throw new Error(msg)}

function extractBalanced(source,startToken,openChar,closeChar){
  const i=source.indexOf(startToken);
  if(i<0)fail(`Token non trovato: ${startToken}`);
  const start=source.indexOf(openChar,i+startToken.length);
  if(start<0)fail(`Apertura non trovata per: ${startToken}`);
  let depth=0,quote=null,esc=false,lineComment=false,blockComment=false;
  for(let p=start;p<source.length;p++){
    const c=source[p],n=source[p+1];
    if(lineComment){if(c==='\n')lineComment=false;continue}
    if(blockComment){if(c==='*'&&n==='/'){blockComment=false;p++}continue}
    if(quote){
      if(esc){esc=false;continue}
      if(c==='\\'){esc=true;continue}
      if(c===quote)quote=null;
      continue;
    }
    if(c==='/'&&n==='/'){lineComment=true;p++;continue}
    if(c==='/'&&n==='*'){blockComment=true;p++;continue}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue}
    if(c===openChar)depth++;
    else if(c===closeChar){depth--;if(depth===0)return source.slice(start,p+1)}
  }
  fail(`Blocco non bilanciato: ${startToken}`);
}

function extractNumber(source,name){
  const re=new RegExp(`\\b${name}\\s*=\\s*([0-9.]+)`);
  const m=source.match(re);if(!m)fail(`Costante non trovata: ${name}`);return Number(m[1]);
}
function extractString(source,name){
  const re=new RegExp(`\\b${name}\\s*=\\s*['"]([^'"]+)['"]`);
  const m=source.match(re);if(!m)fail(`Stringa non trovata: ${name}`);return m[1];
}
function evalLiteral(lit){return vm.runInNewContext(`(${lit})`,{Date});}

function extractFunction(source,name){
  const token=`function ${name}(`,i=source.indexOf(token);if(i<0)fail(`Funzione non trovata: ${name}`);
  const b=source.indexOf('{',i),body=extractBalanced(source,source.slice(i,b),'{','}');
  return source.slice(i,b)+body;
}

function quantile(arr,q){
  const a=Float32Array.from(arr);a.sort();
  const i=Math.max(0,Math.min(a.length-1,Math.round((a.length-1)*q)));
  return a[i];
}
function sampleMean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}

function loadModel(root){
  const indexPath=path.join(root,'index.html'),source=fs.readFileSync(indexPath,'utf8');
  const data=evalLiteral(extractBalanced(source,'const NATIONAL_BACKTEST_DATA=','[',']'));
  const ref=evalLiteral(extractBalanced(source,'const NATIONAL_BACKTEST_REFERENCE=','{','}'));
  const sigma=extractNumber(source,'MC_SIGMA');
  const alphaCandidate=extractNumber(source,'MC_SHARE_SIGMA_ALPHA_CANDIDATE');
  const shareRef=extractNumber(source,'MC_SHARE_SIGMA_REFERENCE');
  const shareMin=extractNumber(source,'MC_SHARE_SIGMA_MIN');
  const shareMax=extractNumber(source,'MC_SHARE_SIGMA_MAX');
  const sims=extractNumber(source,'NATIONAL_BACKTEST_SIMS');
  const version=extractString(source,'NATIONAL_BACKTEST_DATA_VERSION');

  const sandbox={};
  vm.createContext(sandbox);
  vm.runInContext(`${extractFunction(source,'hashString')};${extractFunction(source,'mulberry32')};this.hashString=hashString;this.mulberry32=mulberry32;`,sandbox);
  return{source,data,ref,sigma,alphaCandidate,shareRef,shareMin,shareMax,sims,version,hashString:sandbox.hashString,mulberry32:sandbox.mulberry32};
}

function dayKey(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime()}
const DAY=86400000;

function pollsterReliabilityWeights(model,asOfDate){
  const asOf=new Date(asOfDate),byInst=new Map(),prior=4,min=.925,max=1.20;
  for(const cycle of model.data){
    if(!(cycle.election<asOf))continue;
    const cutoff=new Date(cycle.election.getTime()-DAY),end=dayKey(cutoff),start=end-13*DAY,latest=new Map();
    for(const p of cycle.polls){const t=dayKey(p.date);if(t<start||t>end)continue;const key=p.institute.trim().toLowerCase(),prev=latest.get(key);if(!prev||p.date>=prev.date)latest.set(key,p)}
    for(const [key,p] of latest){
      const sq=[];for(const [k,actual] of Object.entries(cycle.result)){const v=p[k];if(Number.isFinite(v)&&Number.isFinite(actual))sq.push((v-actual)*(v-actual))}
      if(!sq.length)continue;const cycleRmse=Math.sqrt(sq.reduce((a,b)=>a+b,0)/sq.length),row=byInst.get(key)||{sumSq:0,n:0};row.sumSq+=cycleRmse*cycleRmse;row.n++;byInst.set(key,row);
    }
  }
  if(!byInst.size)return new Map();
  const scores=[...byInst.entries()].map(([key,v])=>({key,score:Math.sqrt(v.sumSq/v.n),n:v.n})).filter(x=>Number.isFinite(x.score)&&x.score>0).sort((a,b)=>a.score-b.score);
  const mid=Math.floor(scores.length/2),median=scores.length%2?scores[mid].score:(scores[mid-1].score+scores[mid].score)/2,out=new Map();
  for(const x of scores){const raw=(median/x.score)**2,lambda=x.n/(x.n+prior),shrunk=1+lambda*(raw-1),w=Math.max(min,Math.min(max,shrunk));out.set(x.key,w)}
  return out;
}

function averageCycle(model,cycle){
  const cutoff=new Date(cycle.election.getTime()-DAY),end=dayKey(cutoff),start=end-13*DAY,byInst=new Map();
  for(const p of cycle.polls){const t=dayKey(p.date);if(t<start||t>end)continue;const key=p.institute.trim().toLowerCase(),prev=byInst.get(key);if(!prev||p.date>=prev.date)byInst.set(key,p)}
  const rows=[...byInst.values()],rel=pollsterReliabilityWeights(model,cutoff),out={count:rows.length};
  for(const k of Object.keys(cycle.result)){
    let num=0,den=0;
    for(const p of rows){const v=p[k];if(!Number.isFinite(v))continue;const age=Math.max(0,(end-dayKey(p.date))/DAY),w=Math.pow(.5,age/7)*(rel.get(p.institute.trim().toLowerCase())||1);num+=v*w;den+=w}
    out[k]=den?num/den:null;
  }
  return out;
}
function shareScale(model,share,alpha){
  if(!(alpha>0))return 1;
  const p=Math.max(.1,Number(share)||0),m=Math.pow(p/model.shareRef,alpha);
  return Math.max(model.shareMin,Math.min(model.shareMax,m));
}
function sigmaForShare(model,share,alpha){return model.sigma*shareScale(model,share,alpha)}

function gaussian(model,seed){
  const rng=model.mulberry32(seed);let spare=null;
  return()=>{if(spare!==null){const z=spare;spare=null;return z}let u=0,v=0;while(!u)u=rng();while(!v)v=rng();const r=Math.sqrt(-2*Math.log(u)),a=2*Math.PI*v;spare=r*Math.sin(a);return r*Math.cos(a)};
}

function simulateCycle(model,cycle,alpha){
  const avg=averageCycle(model,cycle),keys=Object.keys(cycle.result),n=model.sims,
    samples=Object.fromEntries(keys.map(k=>[k,new Float32Array(n)])),
    residual=Math.max(.01,100-keys.reduce((a,k)=>a+(Number(avg[k])||0),0)),
    g=gaussian(model,model.hashString(`${model.version}|${cycle.cycle}|${model.sigma}|a${alpha}`));
  for(let i=0;i<n;i++){
    const raw={},other=Math.max(.01,residual+sigmaForShare(model,residual,alpha)*g());let total=other;
    for(const k of keys){const base=Number(avg[k])||0,x=Math.max(.01,base+sigmaForShare(model,base,alpha)*g());raw[k]=x;total+=x}
    const scale=100/total;for(const k of keys)samples[k][i]=raw[k]*scale;
  }
  const obs=[];
  for(const k of keys){
    const actual=cycle.result[k],estimate=avg[k],covered={},bands={};
    for(const L of LEVELS){const lo=quantile(samples[k],L.lo),hi=quantile(samples[k],L.hi);covered[L.name]=actual>=lo&&actual<=hi;bands[L.name]={low:lo,high:hi,width:hi-lo}}
    obs.push({cycle:cycle.cycle,party:k,actual,estimate,error:estimate-actual,covered,bands});
  }
  return{cycle:cycle.cycle,avgCount:avg.count,obs};
}
function coverageForAlpha(model,alpha){
  const cycles=model.data.map(c=>simulateCycle(model,c,alpha)),obs=cycles.flatMap(c=>c.obs);
  const overall={};
  for(const L of LEVELS){
    const covered=obs.filter(o=>o.covered[L.name]).length,n=obs.length;
    overall[L.name]={n,covered,coverage:covered/n,nominal:L.p,undercoverageP:core.binomialLowerTail(covered,n,L.p),meanWidth:sampleMean(obs.map(o=>o.bands[L.name].width))};
  }
  return{alpha,cycles,obs,overall,bucket:core.bucketSummary(obs,3,7)};
}
function evaluateRegimes(model){
  const alphas=[0,model.alphaCandidate].filter((v,i,x)=>x.indexOf(v)===i);
  const regimes=alphas.map(alpha=>{
    const run=coverageForAlpha(model,alpha);
    const referenceCompatible=core.nearlyEqual(run.overall['80'].coverage,model.ref.coverage);
    const mono=monotonic(run);
    const health=core.healthVerdict({
      overall:run.overall,
      expected80:referenceCompatible?model.ref.coverage:null,
      bucket:run.bucket,
      monotonic:mono,
      activeAlphaMatched:true
    });
    return{alpha,run,referenceCompatible,monotonic:mono,health};
  });
  const compatible=regimes.filter(r=>r.referenceCompatible);
  const pass=compatible.length>0&&compatible.every(r=>r.health.pass);
  const reasons=[];
  if(!compatible.length)reasons.push('nessun regime candidato riconcilia il riferimento 80% congelato');
  for(const r of compatible)if(!r.health.pass)reasons.push(`α=${r.alpha}: ${r.health.reasons.join('; ')}`);
  return{regimes,compatibleCount:compatible.length,pass,reasons};
}
function monotonic(run){
  const o=run.overall;
  if(!(o['50'].coverage<=o['80'].coverage&&o['80'].coverage<=o['95'].coverage))return false;
  for(const row of run.obs)if(!(row.bands['50'].width<=row.bands['80'].width&&row.bands['80'].width<=row.bands['95'].width))return false;
  return true;
}
function fmtPct(x){return `${(100*x).toFixed(1)}%`}
function main(){
  const args=process.argv.slice(2),rootArg=args.includes('--root')?args[args.indexOf('--root')+1]:'.',outArg=args.includes('--out')?args[args.indexOf('--out')+1]:null;
  const root=path.resolve(rootArg),model=loadModel(root),evaluation=evaluateRegimes(model);
  const report={
    schemaVersion:2,
    generatedAt:new Date().toISOString(),
    scope:'final read-only coverage health audit',
    source:{index:'index.html',backtestDataVersion:model.version,simulations:model.sims,sigma:model.sigma,reference80:model.ref.coverage},
    regimeResolution:{
      method:'dual-regime conservative audit',
      note:'Il coverage 80% discreto può essere identico per α=0 e α candidato; l’audit non sceglie un regime dal solo conteggio. Valuta tutti i regimi compatibili col riferimento congelato.',
      compatibleCount:evaluation.compatibleCount
    },
    regimes:evaluation.regimes.map(r=>({
      alpha:r.alpha,
      referenceCompatible:r.referenceCompatible,
      overall:r.run.overall,
      bucket3to7:r.run.bucket,
      cycles:r.run.cycles.map(c=>({cycle:c.cycle,avgCount:c.avgCount,observations:c.obs})),
      monotonic:r.monotonic,
      health:r.health
    })),
    health:{
      pass:evaluation.pass,
      reasons:evaluation.reasons,
      rule:'PASS se almeno un regime candidato riconcilia il riferimento 80% congelato e tutti i regimi compatibili superano il health check.'
    },
    interpretation:{
      overall:'Coverage marginale su 19 osservazioni di partito appartenenti a tre elezioni; non sono 19 eventi indipendenti.',
      bucket:'La fascia 3–7% è diagnostica descrittiva. Un n piccolo non viene usato come promotion gate.',
      noEngineChange:true
    }
  };

  console.log(`Coverage audit · dataset ${model.version} · ${model.sims.toLocaleString('it-IT')} simulazioni/ciclo`);
  for(const r of evaluation.regimes){
    console.log(`REGIME α=${r.alpha}${r.referenceCompatible?' · compatibile col riferimento 80%':' · NON compatibile col riferimento 80%'}`);
    for(const L of LEVELS){const x=r.run.overall[L.name];console.log(`  ${L.name}%: ${x.covered}/${x.n} = ${fmtPct(x.coverage)} · nominale ${L.name}% · p-under=${x.undercoverageP.toFixed(4)} · width media ${x.meanWidth.toFixed(2)} p.p.`)}
    console.log(`  Bucket reale 3–7%: n=${r.run.bucket.actual.n}`);
    for(const L of LEVELS){const x=r.run.bucket.actual.levels[L.name];console.log(`    ${L.name}%: ${x.covered}/${x.n||0}${x.n?` = ${fmtPct(x.coverage)}`:''}`)}
    console.log(`  Bucket stimato 3–7%: n=${r.run.bucket.estimate.n}`);
    for(const L of LEVELS){const x=r.run.bucket.estimate.levels[L.name];console.log(`    ${L.name}%: ${x.covered}/${x.n||0}${x.n?` = ${fmtPct(x.coverage)}`:''}`)}
    console.log(`  HEALTH α=${r.alpha}: ${r.health.pass?'PASS':'FAIL'}${r.health.reasons.length?' · '+r.health.reasons.join('; '):''}`);
  }
  console.log(`HEALTH BLOCCO A: ${evaluation.pass?'PASS':'FAIL'}${evaluation.reasons.length?' · '+evaluation.reasons.join('; '):''}`);
  if(outArg){const out=path.resolve(root,outArg);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(`Report: ${path.relative(root,out)}`)}
  if(!evaluation.pass)process.exitCode=2;
}
main();
