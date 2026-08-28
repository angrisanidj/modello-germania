const fs=require('fs');
const assert=require('assert');

const p=process.argv[2]||'scripts/input-integrity-ui.js';
const s=fs.readFileSync(p,'utf8');

assert(!/const body=document\.querySelector\('\.nowcast-audit \.audit-body'\);if\(body\)/.test(s),
  'ensureUi dipende ancora esclusivamente dal vecchio contenitore Audit');
assert(s.includes("section.backtest.backtest-grid"),
  'manca il fallback alla sezione di validazione nazionale realmente presente');
assert(s.includes("box.dataset.inputIntegrityAudit='true'"),
  'manca il data attribute diagnostico');
assert(s.includes("input-integrity-panel"),
  'manca la card autonoma di fallback');
assert(s.includes("needsPaint=!!audit&&!audit.dataset.integrityRendered"),
  'manca la protezione contro pannello creato dopo una render precedente');
assert(s.includes("audit.dataset.integrityRendered='true'"),
  'manca il flag di render completato');
console.log('input-integrity panel fallback structural test passed');
