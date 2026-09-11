import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameAudio} from '../dist/audio.mjs';

test('music defaults on, explicit mute survives reload, and effects remain independently configurable',()=>{
  const original=globalThis.localStorage,values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    const first=createGameAudio();assert.equal(first.getSettings().music,true);assert.equal(first.getSettings().sfx,false);
    first.setMusic(false);first.setSfx(true);first.destroy();
    const second=createGameAudio();assert.equal(second.getSettings().music,false);assert.equal(second.getSettings().sfx,true);second.destroy();
  }finally{if(original===undefined)delete globalThis.localStorage;else globalThis.localStorage=original;}
});
