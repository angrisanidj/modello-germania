const fs=require('fs');
const s=fs.readFileSync('index.html','utf8');
function must(re,msg){if(!re.test(s)){console.error(msg);process.exit(1)}}
must(/const INPUT_HOTFIX_SUPPLEMENT=\[/,'supplemento mancante');
must(/date:new Date\('2026-08-21T12:00:00\+02:00'\)[\s\S]*institute:'pollytix'/,'pollytix 21/08 mancante');
must(/date:new Date\('2026-08-28T12:00:00\+02:00'\)[\s\S]*institute:'Verian'/,'Verian 28/08 mancante');
must(/union:20,afd:28,spd:15,gruene:13,linke:11,bsw:4,fdp:5,fw:null,other:4/,'valori pollytix errati');
must(/union:20,afd:28,spd:13,gruene:16,linke:12,bsw:2,fdp:4,fw:null,other:5/,'valori Verian errati');
must(/async function applyFetchedPolls\(polls,\{sourceLabel='Fonte controllata',quiet=false\}=\{\}\)\{\s*polls=mergeInputHotfixSupplement\(polls\);/,'merge non applicato prima della firma/cache');
const cacheHits=(s.match(/state\.polls=mergeInputHotfixSupplement\(deserializePolls\(cachedObj\.polls\)\)/g)||[]).length;
if(cacheHits<2){console.error('merge cache incompleto: '+cacheHits);process.exit(1)}
if(!/const APP_VERSION='22\.4\.4';/.test(s)){console.error('APP_VERSION inattesa');process.exit(1)}
console.log('input-supplement structural tests passed');
