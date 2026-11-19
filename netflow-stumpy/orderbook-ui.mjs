import {BinanceDepthFeed,autoBookStep,groupBook} from './orderbook-core.mjs?v=20261119-book1';
import {SpectrumPrimitive} from './spectrum-primitive.mjs?v=20261104-oi-smooth1';

export function mountOrderBook({chart,price,host,actions,symbolControl}){
  const key='dvp:orderbook:v1';let options={enabled:true,step:0,width:.18,values:true};
  try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&typeof saved==='object')options={...options,...saved};}catch{}
  options.enabled=options.enabled!==false;options.step=[0,.01,.05,.1,.25,.5,1,2,5].includes(options.step)?options.step:0;options.width=[.1,.18,.25].includes(options.width)?options.width:.18;
  let book=null,state='connecting',drawing=0;
  const button=document.createElement('button');button.id='orderbook-toggle';button.type='button';button.title='Lệnh chờ Binance Futures: Bid xanh / Ask đỏ cam';
  const settings=document.createElement('details');settings.id='orderbook-settings';
  settings.innerHTML='<summary aria-label="Cài đặt Order Book">OB ⚙</summary><div class="orderbook-panel"><label>Bước giá <select id="orderbook-step"><option value="0">Tự động</option><option>0.01</option><option>0.05</option><option>0.1</option><option>0.25</option><option>0.5</option><option>1</option><option>2</option><option>5</option></select></label><label>Độ rộng <select id="orderbook-width"><option value="0.1">10%</option><option value="0.18">18%</option><option value="0.25">25%</option></select></label><label><input id="orderbook-values" type="checkbox">Khối lượng</label><small>Bid: mua chờ · Ask: bán chờ. Đơn vị khối lượng gốc. Chỉ sổ lệnh hiện tại, tối đa 1.000 mức mỗi phía khi đồng bộ.</small></div>';
  const style=document.createElement('style');style.textContent='#orderbook-toggle{font-variant-numeric:tabular-nums}#orderbook-toggle[data-state=live]{color:#49e3b7}#orderbook-toggle[data-state=offline]{color:#ffb46b}#orderbook-settings{flex:0 0 auto;margin:0;padding:0;border:0;background:transparent}#orderbook-settings>summary{cursor:pointer;padding:5px 7px;font:600 12px system-ui;color:#cedbea;white-space:nowrap}#orderbook-settings .orderbook-panel{position:absolute;right:8px;top:100%;z-index:65;width:min(300px,calc(100vw - 24px));padding:12px;border:1px solid #48617b;border-radius:6px;background:#101c2d;color:#dce8f6;box-shadow:0 8px 22px #0008;display:grid;gap:12px;font:14px/1.45 system-ui;pointer-events:auto}#orderbook-settings:not([open]) .orderbook-panel{display:none}#orderbook-settings label{display:flex;align-items:center;justify-content:space-between;gap:10px}#orderbook-settings select{font:inherit;padding:4px 7px}#orderbook-settings small{font-size:12px;color:#aebfd3}.chart-head:has(#orderbook-settings[open]){z-index:70!important}';
  host.append(style);const anchor=actions.querySelector('#fullscreen');if(anchor)anchor.after(button,settings);else actions.append(button,settings);
  const stepInput=settings.querySelector('#orderbook-step'),widthInput=settings.querySelector('#orderbook-width'),valueInput=settings.querySelector('#orderbook-values');
  stepInput.value=String(options.step);widthInput.value=String(options.width);valueInput.checked=options.values;
  const persist=()=>{try{localStorage.setItem(key,JSON.stringify(options));}catch{}};
  const displayState=()=>{
    button.setAttribute('aria-pressed',String(options.enabled));button.dataset.state=options.enabled?state:'off';
    button.textContent=!options.enabled?'Order Book: TẮT':state==='live'?`Order Book: LIVE · ${book?.transport??''}`:state==='offline'?'Order Book: MẤT KẾT NỐI':'Order Book: ĐANG NẠP';
    host.dataset.orderbookState=options.enabled?state:'off';host.dataset.orderbookSymbol=symbolControl.value;
  };
  const number=value=>value>=1e6?`${(value/1e6).toFixed(2)}M`:value>=1000?`${(value/1000).toFixed(1)}K`:value>=10?value.toFixed(0):value.toFixed(2);
  const primitive=new SpectrumPrimitive(({context,mediaSize:{width,height}})=>{
    host.dataset.orderbookRows='0';
    if(!options.enabled||state!=='live'||!book||width<100||height<40)return;
    const a=price.coordinateToPrice(0),b=price.coordinateToPrice(height);if(!Number.isFinite(a)||!Number.isFinite(b))return;
    const low=Math.min(a,b),high=Math.max(a,b),step=options.step||autoBookStep(high-low,height);
    const rows=groupBook(book,step,{min:low,max:high});if(!rows.length)return;
    const right=width-2,maxWidth=Math.min(width<650?90:220,width*options.width),maximum=Math.max(...rows.map(row=>row.quantity));
    context.save();context.beginPath();context.rect(Math.max(0,right-maxWidth-3),0,maxWidth+3,height);context.clip();
    const pixels=Math.abs((price.priceToCoordinate(low+step)??0)-(price.priceToCoordinate(low)??0));
    const rowHeight=Math.max(1,Math.min(18,pixels*.88));
    const biggest=new Set([...rows.filter(r=>r.side==='bid').sort((x,y)=>y.quantity-x.quantity).slice(0,3),...rows.filter(r=>r.side==='ask').sort((x,y)=>y.quantity-x.quantity).slice(0,3)]);
    const occupied=[],sidesByPrice=new Map();for(const row of rows)sidesByPrice.set(row.price,(sidesByPrice.get(row.price)??0)+1);let count=0;
    for(const row of rows){
      const y=price.priceToCoordinate(row.price);if(!Number.isFinite(y)||y<0||y>height)continue;
      const ratio=row.quantity/maximum,w=Math.max(1,ratio*maxWidth),bid=row.side==='bid';
      // Half rows avoid hiding one side if the spread falls inside one price bin.
      const mixed=sidesByPrice.get(row.price)>1;
      const h=mixed?rowHeight/2:rowHeight,top=y-rowHeight/2+(mixed&&!bid?h:0);
      context.fillStyle=bid?`rgba(8,218,157,${.38+.48*ratio})`:`rgba(255,111,66,${.38+.48*ratio})`;
      context.fillRect(right-w,top,w,Math.max(1,h));count++;
      if(options.values&&biggest.has(row)&&w>28&&!occupied.some(p=>Math.abs(p-y)<14)){
        context.font='600 11px system-ui';context.textAlign='right';context.textBaseline='middle';
        context.lineWidth=3;context.strokeStyle='#0b1525';const text=number(row.quantity);context.strokeText(text,right-3,y);context.fillStyle=bid?'#a4ffe0':'#ffe0cc';context.fillText(text,right-3,y);occupied.push(y);
      }
    }
    context.restore();host.dataset.orderbookRows=String(count);host.dataset.orderbookStep=String(step);
  });
  price.attachPrimitive(primitive);
  const redraw=()=>{if(!drawing)drawing=requestAnimationFrame(()=>{drawing=0;primitive.redraw();});};
  const feed=new BinanceDepthFeed({onState:(next,error)=>{state=next;button.title=error?`Order Book Binance: ${error}`:'Lệnh chờ Binance Futures: Bid xanh / Ask đỏ cam';displayState();redraw();},onBook:next=>{book=next;host.dataset.orderbookUpdatedAt=next?String(Date.now()):'';host.dataset.orderbookTransport=next?.transport??'';displayState();redraw();}});
  const restart=()=>{book=null;if(options.enabled&&!document.hidden)feed.start(symbolControl.value);else{feed.stop();state=document.hidden?'offline':'connecting';displayState();redraw();}};
  button.addEventListener('click',()=>{options.enabled=!options.enabled;persist();restart();});
  for(const input of [stepInput,widthInput,valueInput])input.addEventListener('change',()=>{options.step=Number(stepInput.value);options.width=Number(widthInput.value);options.values=valueInput.checked;persist();redraw();});
  settings.addEventListener('keydown',event=>{if(event.key==='Escape'){event.stopPropagation();settings.open=false;}});
  document.addEventListener('pointerdown',event=>{if(!settings.contains(event.target))settings.open=false;});
  symbolControl.addEventListener('change',restart);document.addEventListener('visibilitychange',restart);
  window.addEventListener('pagehide',()=>feed.stop());window.addEventListener('pageshow',event=>{if(event.persisted)restart();});
  restart();return {feed,primitive};
}
