import {OrderBookMomentum,BinanceAggTradeFeed,MOMENTUM_LABELS} from './orderbook-momentum.mjs?v=20261124-ob-flow1';

const short={buy:'Mua',sell:'Bán',buyAbsorbed:'Mua bị hấp thụ',sellAbsorbed:'Bán bị hấp thụ',mixed:'Chưa rõ',quiet:'Ít khớp',warming:'Chờ'};
const pct=x=>`${x>0?'+':''}${(x*100).toFixed(0)}%`;
export function mountMomentumReadout({chart,host,symbolControl}){
  const model=new OrderBookMomentum();let enabled=false,timer=null;
  const node=document.createElement('div');node.id='orderbook-momentum-readout';node.hidden=true;node.setAttribute('aria-label','Động lực orderbook Binance Futures');
  const headline=document.createElement('strong'),detail=document.createElement('span');node.append(headline,detail);host.append(node);
  const style=document.createElement('style');style.textContent=`
    #orderbook-momentum-readout{position:absolute;z-index:8;right:58px;max-width:calc(100% - 70px);width:max-content;box-sizing:border-box;padding:5px 8px;border:1px solid #56718f;border-radius:5px;background:#0b1729ed;color:#d2dfef;font:11px/1.4 system-ui;pointer-events:auto;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}
    #orderbook-momentum-readout[hidden]{display:none}
    #orderbook-momentum-readout strong,#orderbook-momentum-readout>span{display:block;white-space:normal}
    #orderbook-momentum-readout strong{font-size:12px}
    #orderbook-momentum-readout[data-state=buy]{border-color:#269c77;color:#67f1bc}
    #orderbook-momentum-readout[data-state=sell]{border-color:#c14d6b;color:#ff97ae}
    #orderbook-momentum-readout[data-state=buyAbsorbed],#orderbook-momentum-readout[data-state=sellAbsorbed]{border-color:#c8a852;color:#ffe092}
    #orderbook-momentum-readout[data-quality=offline],#orderbook-momentum-readout[data-quality=snapshot]{color:#f0bf83;border-color:#9b713e}
    @media(max-width:650px){#orderbook-momentum-readout{right:52px;max-width:calc(100% - 58px);padding:4px 6px;font-size:10px}#orderbook-momentum-readout strong{font-size:11px}}
  `;host.append(style);
  function render(){
    node.hidden=!enabled;if(!enabled)return;
    const r=model.read();node.dataset.state=r.state;node.dataset.quality=r.quality;node.dataset.symbol=model.symbol;
    const book=r.book?` · Book ${pct(r.book.obi)}`:'';
    const title=`OB ${model.symbol} · ${r.label}${r.pending?' · xác nhận lại':''}${book}`;
    if(headline.textContent!==title)headline.textContent=title;
    const line=r.windows.map(w=>`${w.seconds}s ${w.ready?(short[w.state]??w.state)+' '+pct(w.flow):'chờ'}`).join(' · ');
    detail.textContent=r.quality==='live'?line:r.reason;
    node.title=[`${model.symbol} · Binance USD-M · chỉ đọc thời điểm hiện tại, độc lập dữ liệu nến M15.`,
      'Book: lệch thanh khoản chờ, có trọng số theo 20 mức gần giá. % cửa sổ: (mua chủ động − bán chủ động) / tổng khớp, tính theo USDT; không phải xác suất thắng.',
      'Trạng thái cần giữ ít nhất 2,5 giây và 4 lần kiểm tra; hấp thụ là dấu hiệu giả thuyết, chưa phải tín hiệu vào lệnh.',
      ...r.windows.map(w=>`${w.seconds}s: ${w.ready?MOMENTUM_LABELS[w.state]:'chưa đủ mẫu'}; khớp ${w.count}; Δ ${w.delta.toFixed(2)} USDT; OFI ${pct(w.ofi)}; micro ${w.microBps.toFixed(3)} bps; giá ${Number.isFinite(w.moveSpreads)?w.moveSpreads.toFixed(2):'—'} spread.`)].join('\n');
    host.dataset.orderbookMomentum=r.state;host.dataset.orderbookMomentumQuality=r.quality;
    position();
  }
  function position(){
    if(!enabled)return;
    const paneHeight=chart?.panes?.()[0]?.getHeight?.();if(!Number.isFinite(paneHeight))return;
    const row=host.querySelector('#h1-cvd-status-row'),hostRect=host.getBoundingClientRect();
    const rowTop=row&&!row.hidden&&row.getClientRects().length?row.getBoundingClientRect().top-hostRect.top:null;
    node.style.top=`${Math.max(5,(rowTop??(paneHeight-6))-node.offsetHeight-5)}px`;
  }
  const tape=new BinanceAggTradeFeed({onTrade:e=>model.onTrade(e),onState:connected=>{model.setTapeState(connected);render();}});
  function stop(){enabled=false;clearInterval(timer);timer=null;tape.stop();model.reset(symbolControl.value);node.hidden=true;delete host.dataset.orderbookMomentum;delete host.dataset.orderbookMomentumQuality;}
  function start(symbol){stop();model.reset(symbol);enabled=true;tape.start(symbol);timer=setInterval(render,500);render();}
  return {model,tape,node,start,stop,onBook:book=>{if(enabled)model.onBook(book);},render};
}
