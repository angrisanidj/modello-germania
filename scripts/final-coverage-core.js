(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.FinalCoverageCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const NUMERIC_TOL=1e-9;
  function nearlyEqual(a,b,tol=NUMERIC_TOL){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol}

  function combination(n,k){
    if(k<0||k>n)return 0;
    k=Math.min(k,n-k);
    let out=1;
    for(let i=1;i<=k;i++)out=out*(n-k+i)/i;
    return out;
  }

  function binomialLowerTail(k,n,p){
    if(!(n>=0)||!(p>=0&&p<=1))return NaN;
    k=Math.floor(k);
    if(k<0)return 0;
    if(k>=n)return 1;
    let s=0;
    for(let i=0;i<=k;i++)s+=combination(n,i)*Math.pow(p,i)*Math.pow(1-p,n-i);
    return Math.max(0,Math.min(1,s));
  }

  function levelSummary(rows,level){
    const key=String(level),n=rows.length,covered=rows.filter(r=>r.covered&&r.covered[key]).length;
    return {n,covered,coverage:n?covered/n:null};
  }

  function bucketSummary(rows,lo=3,hi=7){
    const actualRows=rows.filter(r=>Number.isFinite(r.actual)&&r.actual>=lo&&r.actual<=hi);
    const estimateRows=rows.filter(r=>Number.isFinite(r.estimate)&&r.estimate>=lo&&r.estimate<=hi);
    const summarize=xs=>({
      n:xs.length,
      observations:xs.map(r=>({cycle:r.cycle,party:r.party,actual:r.actual,estimate:r.estimate,covered:r.covered})),
      levels:Object.fromEntries(['50','80','95'].map(l=>[l,levelSummary(xs,l)]))
    });
    return {range:[lo,hi],actual:summarize(actualRows),estimate:summarize(estimateRows)};
  }

  function healthVerdict(a){
    const reasons=[],o=a.overall||{};
    for(const [level,p] of [['50',.50],['80',.80],['95',.95]]){
      const r=o[level];
      if(!r||!r.n){reasons.push(`coverage ${level}% non disponibile`);continue}
      if(Number.isFinite(r.undercoverageP)&&r.undercoverageP<.05)reasons.push(`undercoverage ${level}% statisticamente anomala (p=${r.undercoverageP.toFixed(4)})`);
    }
    if(!a.monotonic)reasons.push('coverage/intervalli non monotoni');
    if(!a.activeAlphaMatched)reasons.push('regime di dispersione attivo non riconciliato con il riferimento 80% del modello');
    if(Number.isFinite(a.expected80)&&o['80']&&!nearlyEqual(o['80'].coverage,a.expected80))reasons.push('coverage 80% non coincide con il riferimento congelato');
    return {pass:reasons.length===0,reasons,bucketGateApplied:false,bucketReason:'La fascia 3–7% è un health diagnostic descrittivo; con n ridotto non promuove né boccia il motore.'};
  }

  return{NUMERIC_TOL,nearlyEqual,binomialLowerTail,bucketSummary,healthVerdict};
});
