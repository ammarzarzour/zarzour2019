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

test('rejects symlinked or non-regular allowlisted source assets before copying', async () => {
  const { symlink, unlink } = await import('node:fs/promises');
  await fixture(async ({ root, source, destination }) => {
    const external = path.join(root, 'outside-secret.txt');
    await writeFile(external, 'must never be copied');
    const asset = path.join(source, 'brief.mjs');
    await unlink(asset);
    await symlink(external, asset);
    await assert.rejects(buildSoftStandalone(source, destination), /source asset must be a regular file/);
    await assert.rejects(readdir(destination), { code: 'ENOENT' });
    assert.equal(await readFile(external, 'utf8'), 'must never be copied');
    await unlink(asset);
    await mkdir(asset);
    await assert.rejects(buildSoftStandalone(source, destination), /source asset must be a regular file/);
    await assert.rejects(readdir(destination), { code: 'ENOENT' });
  });
});

test('rejects pre-existing destination symlinks and unrelated files without altering them', async () => {
  const { symlink } = await import('node:fs/promises');
  await fixture(async ({ root, source, destination }) => {
    await mkdir(destination);
    const protectedFile = path.join(root, 'protected.txt');
    await writeFile(protectedFile, 'unchanged');
    await symlink(protectedFile, path.join(destination, 'index.html'));
    await assert.rejects(buildSoftStandalone(source, destination), /Destination asset must be a regular file/);
    assert.equal(await readFile(protectedFile, 'utf8'), 'unchanged');
    await rm(path.join(destination, 'index.html'));
    await writeFile(path.join(destination, 'travel-data.json'), 'keep');
    await assert.rejects(buildSoftStandalone(source, destination), /unapproved file/);
    assert.equal(await readFile(path.join(destination, 'travel-data.json'), 'utf8'), 'keep');
    assert.deepEqual((await readdir(destination)).sort(), ['travel-data.json']);
  });
});

test('permits safe rebuild over regular allowlisted destination files', async () => {
  await fixture(async ({ source, destination }) => {
    await mkdir(destination);
    await writeFile(path.join(destination, 'index.html'), 'stale');
    assert.equal(await buildSoftStandalone(source, destination), softFiles.length);
    assert.deepEqual((await readdir(destination)).sort(), [...softFiles].sort());
    assert.equal(await readFile(path.join(destination, 'index.html'), 'utf8'), '<a href="brief.html">Brief</a>');
  });
});

test('rejects symlinked source directory and source ancestor without creating a release', async () => {
  const { symlink } = await import('node:fs/promises');
  await fixture(async ({ root, source, destination }) => {
    const linkedSource = path.join(root, 'linked-source');
    await symlink(source, linkedSource, 'dir');
    await assert.rejects(buildSoftStandalone(linkedSource, destination), /Source path must not contain symbolic links/);
    const linkedParent = path.join(root, 'linked-parent');
    await symlink(root, linkedParent, 'dir');
    await assert.rejects(buildSoftStandalone(path.join(linkedParent, 'source'), destination), /Source path must not contain symbolic links/);
    await assert.rejects(readdir(destination), { code: 'ENOENT' });
    assert.deepEqual((await readdir(source)).sort(), [...softFiles].sort());
    assert.equal(await buildSoftStandalone(source, destination), softFiles.length);
  });
});

test('rejects unquoted HTML resource attributes before publishing', async () => {
  for (const html of [
    '<script src=https://example.invalid/x.js></script>',
    '<a href=../travel/index.html>Travel</a>',
    '<a href=brief.html>Brief</a>'
  ]) {
    await fixture(async ({ source, destination }) => {
      await writeFile(path.join(source, 'index.html'), html);
      await assert.rejects(buildSoftStandalone(source, destination), /unquoted HTML resource attribute/);
      await assert.rejects(readdir(destination), { code: 'ENOENT' });
    });
  }
});

test('rejects persistent workers in JS and inline HTML before creating output', async () => {
  for (const [file, code] of [
    ['brief.mjs', 'navigator.serviceWorker.register("./worker.js")'],
    ['projects.mjs', 'navigator.serviceWorker["register"]("./worker.js")'],
    ['brief.mjs', 'navigator["serviceWorker"]["register"]("./worker.js")'],
    ['index.html', '<script>new SharedWorker("./worker.js")</script>'],
    ['brief.mjs', 'new Worker("./worker.js")'],
    ['projects.mjs', 'importScripts("./worker.js")'],
  ]) {
    await fixture(async ({ source, destination }) => {
      await writeFile(path.join(source, file), code);
      await assert.rejects(buildSoftStandalone(source, destination), /worker registration is forbidden/);
      await assert.rejects(readdir(destination), { code: 'ENOENT' });
    });
  }
});


test('rejects hard-linked source assets before creating any output', async () => {
  const { link, unlink } = await import('node:fs/promises');
  await fixture(async ({ root, source, destination }) => {
    const protectedFile = path.join(root, 'protected-source.txt');
    await writeFile(protectedFile, 'protected source bytes');
    const asset = path.join(source, 'brief.mjs');
    await unlink(asset);
    await link(protectedFile, asset);
    await assert.rejects(buildSoftStandalone(source, destination), /source asset must be a regular, unlinked file/);
    await assert.rejects(readdir(destination), { code: 'ENOENT' });
    assert.equal(await readFile(protectedFile, 'utf8'), 'protected source bytes');
  });
});

test('rejects hard-linked destination assets without overwriting external files', async () => {
  const { link } = await import('node:fs/promises');
  await fixture(async ({ root, source, destination }) => {
    await mkdir(destination);
    const protectedFile = path.join(root, 'protected-destination.txt');
    await writeFile(protectedFile, 'protected destination bytes');
    await link(protectedFile, path.join(destination, 'index.html'));
    await assert.rejects(buildSoftStandalone(source, destination), /Destination asset must be a regular, unlinked file/);
    assert.equal(await readFile(protectedFile, 'utf8'), 'protected destination bytes');
    assert.deepEqual((await readdir(destination)).sort(), ['index.html']);
  });
});
