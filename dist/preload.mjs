const shops=['coffee','banhmi','pho','flowers','tailor','grocery'];
const districts=['tan-dinh','ben-thanh','thao-dien','cho-lon','binh-thanh','phu-nhuan'];
export const GAME_IMAGES=[
  '/assets/city/saigon-city-board-v6.png',
  ...shops.map(name=>`/assets/shops/${name}.png`),
  ...[0,1,2,3].map(id=>`/assets/materials/stool-${id}-v8.png`),
  ...districts.map(name=>`/assets/signs/${name}-v6.png`),
  '/assets/materials/plot-ground.png',
  ...['chieu-mat-v9','plot-mini-v9','calendar-paper-v9'].map(name=>`/assets/ui/${name}.png`),
  ...['ninja-lead','city-bus','pedestrian-walk','game-banknote'].map(name=>`/assets/life/${name}.png`)
];
const decoded=new Map();
export async function preloadGameImages(onProgress=()=>{},ImageType=globalThis.Image){
  let completed=0;
  const failed=[];
  await Promise.all(GAME_IMAGES.map(src=>new Promise(resolve=>{
    if(decoded.has(src)){onProgress(++completed,GAME_IMAGES.length);resolve();return;}
    const image=new ImageType();let settled=false;
    const finish=ok=>{if(settled)return;settled=true;clearTimeout(timeout);image.onload=image.onerror=null;if(ok)decoded.set(src,image);else failed.push(src);onProgress(++completed,GAME_IMAGES.length);resolve();};
    const timeout=setTimeout(()=>finish(false),12000);
    image.onload=()=>{if(image.decode)image.decode().then(()=>finish(true),()=>finish(true));else finish(true);};
    image.onerror=()=>finish(false);image.src=src;
  })));
  return {failed,total:GAME_IMAGES.length};
}
