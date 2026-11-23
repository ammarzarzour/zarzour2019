import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workflow = readFileSync(fileURLToPath(new URL('../.github/workflows/zarzour-pages.yml', import.meta.url)), 'utf8');
const jobs = workflow.split(/^jobs:\s*$/m)[1];
assert.ok(jobs, 'Pages workflow must contain jobs');

test('Pages artifact is built and uploaded exactly once, in a separate job', () => {
  const sections = jobs.split(/^  deploy:\s*$/m);
  assert.equal(sections.length, 2, 'build and deploy must be separate jobs');
  const [build, deploy] = sections;
  assert.match(build, /^  build:\s*$/m);
  assert.match(build, /actions\/upload-pages-artifact@v3/);
  assert.match(build, /node --test scripts\/bookings\.test\.mjs/);
  assert.doesNotMatch(build, /actions\/deploy-pages@v4/, 'build job must never deploy');
  assert.doesNotMatch(deploy, /actions\/upload-pages-artifact@v3/, 'retries must not re-upload artifact');
  assert.match(deploy, /^    needs: build\s*$/m);
  assert.match(deploy, /actions\/deploy-pages@v4/);
  assert.equal((jobs.match(/actions\/upload-pages-artifact@v3/g)||[]).length,1);
  assert.equal((jobs.match(/actions\/deploy-pages@v4/g)||[]).length,1);
});

test('Pages deployment remains protected by environment, permissions and no cross-run overlap', () => {
  assert.match(workflow, /group: zarzour-pages/);
  assert.match(workflow, /cancel-in-progress: true/);
  assert.match(workflow, /^  pages: write\s*$/m);
  assert.match(workflow, /^  id-token: write\s*$/m);
  assert.match(jobs, /^    environment:\s*\n      name: github-pages\s*$/m);
});
