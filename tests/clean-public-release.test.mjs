import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

test('the public markup does not expose development audit controls', () => {
  const publicAuditMarkers = [
    '<details class="nowcast-audit"',
    'id="reliabilitySensitivityBox"',
    'id="correlationSensitivityBox"',
    'id="runReliabilityShadow"',
    'id="runCorrelationSensitivity"',
    'id="residualShadowSummary"',
    'id="mcBtVerdict"',
    'id="corrBtVerdict"',
    'audit-summary-badge">AUDIT',
  ];

  for (const marker of publicAuditMarkers) {
    assert.equal(html.includes(marker), false, `public markup still contains ${marker}`);
  }
});

test('the public release note uses reader-facing copy', () => {
  const releaseNote = html.match(/<div class="release-note">([\s\S]*?)<\/div>/)?.[1] ?? '';

  assert.ok(releaseNote.includes('Correzione del residuo nazionale'));
  assert.equal(releaseNote.includes('diagnostico legacy'), false);
  assert.equal(releaseNote.includes('full-shadow'), false);
  assert.equal(releaseNote.includes('promozione'), false);
});

test('statistical validation remains enforced in code', () => {
  const requiredChecks = [
    "const MC_ENGINE_VERSION='v22.4.1-residual-fix'",
    'function probabilisticSeatPromotionGate()',
    'function correlationPromotionGate()',
    'function runInternalChecks()',
    "const pg=probabilisticSeatPromotionGate()",
    "const cg=correlationPromotionGate()",
  ];

  for (const marker of requiredChecks) {
    assert.ok(html.includes(marker), `missing internal validation marker ${marker}`);
  }
});

test('reader-facing backtests and the new coalition configurations remain available', () => {
  const requiredPublicFeatures = [
    'id="btTitle"',
    'id="territorialValidationCard"',
    'function parliamentConfigurationKey(',
    'function monteCarloCoalitionConfigurationProbability(',
    'function conditionalProbPct(',
    'coalitionWinsConfig',
    'configurations',
  ];

  for (const marker of requiredPublicFeatures) {
    assert.ok(html.includes(marker), `missing retained feature ${marker}`);
  }
});
