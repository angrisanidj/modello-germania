(function(){
'use strict';
const CORE=globalThis.InputIntegrity;if(!CORE){console.error('InputIntegrity core non disponibile');return}
const SOURCE_MANIFEST_URL='./data/source-verification.json';let sourceVerification=null,lastSignature='';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isoDate=v=>{const d=v instanceof Date?v:new Date(v);return Number.isFinite(d.getTime())?d.toISOString():null};
const pollDate=v=>CORE.calendarDateKey(v);
const fmtDateTime=v=>{const d=v instanceof Date?v:new Date(v);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d):'—'};
function asOfDate(){return sourceVerification?.asOfDate||state.polls[state.polls.length-1]?.date||new Date()}
function datasetEligible(){return CORE.latestEligibleByInstitute(state.polls,asOfDate(),sourceVerification?.windowDays||14)}
function usedRows(){const avg=projectionAverage();return avg?.rows||[]}
function currentIntegrity(){return CORE.evaluateIntegrity({now:new Date(),sourceVerification:sourceVerification||{status:'unverified',mode:'manual',eligible:[]},acquiredAt:state.fetchedAt,datasetRows:datasetEligible(),usedRows:usedRows(),staleAfterHours:sourceVerification?.staleAfterHours||36})}
function effectiveWeights(avg){if(!avg?.rows?.length)return[];const end=new Date(avg.date).setHours(0,0,0,0),tmp=[];let total=0;for(const p of avg.rows){const age=Math.max(0,(end-new Date(p.date).setHours(0,0,0,0))/86400000),rel=avg.reliability?.get?.(String(p.institute||'').trim().toLowerCase())||1,raw=Math.pow(.5,age/7)*rel;total+=raw;tmp.push({institute:p.institute,date:pollDate(p.date),ageDays:age,reliability:rel,rawWeight:raw})}return tmp.map(x=>({...x,weight:total?x.rawWeight/total:0}))}
function pollForManifest(p){const out={institute:p.institute,date:pollDate(p.date)};for(const party of PARTIES){if(Number.isFinite(p[party.key]))out[party.key]=p[party.key]}return out}
function makeManifest(){const avg=projectionAverage(),integrity=currentIntegrity(),fp=typeof pollDatasetSignature==='function'?pollDatasetSignature():null,avgData={date:pollDate(avg?.date)};for(const party of PARTIES){if(Number.isFinite(avg?.[party.key]))avgData[party.key]=avg[party.key]}return CORE.buildRunManifest({schemaVersion:1,appVersion:typeof APP_VERSION!=='undefined'?APP_VERSION:null,engineVersion:typeof MC_ENGINE_VERSION!=='undefined'?MC_ENGINE_VERSION:null,inputFingerprint:fp,seed:state.monteCarlo?.seed??null,sourceVerification,acquiredAt:isoDate(state.fetchedAt),pollsUsed:(avg?.rows||[]).map(pollForManifest),weights:effectiveWeights(avg),avg:avgData,integrity})}
function downloadManifest(){const m=makeManifest(),stamp=m.avg?.date||new Date().toISOString().slice(0,10);downloadBlob(`bundestag_run_manifest_${stamp}.json`,JSON.stringify(m,null,2),'application/json')}
function ensureUi(){
  if(!document.getElementById('inputIntegrityPublic')){
    const meta=document.querySelector('.hero-meta');
    if(meta){const el=document.createElement('span');el.id='inputIntegrityPublic';el.className='badge';meta.appendChild(el)}
  }
  if(document.getElementById('inputIntegrityAudit'))return;
  const legacyBody=document.querySelector('.nowcast-audit .audit-body');
  const box=document.createElement(legacyBody?'div':'section');
  box.id='inputIntegrityAudit';
  box.dataset.inputIntegrityAudit='true';
  box.className=legacyBody?'audit-shadow-box':'card input-integrity-panel reveal-on-scroll in-view';
  if(!legacyBody)box.style.cssText='margin:24px 0;padding:20px;display:block;';
  if(legacyBody){legacyBody.prepend(box);return}
  const anchor=document.querySelector('section.backtest.backtest-grid')||document.getElementById('territorialValidationCard')||document.querySelector('.ai-card');
  if(anchor?.parentNode)anchor.parentNode.insertBefore(box,anchor);
}
function render(){ensureUi();const r=currentIntegrity(),sig=JSON.stringify(r)+String(state.fetchedAt?.getTime?.()||'')+String(state.polls.length)+String(state.monteCarlo?.seed||''),pub=document.getElementById('inputIntegrityPublic'),audit=document.getElementById('inputIntegrityAudit'),loaded=document.getElementById('dateDataLoaded'),needsPaint=!!audit&&!audit.dataset.integrityRendered;if(sig===lastSignature&&!needsPaint)return;lastSignature=sig;const label=r.state==='green'?'Input verificato':r.state==='red'?'Input incompleto':(r.sourceVerified&&!r.sourceCertified&&!r.missingUpstream.length&&!r.missingModel.length?'Input completo · upstream manuale':'Completezza in verifica');if(pub){pub.textContent=label;pub.dataset.integrity=r.state;pub.style.borderColor=r.state==='green'?'#2f8f4e':r.state==='red'?'#c6283d':'#b58a00';pub.style.color=r.state==='green'?'#9fe4b7':r.state==='red'?'#ff9aac':'#f4d76f'}if(loaded){const base=state.fetchedAt?fmtDateTime(state.fetchedAt):'—';loaded.textContent=r.state==='green'?base:`${base} · ${label.toLowerCase()}`}if(audit){const missing=[...r.missingUpstream.map(x=>`${x}: fonte → dataset`),...r.missingModel.map(x=>`${x}: dataset → motore`)];audit.innerHTML=`<div class="audit-shadow-head"><strong>Integrità input</strong><span>${esc(label)}</span></div><div class="audit-integrity-grid"><div class="audit-integrity-card ${r.sourceCertified?'ok':'warn'}"><div class="k">Freshness upstream</div><div class="v">${r.sourceCertified?'Certificata':(r.sourceVerified?'Manuale':'Non verificata')}</div><div class="s">${esc(sourceVerification?.mode||'manuale')} · ${esc(fmtDateTime(sourceVerification?.verifiedAt))}</div></div><div class="audit-integrity-card ${r.acquisitionFresh?'ok':'warn'}"><div class="k">Dataset acquisito</div><div class="v">${r.acquisitionFresh?'Fresco':'Da verificare'}</div><div class="s">${esc(fmtDateTime(state.fetchedAt))}</div></div><div class="audit-integrity-card ${r.missingUpstream.length?'warn':'ok'}"><div class="k">Fonte → dataset</div><div class="v">${r.counts.expected}/${r.counts.dataset}</div><div class="s">${r.missingUpstream.length?esc(r.missingUpstream.join(', ')):'nessuna assenza nota'}</div></div><div class="audit-integrity-card ${r.missingModel.length?'warn':'ok'}"><div class="k">Dataset → motore</div><div class="v">${r.counts.dataset}/${r.counts.used}</div><div class="s">${r.missingModel.length?esc(r.missingModel.join(', ')):'nessuna assenza interna'}</div></div></div><p class="audit-note"><strong>Fonte eleggibile: ${r.counts.expected} · Acquisiti: ${r.counts.dataset} · Usati: ${r.counts.used} · Esclusi: ${r.counts.excluded??0}</strong></p><p class="audit-note">${esc(r.reason)}${missing.length?' Mancanze: '+esc(missing.join(' · '))+'.':''} Il verde richiede una verifica upstream automatizzata/certificata; la verifica manuale scade dopo ${Number(sourceVerification?.staleAfterHours||36)} ore.</p><div class="audit-shadow-action"><button type="button" id="downloadRunManifest">Esporta manifest del run</button></div>`;audit.dataset.integrityRendered='true';document.getElementById('downloadRunManifest')?.addEventListener('click',downloadManifest)}}
async function loadSourceVerification(){try{const r=await fetch(`${SOURCE_MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);sourceVerification=await r.json()}catch(e){console.warn('Verifica upstream non disponibile:',e);sourceVerification={schemaVersion:1,status:'unverified',mode:'manual',eligible:[],staleAfterHours:36}}render()}
function mcLifecycleCount(v){
  return typeof fmtCount==='function'
    ? fmtCount(Number(v)||0)
    : Number(v||0).toLocaleString('it-IT');
}

function renderMonteCarloLifecycle(){
  if(
    typeof state==='undefined' ||
    typeof districtState==='undefined' ||
    state.monteCarlo?.ready
  ) return;

  const targets=['mcThreshold','mcCoalitions','configurationGrid']
    .map(id=>document.getElementById(id))
    .filter(Boolean);

  if(!targets.length) return;

  let text='Avvio simulazione…';
  let retry=false;

  if(!districtState.ready){
    text='Preparazione dei 299 collegi…';
  }else if(state.mcRunning){
    text=`Simulazione ${mcLifecycleCount(state.mcProgress)} / ${mcLifecycleCount(MC_SIMS)}…`;
  }else if(state.mcFingerprint){
    text='Simulazione non disponibile.';
    retry=true;
  }

  for(const el of targets){
    const retryHtml=retry
      ? ' <button type="button" data-mc-retry>Riprova</button>'
      : '';

    const style=el.id==='configurationGrid'
      ? ' style="grid-column:1/-1;padding:14px"'
      : '';

    el.innerHTML=`<div class="empty-small"${style}>${esc(text)}${retryHtml}</div>`;
  }

  if(retry){
    document.querySelectorAll('[data-mc-retry]').forEach(btn=>{
      btn.onclick=()=>{
        if(typeof scheduleMonteCarlo==='function') scheduleMonteCarlo();
      };
    });
  }
}

function boot(){
  ensureUi();
  loadSourceVerification();
  render();
  renderMonteCarloLifecycle();
  setInterval(render,2000);
  setInterval(renderMonteCarloLifecycle,750);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',boot,{once:true});
}else{
  boot();
}
})();
