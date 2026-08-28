const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),s=fs.readFileSync(path.join(root,'index.html'),'utf8');

function extractFunction(name){
  const token=`function ${name}(`,i=s.indexOf(token);assert(i>=0,`${name} missing`);
  const b=s.indexOf('{',i);let depth=0,quote=null,esc=false;
  for(let p=b;p<s.length;p++){
    const c=s[p];
    if(quote){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===quote)quote=null;continue}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue}
    if(c==='{')depth++; else if(c==='}'&&--depth===0)return s.slice(i,p+1);
  }
  throw new Error(`unbalanced ${name}`);
}
function constString(name){
  const m=s.match(new RegExp(`const ${name}='([^']+)'`));assert(m,`${name} missing`);return m[1];
}
const civil=extractFunction('civilDateString'),poll=extractFunction('pollArraySignature'),mc=extractFunction('mcFingerprint'),hash=extractFunction('hashString');
const schema=constString('FINGERPRINT_SCHEMA_VERSION'),engine=constString('MC_ENGINE_VERSION');
const keys=['union','afd','spd','gruene','linke','bsw','fdp','fw','other'];

function run(tz){
  const code=`
    const FINGERPRINT_SCHEMA_VERSION=${JSON.stringify(schema)};
    const MC_ENGINE_VERSION=${JSON.stringify(engine)};
    const MC_KEYS=${JSON.stringify(keys)};
    const districtState={base:{nationalVotesPrev:{}},source:'fixture',ready:true};
    function nationalErrorStructure(){return {signature:'independent-gated'}}
    ${civil}
    ${hash}
    ${poll}
    ${mc}
    const d=new Date(2026,7,25);
    const row={date:d,institute:'Forsa',union:20,afd:28,spd:13,gruene:15,linke:11,bsw:3,fdp:4.5,fw:0,other:5.5};
    const avg={date:d,rows:[row],union:20,afd:28,spd:13,gruene:15,linke:11,bsw:3,fdp:4.5,fw:0,other:5.5};
    console.log(JSON.stringify({civil:civilDateString(d),iso:d.toISOString().slice(0,10),poll:pollArraySignature([row]),mc:mcFingerprint(avg)}));
  `;
  const r=cp.spawnSync(process.execPath,['-e',code],{encoding:'utf8',env:{...process.env,TZ:tz}});
  assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);
}
const utc=run('UTC'),rome=run('Europe/Rome');
assert.equal(utc.civil,'2026-08-25');assert.equal(rome.civil,'2026-08-25');
assert.equal(utc.poll,rome.poll,'poll fingerprint must be timezone invariant');
assert.equal(utc.mc,rome.mc,'MC fingerprint must be timezone invariant');
assert.equal(utc.iso,'2026-08-25');
assert.equal(rome.iso,'2026-08-24','regression fixture must reproduce the old timezone bug');
assert(poll.includes('civilDateString(p.date)'));
assert(!poll.includes('toISOString'));
assert(mc.includes('civilDateString(r.date)'));
assert(mc.includes('civilDateString(avg?.date)'));
assert(mc.includes('fp:${FINGERPRINT_SCHEMA_VERSION}'));
assert(!mc.includes('toISOString'));
const social=s.slice(s.indexOf('function socialCardVersionToken()'),s.indexOf('function socialCardPartyRows'));
assert(social.includes('civilDateString(avg.date)'));assert(!social.includes('toISOString().slice(0,10)'));
console.log('civil-date fingerprint determinism tests passed');
