import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {newGame} from '../dist/engine.mjs';

test('start menu preserves the prepared or saved game and waits for artwork before play',async()=>{
  const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
  const controls=new Map(['[data-load-label]','progress','[data-action="resume"]','[data-action="retry-assets"]'].map(key=>[key,{}]));
  const root={innerHTML:'',querySelector:key=>controls.get(key)};
  const state=newGame(()=>.2),before=JSON.stringify(state);
  let finishLoading;
  const ctx=vm.createContext({state,menuOpen:true,sessionStarted:false,assetsReady:false,assetFailures:[],loadingCount:0,loadingPromise:null,GAME_IMAGES:['board','shop'],
    $:()=>root,tr:(en,vi)=>vi,sprite:()=>'',phaseName:()=> 'Nhận lộc',
    preloadGameImages:onProgress=>new Promise(resolve=>{finishLoading=()=>{onProgress(2,2);resolve({failed:[]});};})
  });
  vm.runInContext(source.slice(source.indexOf('function hasProgress()'),source.indexOf('function gameMenu()')),ctx);
  ctx.renderStartMenu();assert.match(root.innerHTML,/Bắt đầu chơi/);assert.doesNotMatch(root.innerHTML,/data-action="new"/);
  assert.equal(controls.get('[data-action="resume"]').disabled,true);
  const ready=ctx.warmAssets();finishLoading();await ready;
  assert.equal(controls.get('[data-action="resume"]').disabled,false);
  assert.equal(JSON.stringify(state),before);
  state.lots[0].owner=0;const saved=JSON.stringify(state);ctx.renderStartMenu();
  assert.match(root.innerHTML,/Chơi tiếp/);assert.match(root.innerHTML,/data-action="new"/);
  assert.equal(JSON.stringify(state),saved);
  ctx.menuOpen=false;ctx.renderStartMenu();assert.equal(root.hidden,true);
});
