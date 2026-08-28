const assert=require('node:assert/strict');
const core=require('./final-coverage-core.js');

assert.equal(core.binomialLowerTail(0,1,.5),.5);
assert(Math.abs(core.binomialLowerTail(1,2,.5)-.75)<1e-12);

const rows=[
  {actual:4.9,estimate:5.2,covered:{50:false,80:true,95:true}},
  {actual:10,estimate:4.8,covered:{50:true,80:true,95:true}},
  {actual:4.3,estimate:4.6,covered:{50:true,80:true,95:true}},
];
const b=core.bucketSummary(rows,3,7);
assert.equal(b.actual.n,2);
assert.equal(b.estimate.n,3);
assert.equal(b.actual.levels['80'].covered,2);

const health=core.healthVerdict({
  overall:{
    '50':{n:19,covered:9,coverage:9/19,undercoverageP:core.binomialLowerTail(9,19,.5)},
    '80':{n:19,covered:16,coverage:16/19,undercoverageP:core.binomialLowerTail(16,19,.8)},
    '95':{n:19,covered:18,coverage:18/19,undercoverageP:core.binomialLowerTail(18,19,.95)},
  },
  expected80:16/19,
  bucket:{actual:{n:3,levels:{}},estimate:{n:4,levels:{}}},
  monotonic:true,
  activeAlphaMatched:true,
});
assert.equal(health.pass,true);

assert.equal(core.nearlyEqual(16/19,0.8421052632),true,'16/19 must match frozen rounded reference');
const precisionHealth=core.healthVerdict({
  overall:{
    '50':{n:19,covered:7,coverage:7/19,undercoverageP:.1796},
    '80':{n:19,covered:16,coverage:16/19,undercoverageP:.7631},
    '95':{n:19,covered:18,coverage:18/19,undercoverageP:.6226},
  },
  expected80:0.8421052632,
  bucket:{actual:{n:3,levels:{}},estimate:{n:3,levels:{}}},
  monotonic:true,
  activeAlphaMatched:true,
});
assert.equal(precisionHealth.pass,true,'rounded frozen reference must not trigger a false FAIL');

console.log('final coverage core tests passed');
