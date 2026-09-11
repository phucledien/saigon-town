import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameAudio } from '../src/audio.ts';

test('music defaults on, explicit mute survives reload, and effects remain independently configurable', () => {
  const original = globalThis.localStorage,
    values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  try {
    const first = createGameAudio();
    assert.equal(first.getSettings().music, true);
    assert.equal(first.getSettings().sfx, true);
    first.setMusic(false);
    first.setSfx(false);
    first.destroy();
    const second = createGameAudio();
    assert.equal(second.getSettings().music, false);
    assert.equal(second.getSettings().sfx, false);
    second.setSfx(true);
    assert.equal(second.getSettings().music, false);
    second.destroy();
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  }
});
