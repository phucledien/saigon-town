import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as engine from '../dist/engine.mjs';
import {BLOCK_LAYOUTS,PLOT_LAYOUT} from '../dist/board-layout.mjs';
import {cameraFor,dragCamera} from '../dist/camera.mjs';
import {zodiacImages} from '../dist/zodiac.mjs';

test('plot taps, shop builds and phase changes never replace the running street scene',()=>{
  // A DOM-write boundary test, not a CSS timing simulation. Forbid mutations to
  // the mounted scene/ancestors while executing the actual application renderer.
  const source=readFileSync(new URL('../dist/app.mjs',import.meta.url),'utf8');
  const nodes=new Map(),protectedNodes=new Set(['#app','.game-shell','.play-stage','.board-area','.board-frame','.map-viewport','.game-world','.map-terrain']);
  let mounts=0,observes=0,sceneRefs;
  function node(selector){
    let html='';
    const result={style:{},scrollLeft:0,clientWidth:390,clientHeight:600,attributes:{},
      setAttribute(name,value){this.attributes[name]=value;},
      set innerHTML(value){
        assert.ok(!protectedNodes.has(selector)||selector==='#app'&&mounts===0,`${selector} would disconnect the running scene`);
        html=value;
        if(selector==='#app'){
          mounts++;
          for(const match of value.matchAll(/class="([^"]+)"/g))for(const cls of match[1].split(' '))if(!nodes.has('.'+cls))nodes.set('.'+cls,node('.'+cls));
          sceneRefs=['.game-shell','.map-viewport','.game-world','.map-terrain','.ninja-ride','.ninja-return','.city-bus','.crossing-one','.crossing-two','.crossing-three'].map(s=>nodes.get(s));
          assert.ok(sceneRefs.every(Boolean),'mount includes the complete animated scene');
        }
        if(selector==='.game-hud-bottom')nodes.set('.shop-tray',node('.shop-tray'));
      },
      get innerHTML(){return html;}
    };
    return result;
  }
  nodes.set('#app',node('#app'));
  nodes.set('#start-screen',node('#start-screen'));
  const state=engine.newGame(()=>.31),frames=[];
  const ctx=vm.createContext({...engine,BLOCK_LAYOUTS,PLOT_LAYOUT,cameraFor,dragCamera,
    $:selector=>nodes.get(selector)||null,state,language:'vi',view:'play',menuOpen:false,selectedShop:null,selectedLot:null,chosen:[],freshLots:[],rackOpen:false,
    cameraCenter:{x:550,y:365},camera:null,cameraInitialized:false,cameraScale:null,
    hudResizeObserver:null,renderedYear:1,observedPhase:'',phaseDelay:null,zodiacImages,
    SPRITES:['coffee','banhmi','pho','flowers','tailor','grocery'],
    LANDMARKS:['tan-dinh','ben-thanh','thao-dien','cho-lon','binh-thanh','phu-nhuan'],
    ZODIAC:[['Tỵ','Snake','snake'],['Ngọ','Horse','horse'],['Mùi','Goat','goat'],['Thân','Monkey','monkey'],['Dậu','Rooster','rooster'],['Tuất','Dog','dog']],TOKEN_COLORS:['green','gold','red','blue'],
    money:n=>`${n} đ`,tr:(en,vi)=>vi,escape:s=>s,
    document:{documentElement:{},body:{dataset:{},classList:{toggle(){}}}},
    gameAudio:{setPhase(){}},cancelMapGesture(){},dismissPhase(){},updateGuides(){},animateWallets(){},animateYear(){},updateSoundButton(){},
    requestAnimationFrame:fn=>frames.push(fn),setTimeout:()=>0,clearTimeout(){},
    ResizeObserver:class{observe(){observes++;}disconnect(){}}
  });
  vm.runInContext(source.slice(source.indexOf('function sprite('),source.indexOf('function gameMenu(')),ctx);
  function refresh(){
    ctx.render();while(frames.length)frames.shift()();
    assert.equal(mounts,1);assert.equal(observes,1);
    assert.deepEqual(['.game-shell','.map-viewport','.game-world','.map-terrain','.ninja-ride','.ninja-return','.city-bus','.crossing-one','.crossing-two','.crossing-three'].map(s=>nodes.get(s)),sceneRefs);
    assert.equal((nodes.get('.plot-layer').innerHTML.match(/class="lot /g)||[]).length,72);
  }
  refresh();
  const offered=state.pending.slice(0,state.draftCount);
  nodes.get('.shop-tray').scrollLeft=91;
  ctx.cameraScale=1.6;ctx.cameraCenter={x:600,y:400};ctx.fitMap();
  const transform=nodes.get('.game-world').style.transform;
  for(const id of offered){ctx.chosen.push(id);ctx.selectedLot=id;refresh();}
  assert.equal(nodes.get('.shop-tray').scrollLeft,91);
  assert.equal(nodes.get('.game-world').style.transform,transform);
  assert.match(nodes.get('.game-hud-bottom').innerHTML,/selected/);
  engine.claimPlots(state,offered,()=>.2);ctx.chosen=[];refresh();
  assert.match(nodes.get('.game-hud-bottom').innerHTML,/Trả giá/);
  engine.beginBuild(state);refresh();
  ctx.selectedShop=state.players[0].tiles.findIndex(n=>n>0);ctx.rackOpen=true;refresh();
  assert.match(nodes.get('.camera-hint').textContent,/liền kề/);
  ctx.rackOpen=false;refresh();
  const plot=engine.holdings(state,0)[0].id;
  engine.placeShop(state,plot,ctx.selectedShop);ctx.selectedLot=plot;refresh();
  assert.match(nodes.get('.plot-layer').innerHTML,/built-shop/);
  engine.finishYear(state);refresh();
  engine.nextYear(state);refresh();
  assert.equal(state.year,2);
});
