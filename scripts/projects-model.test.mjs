import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProject, upsertProject, safeProjects, projectMetrics } from '../docs/soft/projects-model.mjs';

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

test('duplicate stored ids or references cannot be updated ambiguously', () => {
  const first = { ...valid, id: 'soft-1' };
  const duplicateId = { ...valid, id: 'soft-1', reference: 'SOFT-002' };
  const duplicateReference = { ...valid, id: 'soft-2', reference: 'soft-001' };
  for (const items of [[first, duplicateId], [first, duplicateReference]]) {
    const result = upsertProject(items, { ...valid, notes: 'changed' }, 'soft-1');
    assert.deepEqual(result.errors, ['projectStore']);
    assert.equal(result.items, items);
  }
  const blankId = [{ ...valid, id: '   ' }];
  const result = upsertProject(blankId, valid, 'soft-1');
  assert.deepEqual(result.errors, ['projectStore']);
  assert.equal(result.items, blankId);
});

test('missing, blank and non-string project identifiers cannot create unusable records', () => {
  const existing = upsertProject([], valid, 'existing-project').items;
  for (const id of [undefined, null, '', '  ', 123, {}, [], 'x'.repeat(121)]) {
    const result = upsertProject(existing, { ...valid, reference: 'SOFT-NEW' }, id);
    assert.deepEqual(result.errors, ['projectId']);
    assert.equal(result.items, existing);
  }
  const created = upsertProject(existing, { ...valid, reference: 'SOFT-NEW' }, 'new-project');
  assert.deepEqual(created.errors, []);
  assert.equal(created.items[0].id, 'new-project');
});

test('restoring stored projects drops oversized IDs that cannot be updated', () => {
  const validStored = { ...valid, id: 'soft-valid' };
  const oversized = { ...valid, id: 'x'.repeat(121), reference: 'SOFT-LONG' };
  const restored = safeProjects([oversized, validStored]);
  assert.equal(restored.length, 1);
  assert.equal(restored[0].id, 'soft-valid');
  assert.deepEqual(upsertProject(restored, { ...valid, notes: 'edited' }, 'soft-valid', restored[0]).errors, []);
  const rejected = upsertProject([oversized], valid, 'soft-valid');
  assert.deepEqual(rejected.errors, ['projectStore']);
});

test('updating a collection with an oversized stored ID fails without mutation', () => {
  const oversized = { ...valid, id: 'x'.repeat(121) };
  const stored = [oversized];
  const result = upsertProject(stored, { ...valid, reference: 'SOFT-NEW' }, 'new-project');
  assert.deepEqual(result.errors, ['projectStore']);
  assert.equal(result.items, stored);
  assert.equal(stored[0], oversized);
  const validStored = [{ ...valid, id: 'valid-id' }];
  assert.deepEqual(upsertProject(validStored, { ...valid, reference: 'SOFT-NEW' }, 'new-project').errors, []);
});


test('creating with an existing ID never silently overwrites a project', () => {
  const existing = upsertProject([], valid, 'existing-project').items;
  const incoming = { ...valid, reference: 'SOFT-NEW', notes: 'another project' };
  const collision = upsertProject(existing, incoming, 'existing-project');
  assert.deepEqual(collision.errors, ['duplicateId']);
  assert.equal(collision.items, existing);
  assert.equal(existing[0].reference, 'SOFT-001');
  const edit = upsertProject(existing, { ...valid, notes: 'edited' }, 'existing-project', existing[0]);
  assert.deepEqual(edit.errors, []);
  assert.equal(edit.items[0].notes, 'edited');
  const fresh = upsertProject(existing, incoming, 'another-project');
  assert.deepEqual(fresh.errors, []);
  assert.equal(fresh.items.length, 2);
});


test('delivery board reports duplicate IDs without mislabeling them as readiness failures', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const board = readFileSync(fileURLToPath(new URL('../docs/soft/projects.mjs', import.meta.url)), 'utf8');
  for (const error of ['duplicateId', 'duplicateReference', 'projectStore', 'projectId', 'readiness']) {
    assert.ok(board.includes(error + ':['), `Missing feedback for ${error}`);
  }
  assert.match(board, /Project ID already exists; the existing project was not overwritten\./);
  assert.match(board, /معرّف المشروع مستخدم بالفعل/);
  assert.match(board, /Review project details and try again\./);
});


test('release-ready metric excludes planned and blocked projects even with completed checks', () => {
  const ready = { ...valid, id: 'active-ready', status: 'active', stage: 'release', tasksDone: 2,
    acceptanceReady: true, securityReviewed: true, bilingualReviewed: true };
  const items = [ready, { ...ready, id: 'planned-ready', reference: 'SOFT-002', status: 'planned' },
    { ...ready, id: 'blocked-ready', reference: 'SOFT-003', status: 'blocked' },
    { ...ready, id: 'completed-ready', reference: 'SOFT-004', status: 'completed' },
    { ...ready, id: 'not-ready', reference: 'SOFT-005', securityReviewed: false }];
  assert.equal(projectMetrics(items, '2026-11-22').releaseReady, 2);
  assert.equal(projectMetrics(items.filter(x => x.status === 'blocked'), '2026-11-22').releaseReady, 0);
  assert.equal(projectMetrics(items.filter(x => x.status === 'planned'), '2026-11-22').releaseReady, 0);
});


test('local project deletion requires an explicit bilingual confirmation', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const board = readFileSync(fileURLToPath(new URL('../docs/soft/projects.mjs', import.meta.url)), 'utf8');
  assert.match(board, /if\(!window\.confirm\(question\)\)return;changeStoredProject\(id,null\)/);
  assert.match(board, /هل تريد حذف المشروع/);
  assert.match(board, /Delete project \$\{item\.reference\}/);
  assert.match(board, /This cannot be undone/);
});

test('optimistic edit snapshots must belong to the same project ID', () => {
  const stored = upsertProject([], valid, 'soft-first').items;
  const proposed = { ...valid, notes: 'edited' };
  for (const expected of [
    { ...stored[0], id: 'soft-other' },
    { ...stored[0], id: undefined },
    { ...stored[0], id: null }
  ]) {
    const result = upsertProject(stored, proposed, 'soft-first', expected);
    assert.deepEqual(result.errors, ['conflict']);
    assert.equal(result.items, stored);
    assert.equal(stored[0].notes, '');
  }
  const accepted = upsertProject(stored, proposed, 'soft-first', stored[0]);
  assert.deepEqual(accepted.errors, []);
  assert.equal(accepted.items[0].notes, 'edited');
});


test('standalone projects board synchronizes bilingual direction on storage changes', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const board = readFileSync(fileURLToPath(new URL('../docs/soft/projects.mjs', import.meta.url)), 'utf8');
  assert.match(board, /event\.key===languageKey\|\|event\.key===null/);
  assert.match(board, /event\.newValue==="en"\?"en":"ar"/);
  assert.match(board, /if\(next!==lang\)\{lang=next;applyLanguage\(\)\}/);
  assert.match(board, /if\(event\.key===languageKey\)return/);
  assert.match(board, /document\.documentElement\.dir=lang==="ar"\?"rtl":"ltr"/);
});
