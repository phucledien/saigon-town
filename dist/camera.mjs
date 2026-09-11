// World coordinates stay stable when the HUD changes size or the phone rotates.
export const WORLD = { width: 1100, height: 730 };
export function scaleLimits(width,height,fit='cover'){
  const ratios=[Math.max(1,width)/WORLD.width,Math.max(1,height)/WORLD.height];
  const cover=Math.max(...ratios);
  return {min:fit==='contain'?Math.min(...ratios):cover,max:Math.max(2.8,cover*2)};
}
export function cameraFor(width, height, center = { x: 550, y: 365 }, requestedScale = null, fit = 'cover') {
  width = Math.max(1, width); height = Math.max(1, height);
  const limits=scaleLimits(width,height,fit);
  const scale = Number.isFinite(requestedScale) ? Math.max(limits.min,Math.min(limits.max,requestedScale)) : fit==='contain'?limits.min:Math.max(.9,limits.min);
  const halfX = width / (2 * scale), halfY = height / (2 * scale);
  const clamp = (n, half, size) => half >= size / 2 ? size / 2 : Math.max(half, Math.min(size - half, n));
  const x = clamp(center.x, halfX, WORLD.width), y = clamp(center.y, halfY, WORLD.height);
  return { scale, x, y, left: width / 2 - x * scale, top: height / 2 - y * scale, fit };
}
export function dragCamera(camera, dx, dy) {
  return { x: camera.x - dx / camera.scale, y: camera.y - dy / camera.scale };
}
// Keep the same world point under the two-finger midpoint while it moves.
export function pinchCamera(width,height,start,startMid,mid,distanceRatio){
  const fit=start.fit||'cover',limits=scaleLimits(width,height,fit);
  const scale=Math.max(limits.min,Math.min(limits.max,start.scale*distanceRatio));
  const anchor={x:(startMid.x-start.left)/start.scale,y:(startMid.y-start.top)/start.scale};
  const center={x:anchor.x-(mid.x-width/2)/scale,y:anchor.y-(mid.y-height/2)/scale};
  return cameraFor(width,height,center,scale,fit);
}
// Wheel deltas can be pixels, text lines, or pages. Zoom around the pointer.
export function wheelCamera(width,height,start,point,deltaY,deltaMode=0){
  const unit=deltaMode===1?16:deltaMode===2?height:1;
  const pixels=Math.max(-240,Math.min(240,deltaY*unit));
  return pinchCamera(width,height,start,point,point,Math.exp(-pixels*.002));
}
