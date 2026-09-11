import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameAudio} from '../dist/audio.mjs';
await test('Safari audio activation and interruption lifecycle',async t=>{
const original={now:Date.now,localStorage:globalThis.localStorage,document:globalThis.document,setInterval:globalThis.setInterval,clearInterval:globalThis.clearInterval,AudioContext:globalThis.AudioContext};
t.after(()=>{Date.now=original.now;for(const key of ['localStorage','document','setInterval','clearInterval','AudioContext']){if(original[key]===undefined)delete globalThis[key];else globalThis[key]=original[key];}});
let now=1000,current,sourceCount=0,intervalId=0;
const saved=new Map(),events=new Map(),intervals=new Map();
Date.now=()=>now;
globalThis.localStorage={getItem:key=>saved.get(key),setItem:(key,value)=>saved.set(key,value)};
globalThis.document={hidden:false,addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:key=>events.delete(key)};
globalThis.setInterval=fn=>{intervals.set(++intervalId,fn);return intervalId;};
globalThis.clearInterval=id=>intervals.delete(id);
const param=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(){},cancelScheduledValues(){}});
const node=()=>({connect(){},disconnect(){}});
globalThis.AudioContext=class{
  constructor(){current=this;this.currentTime=0;this.sampleRate=48000;this.state='suspended';this.destination=node();this.resumeCalls=0;this.resolvers=[];}
  createGain(){return {...node(),gain:param()};}
  createBiquadFilter(){return {...node(),frequency:param(),Q:param()};}
  createBuffer(_channels,length){return {getChannelData:()=>new Float32Array(length)};}
  createOscillator(){sourceCount++;return {...node(),frequency:param(),start(){},stop(){}};}
  createBufferSource(){return this.createOscillator();}
  resume(){this.resumeCalls++;return new Promise(resolve=>this.resolvers.push(resolve));}
  finishResume(){this.state='running';this.onstatechange?.();for(const resolve of this.resolvers.splice(0))resolve();}
  async suspend(){this.state='suspended';this.onstatechange?.();}
  async close(){this.state='closed';}
};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){saved.clear();document.hidden=false;sourceCount=0;const audio=createGameAudio();audio.setMusic(false);const ready=audio.unlock();return {audio,ready,ctx:current};}
await t.test('first tap and bot speech survive delayed resume exactly once',async()=>{
  const {audio,ready,ctx}=setup();audio.play('tap');audio.speak('positive',1);const second=audio.unlock();
  assert.equal(ctx.resumeCalls,1);assert.equal(sourceCount,0);now+=150;ctx.finishResume();await Promise.all([ready,second]);
  assert.equal(sourceCount,5);await audio.unlock();assert.equal(sourceCount,5);audio.destroy();
});
await t.test('stale cue expires before resumed playback',async()=>{
  const {audio,ready,ctx}=setup();audio.play('income');audio.speak('negative');now+=800;ctx.finishResume();await ready;
  assert.equal(sourceCount,0);audio.destroy();
});
await t.test('queue is bounded to eight action cues',async()=>{
  const {audio,ready,ctx}=setup();for(let i=0;i<20;i++)audio.play('place');ctx.finishResume();await ready;
  assert.equal(sourceCount,16);audio.destroy();
});
await t.test('SFX mute drops pending cues',async()=>{
  const {audio,ready,ctx}=setup();audio.play('build');audio.speak('positive');audio.setSfx(false);ctx.finishResume();await ready;
  assert.equal(sourceCount,0);audio.destroy();
});
await t.test('context stays suspended if muted while resume was pending',async()=>{
  const {audio,ready,ctx}=setup();audio.setSfx(false);ctx.finishResume();await ready;await settle();
  const state=ctx.state;audio.destroy();assert.equal(state,'suspended');
});
await t.test('context stays suspended if hidden while resume was pending',async()=>{
  const {audio,ready,ctx}=setup();audio.play('income');document.hidden=true;events.get('visibilitychange')();ctx.finishResume();await ready;await settle();
  const state=ctx.state;assert.equal(sourceCount,0);audio.destroy();document.hidden=false;assert.equal(state,'suspended');
});
await t.test('saved SFX off remains off',async()=>{
  saved.set('vietnamtown-sound','off');const audio=createGameAudio();assert.equal(audio.getSettings().sfx,false);audio.destroy();
});


});
