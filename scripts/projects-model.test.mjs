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

test('malformed optimistic concurrency snapshots return conflict without throwing', () => {
  const existing = upsertProject([], valid, 'test-project').items;
  for (const expected of [null, false, [], 'invalid', { ...valid, reference: null }]) {
    const result = upsertProject(existing, { ...valid, notes: 'changed' }, 'test-project', expected);
    assert.deepEqual(result.errors, ['conflict']);
    assert.equal(result.items, existing);
  }
  const malformedExisting = [{ ...existing[0], reference: null }];
  const result = upsertProject(malformedExisting, valid, 'test-project', valid);
  assert.deepEqual(result.errors, ['projectStore']);
  assert.equal(result.items, malformedExisting);
});

test('malformed stored collections are rejected without mutations or exceptions', () => {
  const invalidCollections = [null, undefined, {}, [null], [[]], ['invalid'], [{ id: 'broken', reference: null }]];
  for (const items of invalidCollections) {
    const result = upsertProject(items, valid, 'test-project');
    assert.deepEqual(result.errors, ['projectStore']);
    assert.equal(result.items, items);
  }
});
