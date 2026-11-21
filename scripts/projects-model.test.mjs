import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, upsertProject, safeProjects } from '../docs/soft/projects-model.mjs';

const valid = {
  reference: 'SOFT-001', type: 'website', stage: 'discovery',
  status: 'planned', targetDate: '2026-12-01',
  tasksTotal: 2, tasksDone: 0, notes: ''
};

test('invalid project payloads produce validation errors rather than exceptions', () => {
  for (const value of [null, undefined, false, 0, '', [], 'invalid']) {
    assert.deepEqual(validateProject(value), ['project']);
    const result = upsertProject([], value, 'test-project');
    assert.deepEqual(result.errors, ['project']);
    assert.deepEqual(result.items, []);
  }
});

test('valid projects still pass validation and can be added', () => {
  assert.deepEqual(validateProject(valid), []);
  const result = upsertProject([], valid, 'test-project');
  assert.deepEqual(result.errors, []);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].reference, valid.reference);
});

test('stored malformed projects are skipped safely', () => {
  assert.deepEqual(safeProjects([null, [], 'invalid']), []);
});
