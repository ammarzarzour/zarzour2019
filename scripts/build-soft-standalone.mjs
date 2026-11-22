import { copyFile, lstat, mkdir, readFile } from 'node:fs/promises';
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
  // Never follow an existing symlink in the output path: it could redirect
  // writes into the source tree or another site.
  let segment = path.parse(destination).root;
  for (const part of path.relative(segment, destination).split(path.sep).filter(Boolean)) {
    segment = path.join(segment, part);
    try {
      if ((await lstat(segment)).isSymbolicLink()) {
        throw new Error('Destination path must not contain symbolic links');
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  // Reject symlinked source directories and ancestors as well as individual assets.
  // Otherwise a directory link could silently substitute a different Soft tree.
  let sourceSegment = path.parse(source).root;
  for (const part of path.relative(sourceSegment, source).split(path.sep).filter(Boolean)) {
    sourceSegment = path.join(sourceSegment, part);
    const stat = await lstat(sourceSegment);
    if (stat.isSymbolicLink()) {
      throw new Error('Source path must not contain symbolic links');
    }
    if (!stat.isDirectory()) {
      throw new Error('Source path must contain directories only');
    }
  }
  // A symlinked allowlisted asset could copy data from outside the audited Soft tree.
  // Reject non-regular files before reading or copying any package contents.
  for (const file of softFiles) {
    const stat = await lstat(path.join(source, file));
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
      throw new Error(`${file}: source asset must be a regular, unlinked file (no symbolic or hard links)`);
    }
  }
  // Verify every referenced script, stylesheet, and local navigation target.
  for (const file of softFiles) {
    const content = await readFile(path.join(source, file), 'utf8');
    // Standalone previews are local-only: block network APIs in both modules
    // and inline HTML before any release files are copied.
    if (/\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\b|EventSource\s*\(|sendBeacon\s*\()/i.test(content)) {
      throw new Error(`${file}: network behavior is forbidden in standalone Soft preview`);
    }
    // A persistent service worker or worker thread would violate the static,
    // offline-only Soft preview boundary, including bracket-property calls.
    if (/\b(?:new\s+(?:SharedWorker|Worker)\s*\(|importScripts\s*\(|serviceWorker\s*(?:\.\s*register|\[\s*['"]register['"]\s*\])\s*\(|navigator\s*\[\s*['"]serviceWorker['"]\s*\]\s*(?:\.\s*register|\[\s*['"]register['"]\s*\])\s*\()/i.test(content)) {
      throw new Error(`${file}: worker registration is forbidden in standalone Soft preview`);
    }
    // CSS can load remote resources without using fetch() or HTML src/href.
    // Standalone previews must never request network styles or images.
    if (/@import\b/i.test(content) || /url\s*\(\s*['"]?\s*(?:https?:|\/\/|data:|\/|\.\.\/)/i.test(content)) {
      throw new Error(`${file}: external CSS resource is forbidden in standalone Soft preview`);
    }
    if (!/\.html$/.test(file)) continue;
    // A quoted-only parser must not silently ignore unquoted HTML navigation or form destinations.
    // Fail closed before copying any assets into the standalone package.
    // A base element can silently redirect otherwise allowlisted relative links
    // to Travel or remote origins; meta refresh can navigate without href/src.
    // Neither mechanism is needed in the portable, offline Soft preview.
    if (/<\s*base\b/i.test(content) || /<\s*meta\b[^>]*\bhttp-equiv\s*=\s*['"]?refresh\b/i.test(content)) {
      throw new Error(`${file}: HTML base or refresh navigation is forbidden in standalone Soft preview`);
    }
    // srcset and poster are independent resource-loading channels; fail closed
    // until their URL grammar is explicitly audited and allowlisted.
    if (/\b(?:srcset|poster)\s*=/i.test(content)) {
      throw new Error(`${file}: unaudited HTML media resource attribute is not standalone`);
    }
    if (/\b(?:href|src|action|formaction)\s*=\s*(?!["'])[^\s>]+/i.test(content)) {
      throw new Error(`${file}: unquoted HTML resource attribute is not standalone`);
    }
    // Forms must not silently submit standalone Soft drafts to Travel or external endpoints.
    for (const [, rawAttribute, value] of content.matchAll(/\b(href|src|action|formaction)\s*=\s*["']([^"']+)["']/gi)) {
      const attribute = rawAttribute.toLowerCase();
      // mailto: and tel: are navigation-only; forms must never submit drafts via external handlers.
      if ((attribute === 'action' || attribute === 'formaction') && /^(?:mailto:|tel:)/i.test(value)) {
        throw new Error(`${file}: external form destination ${attribute} is not standalone: ${value}`);
      }
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
    // Dynamic imports can load undeclared modules at runtime, bypassing the
    // static import allowlist. The standalone preview does not need them.
    if (/\bimport\s*\(/.test(content)) {
      throw new Error(`${file}: dynamic imports are forbidden in standalone Soft bundle`);
    }
    // Side-effect imports have no 'from' clause and need separate validation.
    for (const [, dependency] of content.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
      if (!dependency.startsWith('./') || !softFiles.includes(path.posix.normalize(dependency.slice(2)))) {
        throw new Error(`${file}: dependency outside standalone Soft bundle: ${dependency}`);
      }
    }
    for (const [, dependency] of content.matchAll(/\bfrom\s*["']([^"']+)["']/g)) {
      if (!dependency.startsWith('./') || !softFiles.includes(path.posix.normalize(dependency.slice(2)))) {
        throw new Error(`${file}: dependency outside standalone Soft bundle: ${dependency}`);
      }
    }
  }
  // Refuse pre-existing output entries that could redirect writes or mix in
  // unrelated Travel assets. Do not delete or overwrite unapproved files.
  try {
    const entries = await (await import('node:fs/promises')).readdir(destination);
    for (const entry of entries) {
      if (!softFiles.includes(entry)) {
        throw new Error(`Destination contains unapproved file: ${entry}`);
      }
      const stat = await lstat(path.join(destination, entry));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) {
        throw new Error(`Destination asset must be a regular, unlinked file: ${entry}`);
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
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
