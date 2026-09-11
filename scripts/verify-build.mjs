import assert from 'node:assert/strict';
import { GAME_IMAGES } from '../src/preload.ts';
import { readFile, readdir, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const SITE = new URL('https://saigontown.phucld.com/');
const output = resolve(process.argv[2] ?? 'dist');
const index = resolve(output, 'index.html');
const checked = new Set();

function attributes(tag) {
  return Object.fromEntries(
    [...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(
      ([, name, double, single, bare]) => [name.toLowerCase(), double ?? single ?? bare],
    ),
  );
}

async function checkReference(reference, from = index) {
  if (!reference || reference.startsWith('#')) return null;
  const base = new URL(relative(output, from).split(sep).join('/'), SITE);
  const url = new URL(reference, base);
  if (url.origin !== SITE.origin) return null;
  assert(
    !url.pathname.startsWith('/src/') && !/\.(?:ts|tsx|mts|cts)$/.test(url.pathname),
    `Source entrypoint remains in the build: ${reference}`,
  );
  const pathname = decodeURIComponent(url.pathname);
  const file = resolve(output, `.${pathname}`, pathname.endsWith('/') ? 'index.html' : '');
  assert(file.startsWith(`${output}${sep}`), `Resource leaves the build directory: ${reference}`);
  if (!checked.has(file)) {
    const info = await stat(file).catch(() => null);
    assert(info?.isFile(), `Missing built resource: ${reference} (from ${relative(output, from)})`);
    checked.add(file);
  }
  return file;
}

async function bundleFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await bundleFiles(path)));
    else if (/\.(?:js|mjs|css)$/.test(entry.name)) files.push(path);
  }
  return files;
}

async function verify() {
  const html = await readFile(index, 'utf8');
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const meta = (name) => metas.find((item) => (item.property ?? item.name) === name)?.content;
  const link = (relation) => links.find((item) => item.rel?.split(/\s+/).includes(relation));
  const entries = scripts.filter((item) => item.type === 'module' && item.src);

  assert(
    entries.length > 0 && entries.every((item) => /\.(?:js|mjs)(?:[?#]|$)/.test(item.src)),
    'Built index.html must load bundled JavaScript modules.',
  );
  assert(link('stylesheet')?.href, 'Built index.html is missing its bundled stylesheet.');
  assert.equal(link('canonical')?.href, SITE.href, 'Canonical URL must use the public game URL.');
  assert.equal(meta('og:url'), SITE.href, 'Open Graph URL must use the public game URL.');
  for (const name of ['og:image', 'twitter:image']) {
    const value = meta(name);
    assert(value, `Missing ${name} metadata.`);
    assert.equal(new URL(value).origin, SITE.origin, `${name} must use the public game domain.`);
    await checkReference(value);
  }

  for (const [tag] of html.matchAll(/<(?:script|link|img|source)\b[^>]*>/gi)) {
    const item = attributes(tag);
    if (item.src) await checkReference(item.src);
    if (item.href) await checkReference(item.href);
  }

  const manifestLink = link('manifest');
  assert(manifestLink?.href, 'Missing web app manifest link.');
  const manifestFile = await checkReference(manifestLink.href);
  assert(manifestFile, 'The web app manifest must be local to the game.');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  assert(Array.isArray(manifest.icons), 'The web app manifest must list app icons.');
  for (const size of ['192x192', '512x512']) {
    assert(
      manifest.icons.some((icon) => icon.sizes?.split(/\s+/).includes(size)),
      `Missing ${size} home-screen icon in the manifest.`,
    );
  }
  for (const icon of manifest.icons) {
    assert(typeof icon.src === 'string', 'Manifest icon is missing its source.');
    assert(await checkReference(icon.src, manifestFile), 'Manifest icons must be local.');
  }
  for (const relation of ['icon', 'apple-touch-icon']) {
    const iconLink = link(relation);
    assert(iconLink?.href, `Missing ${relation} link.`);
    assert(await checkReference(iconLink.href), `${relation} must be local.`);
  }
  assert(
    link('apple-touch-icon').sizes?.split(/\s+/).includes('180x180'),
    'The Apple home-screen icon must declare its 180x180 size.',
  );

  // Include assets assembled dynamically by the sprite renderer, not just literal bundle URLs.
  for (const image of GAME_IMAGES) await checkReference(image);

  const bundles = await bundleFiles(output);
  for (const file of bundles) {
    const content = await readFile(file, 'utf8');
    const references = new Set();
    // Literal asset URLs also occur inside the game's HTML template strings.
    for (const [reference] of content.matchAll(
      /(?<![A-Za-z0-9:/])\/assets\/[A-Za-z0-9_./@%+~-]+\.(?:png|jpe?g|gif|webp|svg|ico|ttf|otf|woff2?|zip|json|webmanifest|js|mjs|css)(?:\?[^\s"'`<>\\]*)?/g,
    )) {
      references.add(reference);
    }
    // Vite's chunk imports and other concrete relative file references.
    for (const [, reference] of content.matchAll(
      /["']((?:\.\/|\.\.\/)[^"'\\\s]+\.(?:js|mjs|css|png|jpe?g|webp|svg|woff2?|ttf|json)(?:\?[^"'\\\s]*)?)["']/g,
    )) {
      references.add(reference);
    }
    if (file.endsWith('.css')) {
      for (const match of content.matchAll(
        /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s)]+))\s*\)/g,
      )) {
        references.add(match[1] ?? match[2] ?? match[3]);
      }
    }
    for (const [, reference] of content.matchAll(/[#@]\s*sourceMappingURL=([^\s]+)/g)) {
      references.add(reference);
    }
    for (const reference of references) await checkReference(reference, file);
  }
  console.log(
    `Verified built site: ${checked.size} local resources, ${bundles.length} JS/CSS files, sharing metadata, and app icons.`,
  );
}

try {
  await verify();
} catch (error) {
  console.error(
    `Build verification failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
