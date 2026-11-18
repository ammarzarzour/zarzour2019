import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildSoftStandalone, softFiles } from './build-soft-standalone.mjs';

async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zarzour-soft-bundle-'));
  const source = path.join(root, 'source');
  await mkdir(source);
  try {
    for (const file of softFiles) await writeFile(path.join(source, file), file === 'index.html' ? '<a href="brief.html">Brief</a>' : '');
    await run({ root, source, destination: path.join(root, 'published') });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('standalone package contains only the seven audited Soft assets', async () => {
  await fixture(async ({ source, destination }) => {
    await writeFile(path.join(source, 'travel-private.json'), 'not part of Soft');
    assert.equal(await buildSoftStandalone(source, destination), 7);
    assert.deepEqual((await readdir(destination)).sort(), [...softFiles].sort());
    assert.match(await readFile(path.join(destination, 'index.html'), 'utf8'), /brief.html/);
  });
});

test('rejects navigation or scripts that escape the Soft package', async () => {
  for (const value of ['../dashboard.html', '/travel/', 'https://example.com/app.js', 'missing.html']) {
    await fixture(async ({ source, destination }) => {
      await writeFile(path.join(source, 'index.html'), `<script src="${value}"></script>`);
      await assert.rejects(buildSoftStandalone(source, destination), /not standalone|undeclared local dependency/);
    });
  }
});

test('rejects source-tree destinations and imports outside Soft', async () => {
  await fixture(async ({ source, destination }) => {
    await assert.rejects(buildSoftStandalone(source, path.join(source, 'out')), /outside the source/);
    await writeFile(path.join(source, 'projects.mjs'), 'import { x } from "../../travel.mjs";');
    await assert.rejects(buildSoftStandalone(source, destination), /outside standalone Soft bundle/);
  });
});

test('rejects output into an ancestor of the source without modifying source files', async () => {
  await fixture(async ({ root, source }) => {
    const original = await readFile(path.join(source, 'index.html'), 'utf8');
    await assert.rejects(buildSoftStandalone(source, root), /must not be an ancestor/);
    assert.equal(await readFile(path.join(source, 'index.html'), 'utf8'), original);
    assert.deepEqual((await readdir(root)).sort(), ['source']);
  });
});

test('packages the real checked-in Soft site without Travel assets or changed bytes', async () => {
  const realSource = path.resolve('docs/soft');
  await fixture(async ({ destination }) => {
    assert.equal(await buildSoftStandalone(realSource, destination), softFiles.length);
    assert.deepEqual((await readdir(destination)).sort(), [...softFiles].sort());
    for (const file of softFiles) {
      assert.deepEqual(
        await readFile(path.join(destination, file)),
        await readFile(path.join(realSource, file)),
        `packaged ${file} must match its audited source`,
      );
    }
  });
});


test('rejects symlinked output directory and parent without touching source', async () => {
  const { symlink } = await import('node:fs/promises');
  await fixture(async ({ root, source }) => {
    const original = await readFile(path.join(source, 'index.html'), 'utf8');
    const linkedOutput = path.join(root, 'linked-output');
    await symlink(source, linkedOutput, 'dir');
    await assert.rejects(buildSoftStandalone(source, linkedOutput), /symbolic links/);
    await assert.rejects(buildSoftStandalone(source, path.join(linkedOutput, 'nested')), /symbolic links/);
    assert.equal(await readFile(path.join(source, 'index.html'), 'utf8'), original);
    assert.deepEqual((await readdir(source)).sort(), [...softFiles].sort());
  });
});
