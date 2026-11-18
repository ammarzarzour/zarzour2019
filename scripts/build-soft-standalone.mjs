import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Only these audited, local assets may enter the independently hosted Soft site.
export const softFiles = Object.freeze([
  'index.html', 'brief.html', 'brief.mjs', 'brief-model.mjs',
  'projects.html', 'projects.mjs', 'projects-model.mjs',
]);

export async function buildSoftStandalone(sourceDir, destinationDir) {
  const source = path.resolve(sourceDir);
  const destination = path.resolve(destinationDir);
  if (destination === source || destination.startsWith(source + path.sep) || source.startsWith(destination + path.sep)) {
    throw new Error('Destination must be outside the source directory and must not be an ancestor of it');
  }
  // Verify every referenced script, stylesheet, and local navigation target.
  for (const file of softFiles) {
    const content = await readFile(path.join(source, file), 'utf8');
    if (!/\.html$/.test(file)) continue;
    for (const [, attribute, value] of content.matchAll(/\b(href|src)=["']([^"']+)["']/gi)) {
      if (value.startsWith('#') || /^(?:mailto:|tel:)/i.test(value)) continue;
      if (/^(?:\/|\.\.\/|https?:|\/\/|data:|javascript:)/i.test(value)) {
        throw new Error(`${file}: external or parent-relative ${attribute} is not standalone: ${value}`);
      }
      const target = value.split(/[?#]/, 1)[0];
      if (!target) continue;
      const normalized = path.posix.normalize(target.replace(/^\.\//, ''));
      const local = normalized === '.' ? 'index.html' : normalized.endsWith('/') ? `${normalized}index.html` : normalized;
      if (!softFiles.includes(local)) throw new Error(`${file}: undeclared local dependency ${value}`);
    }
  }
  for (const file of softFiles.filter(name => name.endsWith('.mjs'))) {
    const content = await readFile(path.join(source, file), 'utf8');
    for (const [, dependency] of content.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
      if (!dependency.startsWith('./') || !softFiles.includes(path.posix.normalize(dependency.slice(2)))) {
        throw new Error(`${file}: dependency outside standalone Soft bundle: ${dependency}`);
      }
    }
  }
  await mkdir(destination, { recursive: true });
  for (const file of softFiles) await copyFile(path.join(source, file), path.join(destination, file));
  return softFiles.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const destination = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'dist', 'zarzour-soft');
  const count = await buildSoftStandalone(path.join(root, 'docs', 'soft'), destination);
  console.log(`Built independent Zarzour Soft static bundle (${count} files) at ${destination}`);
}
