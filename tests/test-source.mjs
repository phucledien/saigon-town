import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

// VM tests exercise application functions without mounting the browser app.
// Strip only type syntax so the production function bodies remain unchanged.
export function loadApplicationSource() {
  const sourceUrl = new URL('../src/app.ts', import.meta.url);
  const source = readFileSync(sourceUrl, 'utf8');
  return stripTypeScriptTypes(source, {
    mode: 'strip',
    sourceUrl: sourceUrl.href,
  });
}
