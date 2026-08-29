const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');

const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'index.html'),'utf8');

function extractFunction(name){
  const token=`function ${name}(`,start=source.indexOf(token);assert(start>=0,`${name} missing`);
  const bodyStart=source.indexOf('{',start);let depth=0,quote=null,escaped=false;
  for(let i=bodyStart;i<source.length;i++){
    const c=source[i];
    if(quote){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c===quote)quote=null;continue}
    if(c==="'"||c==='"'||c==='`'){quote=c;continue}
    if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);
  }
  throw new Error(`unbalanced ${name}`);
}

function extractBlock(startToken,endToken){
  const start=source.indexOf(startToken),end=source.indexOf(endToken,start);assert(start>=0&&end>start,`${startToken} block missing`);
  return source.slice(start,end);
}

const parties=['union','afd','spd','gruene','linke','bsw','fdp','fw','other'].map(key=>({key}));
const polls=[
  {date:new Date('2026-08-28T12:00:00Z'),institute:'Complete',union:20,afd:28,spd:14,gruene:13,linke:10,bsw:3,fdp:5,fw:null,other:5},
  {date:new Date('2026-08-28T12:00:00Z'),institute:'Detailed',union:21,afd:27,spd:14,gruene:13,linke:10,bsw:3,fdp:5,fw:1,other:5.418}
];
const sandbox={Date,Map,Set,Number,Math,state:{polls},PARTIES:parties,DAY:86400000,MC_KEYS:parties.map(x=>x.key),SSW_ASSUMED_SHARE:.153,NATIONAL_VECTOR_TOLERANCE:.5};
sandbox.dayKey=d=>new Date(d).setUTCHours(0,0,0,0);
sandbox.pollsterReliabilityWeights=()=>new Map();
vm.createContext(sandbox);
vm.runInContext([
  extractFunction('projectionAverage'),
  extractFunction('finitePollShare'),
  extractFunction('nationalSimulationBaseInfo'),
  extractFunction('productionNationalBaseInfo'),
  extractFunction('strictResidualBase'),
  'this.avg=projectionAverage();this.info=productionNationalBaseInfo(avg);',
  extractBlock('// 8) Residual integrity regression:','// 9) v22.4 probabilistic promotion gate:')
].join('\n'),sandbox);

assert.equal(sandbox.avg.fw,1,'the published FW average must keep its own one-poll denominator');
assert.equal(sandbox.avg.other,5.209,'the published other average must remain independently calculated');
const publishedTotal=parties.reduce((sum,p)=>sum+(sandbox.avg[p.key]||0),0);
assert.ok(Math.abs(publishedTotal-99.209)<1e-12,'fixture must reproduce the -0.791 p.p. aggregate mismatch');
assert.ok(Math.abs(sandbox.info.base.other-5.847)<1e-12,'simulation other must be the coherent residual after named parties');
assert.ok(Math.abs(sandbox.info.rawSum-sandbox.info.target)<1e-12,'simulation vector must match its national target');
assert.ok(Math.abs(sandbox.info.delta)<1e-12,'simulation vector integrity delta must be zero');
assert.equal(sandbox.avg.other,5.209,'simulation residual reconstruction must not mutate the published average');
console.log('Monte Carlo national residual regression test passed');
