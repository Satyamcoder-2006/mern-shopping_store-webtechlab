import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validationResult, type ValidationChain } from 'express-validator';
import { faceoffRules } from './validation.ts';

async function errors(looks: number, consent = true) {
  const req = { body: { title: 'An everyday outfit', caption: '', publicConsent: consent,
    looks: Array.from({ length: looks }, (_, i) => ({ image: `/api/media/00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, label: `Look ${i + 1}` })) } };
  for (const rule of faceoffRules.slice(0, -1) as ValidationChain[]) await rule.run(req);
  return validationResult(req);
}

test('outfit posts accept one, two or three photos and reject zero or four', async () => {
  for (const count of [1, 2, 3]) assert.equal((await errors(count)).isEmpty(), true, `${count} photos should be accepted`);
  for (const count of [0, 4]) assert.ok((await errors(count)).array().some(error => error.msg === 'Add between 1 and 3 outfit photos.'));
  assert.ok((await errors(1, false)).array().some(error => error.msg === 'Confirm that your photos will be public'));
});
