// The page is a fixed game surface. Only explicit drawers/dialogs scroll;
// two-finger map zoom belongs to MapInput, never to the Safari page viewport.
export function installMobileGuards(doc=globalThis.document){
  let previous=null;
  const editable=target=>target?.closest?.('input,textarea,[contenteditable="true"]');
  const scrollable=target=>target?.closest?.('.shop-tray,.address-strip,.plot-inspector,.quick-build>div,.offer-tray,.barter-plots,.phase-announcement,.modal-body,dialog,.research,#app,.start-screen');
  doc.addEventListener('contextmenu',event=>{if(!editable(event.target))event.preventDefault();});
  doc.addEventListener('selectstart',event=>{if(!editable(event.target))event.preventDefault();});
  doc.addEventListener('dragstart',event=>{if(event.target?.tagName==='IMG')event.preventDefault();});
  for(const type of ['gesturestart','gesturechange','gestureend'])doc.addEventListener(type,event=>event.preventDefault(),{passive:false});
  doc.addEventListener('touchstart',event=>{const point=event.touches[0];previous=point?{x:point.clientX,y:point.clientY}:null;},{passive:true});
  doc.addEventListener('touchmove',event=>{
    if(event.touches.length!==1){event.preventDefault();return;}
    const point=event.touches[0],dx=point.clientX-(previous?.x??point.clientX),dy=point.clientY-(previous?.y??point.clientY);
    previous={x:point.clientX,y:point.clientY};
    if(editable(event.target))return;
    let region=scrollable(event.target);
    // Check all eligible ancestors so a non-scrollable inner panel doesn't trap
    // the enclosing dialog. Prevent rubber-banding at the outermost edge.
    while(region){
      const horizontal=Math.abs(dx)>Math.abs(dy);
      const pos=horizontal?region.scrollLeft:region.scrollTop;
      const max=horizontal?region.scrollWidth-region.clientWidth:region.scrollHeight-region.clientHeight;
      const delta=horizontal?dx:dy;
      if(max>1&&((delta<0&&pos<max-1)||(delta>0&&pos>0)))return;
      region=scrollable(region.parentElement);
    }
    if(event.cancelable)event.preventDefault();
  },{passive:false});
}
