import {SHOPS,holdings,emptyOffer,trade} from './engine.mjs?v=5';

export function makeDraft(state, partner, prefillLot=null, prefillShop=null) {
  if (![1,2,3].includes(partner)) throw Error('Choose a neighbor.');
  const draft={partner,give:emptyOffer(),take:emptyOffer()};
  if(prefillLot!==null && state.lots[prefillLot]?.owner===partner) draft.take.lots=[prefillLot];
  if(prefillShop!==null && state.players[partner].tiles[prefillShop]>0) draft.take.tiles[prefillShop]=1;
  return draft;
}
export function adjustDraft(state,draft,side,kind,index,delta=1) {
  if(!['give','take'].includes(side)) return;
  const p=state.players[side==='give'?0:draft.partner],d=draft[side];
  if(kind==='cash') d.cash=Math.max(0,Math.min(p.cash,d.cash+delta));
  if(kind==='tile' && Number.isInteger(index) && index>=0 && index<6)
    d.tiles[index]=Math.max(0,Math.min(p.tiles[index],d.tiles[index]+delta));
  if(kind==='lot' && state.lots[index]?.owner===p.id)
    d.lots=d.lots.includes(index)?d.lots.filter(id=>id!==index):[...d.lots,index];
  return draft;
}

export function createTrading({getState,tr,sprite,token,modal,closeModal,onChanged,playSound,onTrading,speak=()=>{}}) {
  let draft=null,status='idle',message='',shortfall=0,timer=null;
  const names=['coffee','banhmi','pho','flowers','tailor','grocery'];
  const $=s=>document.querySelector(s);
  const hasItems=d=>d.cash||d.lots.length||d.tiles.some(n=>n>0);
  const greetings=[null,
    ['A spot next door? Now we’re talking!','Mặt bằng sát bên hả? Nghe là thấy hợp rồi đó!'],
    ['Let’s see what you brought to the table.','Để coi bạn có gì hay nào. Giá đẹp rồi mình tính nha!'],
    ['Have a seat. Let’s find a deal for both of us.','Ngồi xuống uống miếng trà. Mình cùng có lời nha!']];
  function intro(){message=tr(...greetings[draft.partner]);}
  function inventory(player,side){const s=getState(),p=s.players[player],d=draft[side];
    return `<section class="barter-side"><div class="barter-owner">${token(player)}<strong>${player===0?tr('You give','Bạn đưa'):tr(p.name+' gives',p.name+' đưa')}</strong><small>${p.cash} đ</small></div>
      <div class="offer-tray" aria-label="${tr('Selected offer','Đồ đã chọn')}">${hasItems(d)?`${d.cash?`<span class="offer-chip cash-chip">${d.cash} đ</span>`:''}${d.tiles.map((n,i)=>n?`<button data-bargain="remove" data-side="${side}" data-kind="tile" data-index="${i}" aria-label="${tr('Remove one','Bớt một')} ${SHOPS[i].name}">${sprite('shops',names[i])}<b>×${n}</b><em>−</em></button>`:'').join('')}${d.lots.map(id=>`<button data-bargain="asset" data-side="${side}" data-kind="lot" data-index="${id}" aria-label="${tr('Remove plot','Bỏ lô')} ${id+1}"><span class="offer-address">${id+1}</span><em>−</em></button>`).join('')}`:`<span class="empty-tray">${tr('Tap items below to offer them','Chạm đồ bên dưới để đặt lên bàn')}</span>`}</div>
      <div class="cash-stepper"><span>${tr('Cash','Tiền')}</span><button data-bargain="cash" data-side="${side}" data-delta="-10" aria-label="${tr('Less cash','Bớt tiền')}">−10</button><label><span class="sr-only">${tr('Cash offered','Số tiền đưa')} ${side}</span><input data-bargain-cash="${side}" type="number" inputmode="numeric" min="0" max="${p.cash}" step="1" value="${d.cash}"> đ</label><button data-bargain="cash" data-side="${side}" data-delta="10" aria-label="${tr('More cash','Thêm tiền')}">+10</button></div>
      <p class="stash-label">${tr('SHOP PIECES · TAP TO ADD','MẢNH TIỆM · CHẠM ĐỂ THÊM')}</p><div class="barter-grid">${SHOPS.map((shop,i)=>`<button class="stash-slot ${d.tiles[i]?'selected':''}" data-bargain="asset" data-side="${side}" data-kind="tile" data-index="${i}" ${p.tiles[i]===d.tiles[i]?'disabled':''} aria-label="${shop.name}, ${p.tiles[i]-d.tiles[i]} ${tr('available','còn lại')}">${sprite('shops',names[i])}<strong>${shop.name}</strong><small>×${p.tiles[i]-d.tiles[i]}</small>${d.tiles[i]?`<b class="slot-added">+${d.tiles[i]}</b>`:''}</button>`).join('')}</div>
      <p class="stash-label">${tr('ADDRESSES · BUILT SHOPS INCLUDED','MẶT BẰNG · KÈM TIỆM ĐÃ XÂY')}</p><div class="barter-plots">${holdings(s,player).map(l=>`<button class="plot-slot ${d.lots.includes(l.id)?'selected':''}" data-bargain="asset" data-side="${side}" data-kind="lot" data-index="${l.id}" aria-pressed="${d.lots.includes(l.id)}" aria-label="${tr('Plot','Lô')} ${l.id+1}${l.shop!==null?', '+SHOPS[l.shop].name:''}">${l.shop!==null?sprite('shops',names[l.shop]):'<span class="empty-property">⌂</span>'}<b>${l.id+1}</b>${d.lots.includes(l.id)?'<i>✓</i>':''}</button>`).join('')||`<span class="empty-tray">${tr('No addresses yet','Chưa có mặt bằng')}</span>`}</div></section>`;
  }
  function body(){const s=getState(),p=s.players[draft.partner],busy=status==='thinking',done=status==='accepted';
    return `<div class="barter-people" role="group" aria-label="${tr('Choose a neighbor','Chọn hàng xóm')}">${s.players.slice(1).map(n=>`<button data-bargain="person" data-player="${n.id}" aria-pressed="${n.id===p.id}" ${busy?'disabled':''}>${token(n.id)}<strong>${n.name}</strong><span>${[null,tr('Neighborly','Dễ thương'),tr('Sharp','Sành giá'),tr('Easygoing','Thoải mái')][n.id]}</span></button>`).join('')}</div>
    <div class="bargain-dialogue ${status}" role="status" aria-live="polite"><span class="bargain-face" aria-hidden="true">${{idle:'☺',thinking:'◔',rejected:'ಠ',accepted:'♥'}[status]}</span><div><strong>${p.name}${busy?' · · ·':''}</strong><p>${message}</p></div>${done?'<span class="deal-stamp">CHỐT!</span>':''}</div>
    ${done?`<div class="deal-receipt"><strong>${tr('Deal sealed. Your items have changed hands.','Chốt đơn! Tiền và tài sản đã đổi chủ.')}</strong><p>${tr('A good neighbor is good for business.','Buôn có bạn, bán có phường.')}</p><button class="primary" data-bargain="again">${tr('Another deal','Bàn tiếp nào')}</button><button class="secondary" data-action="close">${tr('Back to town','Về phố')}</button></div>`:`<fieldset class="barter-table" ${busy?'disabled':''}><legend class="sr-only">${tr('Your two-sided trade offer','Đề nghị trao đổi hai bên')}</legend>${inventory(0,'give')}<div class="barter-divider" aria-hidden="true">⇄</div>${inventory(p.id,'take')}</fieldset>
    <div class="barter-bottom"><span>${tr('Tap an item to add it. Tap the tray to remove it.','Chạm đồ để thêm. Chạm đồ trên bàn để bớt.')}</span>${status==='rejected'&&shortfall>0&&draft.give.cash+shortfall<=s.players[0].cash?`<button class="secondary" data-bargain="counter">${tr('Add','Thêm')} ${shortfall} đ</button>`:''}<button class="primary bargain-submit" data-bargain="propose" ${busy||(!hasItems(draft.give)&&!hasItems(draft.take))?'disabled':''}>${busy?tr('Thinking it over…','Để nghĩ chút nha…'):tr('How about this?','Vậy nha, chốt không?')}</button></div>`}`;
  }
  function render(){const b=$('#modal .modal-body');if(b){b.innerHTML=body();$('#modal').classList.add('trade-dialog');}}
  function open(partner=1,prefillLot=null,prefillShop=null){cancel();modal(tr('Let’s make a deal.','Có qua có lại.'),'',tr('THE BARGAINING TABLE','BÀN THƯƠNG LƯỢNG'));draft=makeDraft(getState(),partner,prefillLot,prefillShop);status='idle';intro();render();onTrading(true);playSound('deal-open');}
  function cancel(){clearTimeout(timer);timer=null;onTrading(false);draft=null;$('#modal')?.classList.remove('trade-dialog');}
  function handle(el){if(!draft)return;const action=el.dataset.bargain;if(status==='thinking')return;
    if(action==='person'){draft=makeDraft(getState(),Number(el.dataset.player));status='idle';intro();}
    else if(action==='again'){draft=makeDraft(getState(),draft.partner);status='idle';intro();}
    else if(action==='propose'){
      status='thinking';message=tr('Hmm… let me count that up.','Hừm… để tính chút coi nào.');speak('thinking',draft.partner);render();
      timer=setTimeout(()=>{if(!draft||!$('#modal').open)return;try{const result=trade(getState(),draft);shortfall=result.shortfall||0;if(result.accepted){status='accepted';message=tr('You’ve got a deal! A coffee on me next time.','Rồi, chốt! Bữa sau ghé uống cà phê nha!');onChanged();playSound('deal');speak('positive',draft.partner);}else{status='rejected';message=tr(`Close! Add ${shortfall} đ, or show me a different package.`,`Suýt được rồi! Thêm ${shortfall} đ đi, hoặc đổi món khác thử nha.`);playSound('reject');speak('negative',draft.partner);}}catch(error){status='rejected';message=error.message;speak('negative',draft.partner);}render();},650);return;
    }else if(action==='counter'){adjustDraft(getState(),draft,'give','cash',0,shortfall);status='idle';message=tr('That looks better. Ready to shake on it?','Nghe hợp lý hơn rồi đó. Chốt luôn không?');}
    else if(action==='cash')adjustDraft(getState(),draft,el.dataset.side,'cash',0,Number(el.dataset.delta));
    else if(action==='asset'||action==='remove')adjustDraft(getState(),draft,el.dataset.side,el.dataset.kind,Number(el.dataset.index),action==='remove'?-1:1);
    if(['cash','asset','remove'].includes(action)&&status==='rejected'){status='idle';shortfall=0;intro();}
    playSound('tap');const key=['bargain','side','kind','index','player','delta'].map(k=>el.dataset[k]!==undefined?`[data-${k}="${el.dataset[k]}"]`:'').join('');render();if(key)$('#modal')?.querySelector(key)?.focus({preventScroll:true});
  }
  function cashChanged(el,normalize=true){
    if(!draft||status==='thinking')return;
    const side=el.dataset.bargainCash,p=getState().players[side==='give'?0:draft.partner];
    draft[side].cash=Math.max(0,Math.min(p.cash,Math.floor(Number(el.value)||0)));
    if(normalize)el.value=draft[side].cash;
    // Keep the input and pending click target mounted when a cash field loses focus.
    const tray=el.closest('.barter-side').querySelector('.offer-tray');
    tray.querySelector('.cash-chip')?.remove();
    if(draft[side].cash){const chip=document.createElement('span');chip.className='offer-chip cash-chip';chip.textContent=draft[side].cash+' đ';tray.prepend(chip);}
    if(hasItems(draft[side]))tray.querySelector('.empty-tray')?.remove();
    else tray.innerHTML=`<span class="empty-tray">${tr('Tap items below to offer them','Chạm đồ bên dưới để đặt lên bàn')}</span>`;
    if(status==='rejected'){
      status='idle';shortfall=0;intro();
      const bubble=$('.bargain-dialogue');bubble.className='bargain-dialogue idle';
      bubble.querySelector('p').textContent=message;bubble.querySelector('.bargain-face').textContent='☺';
      $('[data-bargain="counter"]')?.remove();
    }
    $('.bargain-submit').disabled=!hasItems(draft.give)&&!hasItems(draft.take);
  }
  function dismiss(){if(draft&&status!=='accepted'&&(status==='rejected'||hasItems(draft.give)||hasItems(draft.take)))speak('negative',draft.partner);cancel();}
  return {open,cancel,dismiss,handle,cashChanged,isOpen:()=>draft!==null};
}
