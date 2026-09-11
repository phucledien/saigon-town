import {cameraFor,dragCamera,pinchCamera} from './camera.mjs?v=9';
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const distance=(a,b)=>Math.max(1,Math.hypot(a.x-b.x,a.y-b.y));

// This state machine owns only map gestures. Racks and dialogs use native scrolling.
export class MapInput {
  constructor(){this.points=new Map();this.ignored=new Set();this.active=false;this.pan=null;this.pinch=null;}
  get blocksClick(){return this.points.size>0||this.ignored.size>0;}
  down(id,point,camera,width,height){
    if(this.points.has(id)||this.ignored.has(id))return false;
    if(this.points.size>=2){this.ignored.add(id);return false;}
    this.width=width;this.height=height;this.points.set(id,point);
    if(this.points.size===1){this.active=false;this.pan={point,camera};}
    else {const [a,b]=[...this.points.values()];this.pinch={camera,mid:midpoint(a,b),distance:distance(a,b)};this.active=true;}
    return true;
  }
  move(id,point){
    if(!this.points.has(id))return null;this.points.set(id,point);
    if(this.points.size===2){const [a,b]=[...this.points.values()],p=this.pinch;return pinchCamera(this.width,this.height,p.camera,p.mid,midpoint(a,b),distance(a,b)/p.distance);}
    const dx=point.x-this.pan.point.x,dy=point.y-this.pan.point.y;
    if(!this.active&&Math.hypot(dx,dy)<6)return null;
    this.active=true;
    return cameraFor(this.width,this.height,dragCamera(this.pan.camera,dx,dy),this.pan.camera.scale);
  }
  up(id,camera){
    if(this.ignored.delete(id))return true;
    if(!this.points.has(id))return false;
    const consumed=this.active;this.points.delete(id);this.pinch=null;
    if(this.points.size===1)this.pan={point:[...this.points.values()][0],camera};
    else {this.active=false;this.pan=null;}
    return consumed;
  }
  clear(quarantine=false){const consumed=this.active||this.ignored.size>0;if(quarantine){for(const id of this.points.keys())this.ignored.add(id);}else this.ignored.clear();this.points.clear();this.active=false;this.pan=null;this.pinch=null;return consumed;}
}
