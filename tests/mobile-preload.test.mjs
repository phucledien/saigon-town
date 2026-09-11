import test from 'node:test';
import assert from 'node:assert/strict';
import {installMobileGuards} from '../dist/mobile.mjs';
import {preloadGameImages,GAME_IMAGES} from '../dist/preload.mjs';

test('page gestures are blocked while rack, dialog scrolling and cash editing remain available',()=>{
  const handlers=new Map();installMobileGuards({addEventListener:(name,fn)=>handlers.set(name,fn)});
  const fakeTarget=(region,name='.shop-tray')=>({closest:selector=>selector.split(',').includes(name)?region:null});
  const move=(target,x,y,count=1)=>{let blocked=false;handlers.get('touchstart')({touches:[{clientX:0,clientY:0}]});handlers.get('touchmove')({target,touches:Array.from({length:count},()=>({clientX:x,clientY:y})),cancelable:true,preventDefault(){blocked=true;}});return blocked;};
  assert.equal(move(fakeTarget(null),0,-40),true);
  const rack={scrollLeft:10,scrollWidth:700,clientWidth:320,scrollTop:0,scrollHeight:80,clientHeight:80,parentElement:null};
  assert.equal(move(fakeTarget(rack),-40,0),false);
  rack.scrollLeft=380;assert.equal(move(fakeTarget(rack),-40,0),true);
  const dialog={scrollLeft:0,scrollWidth:340,clientWidth:340,scrollTop:40,scrollHeight:850,clientHeight:400,parentElement:null};
  assert.equal(move(fakeTarget(dialog,'.modal-body'),0,-50),false);
  assert.equal(move(fakeTarget(dialog,'.modal-body'),0,-50,2),true);
  const research={scrollHeight:1000,clientHeight:1000,scrollTop:0,parentElement:fakeTarget(dialog,'#app')};
  assert.equal(move(fakeTarget(research,'.research'),0,-50),false);
  for(const name of ['.barter-plots','.phase-announcement'])assert.equal(move(fakeTarget(dialog,name),0,-50),false);
  rack.scrollLeft=10;assert.equal(move(fakeTarget(rack,'.offer-tray'),-40,0),false);
  const input={closest:()=>input};assert.equal(move(input,10,0),false);
});

test('image warming waits for decode, reports failures and retries only missing artwork',async()=>{
  let loads=0,fail=true;const progress=[];
  class ImageStub{
    set src(value){loads++;queueMicrotask(()=>{if(fail&&value===GAME_IMAGES[0])this.onerror();else this.onload();});}
    async decode(){await Promise.resolve();}
  }
  const first=await preloadGameImages((count,total)=>progress.push([count,total]),ImageStub);
  assert.deepEqual(first.failed,[GAME_IMAGES[0]]);assert.equal(loads,GAME_IMAGES.length);
  assert.deepEqual(progress.at(-1),[GAME_IMAGES.length,GAME_IMAGES.length]);
  fail=false;const second=await preloadGameImages(()=>{},ImageStub);
  assert.equal(second.failed.length,0);assert.equal(loads,GAME_IMAGES.length+1);
});
