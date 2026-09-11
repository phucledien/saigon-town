import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraFor,dragCamera,WORLD,scaleLimits} from '../dist/camera.mjs';
import {PLOT_LAYOUT,CELL_SIZE} from '../dist/board-layout.mjs';

test('every address can be brought fully into a phone or landscape playfield',()=>{
  for(const [width,height] of [[320,340],[390,490],[844,180],[1280,690]]){
    for(const p of PLOT_LAYOUT){
      const c=cameraFor(width,height,{x:p.x+25,y:p.y+25});
      const x=c.left+p.x*c.scale,y=c.top+p.y*c.scale;
      assert.ok(CELL_SIZE*c.scale>=45,'plots must remain tappable');
      assert.ok(x>=-0.001&&x+CELL_SIZE*c.scale<=width+.001,`plot ${p.id} clipped horizontally`);
      assert.ok(y>=-0.001&&y+CELL_SIZE*c.scale<=height+.001,`plot ${p.id} clipped vertically`);
    }
  }
});
test('default and minimum zoom fill portrait, landscape and desktop without blank bands',()=>{
  for(const [width,height] of [[390,720],[430,850],[844,180],[1440,1000]]){
    for(const scale of [null,scaleLimits(width,height).min]){
      for(const center of [{x:0,y:0},{x:550,y:365},{x:1100,y:730}]){
        const c=cameraFor(width,height,center,scale);
        assert.ok(c.left<=.001&&c.top<=.001);
        assert.ok(c.left+WORLD.width*c.scale>=width-.001);
        assert.ok(c.top+WORLD.height*c.scale>=height-.001);
      }
    }
  }
});
test('drag distance is in screen pixels and repeated drags stay within town edges',()=>{
  const start=cameraFor(390,450,{x:500,y:350});
  const next=cameraFor(390,450,dragCamera(start,90,-45));
  assert.ok(Math.abs(next.left-start.left-90)<.001);
  assert.ok(Math.abs(next.top-start.top+45)<.001);
  for(const n of [-100000,100000]){
    const c=cameraFor(390,450,dragCamera(start,n,n));
    assert.ok(c.left<=.001&&c.top<=.001);
    assert.ok(c.left+WORLD.width*c.scale>=390-.001);
    assert.ok(c.top+WORLD.height*c.scale>=450-.001);
  }
});
test('opening the shop tray retains the focused neighborhood',()=>{
  const before=cameraFor(390,480,{x:555,y:365});
  const after=cameraFor(390,350,before);
  assert.equal(after.x,before.x);assert.equal(after.y,before.y);
});
