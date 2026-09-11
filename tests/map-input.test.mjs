import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraFor,pinchCamera,scaleLimits} from '../dist/camera.mjs';
import {MapInput} from '../dist/map-input.mjs';

test('pinch keeps the world point under a moving finger midpoint',()=>{
  const start=cameraFor(400,500,{x:550,y:365},1);
  const next=pinchCamera(400,500,start,{x:100,y:200},{x:120,y:220},2);
  assert.equal(next.scale,2);assert.equal(next.x,490);assert.equal(next.y,330);
  assert.equal(next.left+450*next.scale,120);assert.equal(next.top+315*next.scale,220);
});
test('pinch bounds permit an overview and cap enlargement without leaving the town',()=>{
  const start=cameraFor(390,510);
  const out=pinchCamera(390,510,start,{x:195,y:255},{x:195,y:255},.001);
  assert.equal(out.scale,scaleLimits(390,510).min);
  assert.ok(out.left>=-1e-8);assert.ok(out.left+1100*out.scale<=390+1e-8);
  const into=pinchCamera(390,510,start,{x:195,y:255},{x:10000,y:10000},100);
  assert.equal(into.scale,2.8);assert.ok(into.left<=0&&into.top<=0);
});
test('tap remains a tap; a pinch consumes both releases and one-finger continuation does not jump',()=>{
  const g=new MapInput(),start=cameraFor(400,500,{x:550,y:365},1);
  g.down(1,{x:100,y:200},start,400,500);
  assert.equal(g.move(1,{x:102,y:201}),null);assert.equal(g.up(1,start),false);
  g.down(1,{x:100,y:200},start,400,500);g.down(2,{x:200,y:200},start,400,500);
  const enlarged=g.move(2,{x:300,y:200});assert.equal(enlarged.scale,2);
  assert.equal(g.up(2,enlarged),true);
  const still=g.move(1,{x:100,y:200});assert.deepEqual(still,enlarged);
  const moved=g.move(1,{x:120,y:200});assert.equal(moved.left-enlarged.left,20);
  assert.equal(g.up(1,moved),true);assert.equal(g.points.size,0);
});
test('third pointers and cancelled gestures cannot become stray map taps',()=>{
  const g=new MapInput(),c=cameraFor(390,500);
  g.down(1,{x:100,y:200},c,390,500);g.down(2,{x:200,y:200},c,390,500);
  assert.equal(g.down(3,{x:250,y:200},c,390,500),false);
  assert.equal(g.move(3,{x:10,y:10}),null);assert.equal(g.up(3,c),true);
  assert.equal(g.clear(),true);assert.equal(g.points.size,0);
  assert.equal(g.move(1,{x:120,y:200}),null);assert.equal(g.up(1,c),false);
  g.down(4,{x:100,y:200},c,390,500);assert.equal(g.up(4,c),false);
});
test('ignored fingers remain blocked after the pinch fingers lift, including cancellation',()=>{
  const g=new MapInput(),c=cameraFor(390,500);
  for(const [id,x] of [[1,100],[2,200],[3,250]])g.down(id,{x,y:200},c,390,500);
  g.up(1,c);g.up(2,c);assert.equal(g.blocksClick,true);
  assert.equal(g.up(3,c),true);assert.equal(g.blocksClick,false);
  g.down(4,{x:100,y:200},c,390,500);g.down(5,{x:200,y:200},c,390,500);
  g.clear(true);assert.equal(g.blocksClick,true);g.up(4,c);g.up(5,c);assert.equal(g.blocksClick,false);
  g.down(6,{x:100,y:200},c,390,500);assert.equal(g.up(6,c),false);
});
