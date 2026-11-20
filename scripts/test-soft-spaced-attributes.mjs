import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildSoftStandalone, softFiles } from './build-soft-standalone.mjs';

async function withFixture(html, callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'zarzour-soft-guard-'));
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  try {
    await mkdir(source);
    for (const name of softFiles) {
      await writeFile(path.join(source, name), name === 'index.html' ? html : '');
    }
    await callback(source, output);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('rejects externally hosted href with spaces around equals before copying', async () => {
  await withFixture('<a href = "https://example.invalid/track">link</a>', async (source, output) => {
    await assert.rejects(buildSoftStandalone(source, output), /external or parent-relative href/);
    await assert.rejects(readdir(output), { code: 'ENOENT' });
  });
});

test('rejects parent-relative src with whitespace before equals', async () => {
  await withFixture('<img src  = "../travel/private.png">', async (source, output) => {
    await assert.rejects(buildSoftStandalone(source, output), /external or parent-relative src/);
    await assert.rejects(readdir(output), { code: 'ENOENT' });
  });
});

test('allows declared local navigation with spaces around equals', async () => {
  await withFixture('<a href = "projects.html">Projects</a>', async (source, output) => {
    assert.equal(await buildSoftStandalone(source, output), softFiles.length);
    assert.match(await readFile(path.join(output, 'index.html'), 'utf8'), /projects.html/);
  });
});

test('rejects external form action before writing standalone bundle', async () => {
  await withFixture('<form action="https://example.invalid/collect"><button>Submit</button></form>', async (source, output) => {
    await assert.rejects(buildSoftStandalone(source, output), /external or parent-relative action/);
    await assert.rejects(readdir(output), { code: 'ENOENT' });
  });
});

test('rejects unquoted form action and parent-relative button formaction', async () => {
  await withFixture('<form action = https://example.invalid/collect></form>', async (source, output) => {
    await assert.rejects(buildSoftStandalone(source, output), /unquoted HTML resource attribute/);
  });
  await withFixture('<button formaction="../travel/submit">Submit</button>', async (source, output) => {
    await assert.rejects(buildSoftStandalone(source, output), /external or parent-relative formaction/);
  });
});

test('allows explicitly local form destination', async () => {
  await withFixture('<form action = "brief.html"><button>Continue</button></form>', async (source, output) => {
    assert.equal(await buildSoftStandalone(source, output), softFiles.length);
  });
});

test('rejects mailto and tel form submission handlers', async () => {
  for (const html of [
    '<form action="mailto:outside@example.invalid"></form>',
    '<button formaction="tel:+123456">Submit</button>',
  ]) {
    await withFixture(html, async (source, output) => {
      await assert.rejects(buildSoftStandalone(source, output), /external form destination/);
      await assert.rejects(readdir(output), { code: 'ENOENT' });
    });
  }
});

test('still permits mailto navigation links', async () => {
  await withFixture('<a href="mailto:contact@example.invalid">Contact</a>', async (source, output) => {
    assert.equal(await buildSoftStandalone(source, output), softFiles.length);
  });
});
