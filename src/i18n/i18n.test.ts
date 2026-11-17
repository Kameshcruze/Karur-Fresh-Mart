import test from 'node:test';
import assert from 'node:assert/strict';
import { en } from './en';
import { ta } from './ta';
import { translate } from './index';

function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...collectKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

test('English and Tamil dictionaries contain identical translation keys', () => {
  const enKeys = collectKeys(en as unknown as Record<string, unknown>);
  const taKeys = collectKeys(ta as unknown as Record<string, unknown>);
  assert.deepEqual(taKeys, enKeys);
});

test('translate resolves keys and interpolates parameters in EN and TA', () => {
  assert.equal(translate('en', 'brand.name'), 'Karur Fresh Mart');
  assert.equal(translate('ta', 'brand.name'), 'கரூர் பிரஷ் மார்ட்');
  assert.equal(translate('en', 'common.offPercent', { percent: 15 }), '15% OFF');
  assert.equal(translate('ta', 'common.offPercent', { percent: 15 }), '15% தள்ளுபடி');
});

function getLeafValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

test('Every EN and TA translation leaf is a non-empty string', () => {
  const keys = collectKeys(en as unknown as Record<string, unknown>);
  for (const key of keys) {
    const enVal = getLeafValue(en as unknown as Record<string, unknown>, key);
    const taVal = getLeafValue(ta as unknown as Record<string, unknown>, key);
    assert.equal(typeof enVal, 'string', `Expected EN string at ${key}`);
    assert.ok((enVal as string).trim().length > 0, `Empty EN string at ${key}`);
    assert.equal(typeof taVal, 'string', `Expected TA string at ${key}`);
    assert.ok((taVal as string).trim().length > 0, `Empty TA string at ${key}`);
  }
});
