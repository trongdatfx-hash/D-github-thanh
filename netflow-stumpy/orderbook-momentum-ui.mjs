import {OrderBookMomentum,BinanceAggTradeFeed,MOMENTUM_LABELS} from './orderbook-momentum.mjs?v=20261125-ob-persist1';

const pct=x=>`${x>0?'+':''}${(x*100).toFixed(0)}%`;
export function mountMomentumReadout({chart,host,symbolControl,horizon=300}){
  const model=new OrderBookMomentum({horizon});let enabled=false,timer=null;
  const node=document.createElement('div');node.id='orderbook-momentum-readout';node.hidden=true;node.setAttribute('aria-label','Động lực orderbook Binance Futures');
  const headline=document.createElement('strong'),detail=document.createElement('span');node.append(headline,detail);host.append(node);
  const style=document.createElement('style');style.textContent=`
    #orderbook-momentum-readout{position:absolute;z-index:8;right:58px;max-width:calc(100% - 70px);width:370px;box-sizing:border-box;padding:5px 8px;border:1px solid #56718f;border-radius:5px;background:transparent;text-shadow:0 1px 2px #06101f,0 0 3px #06101f;color:#d2dfef;font:13px/1.4 system-ui;pointer-events:auto;overflow-wrap:normal;font-variant-numeric:tabular-nums}
    #orderbook-momentum-readout[hidden]{display:none}
    #orderbook-momentum-readout strong,#orderbook-momentum-readout>span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:1.4em;line-height:1.4}
    #orderbook-momentum-readout strong{font-size:14px}
    #orderbook-momentum-readout>span{height:1.4em;white-space:nowrap}
    #orderbook-momentum-readout[data-state=buy]{border-color:#269c77;color:#67f1bc}
    #orderbook-momentum-readout[data-state=sell]{border-color:#c14d6b;color:#ff97ae}
    #orderbook-momentum-readout[data-state=buyAbsorbed],#orderbook-momentum-readout[data-state=sellAbsorbed]{border-color:#c8a852;color:#ffe092}
    #orderbook-momentum-readout[data-quality=offline],#orderbook-momentum-readout[data-quality=snapshot]{color:#f0bf83;border-color:#9b713e}
    @media(max-width:650px){#orderbook-momentum-readout{right:52px;max-width:calc(100% - 58px);padding:5px 7px;font-size:12px}#orderbook-momentum-readout strong{font-size:13px}}
  `;host.append(style);
  function render(){
    node.hidden=!enabled;if(!enabled)return;
    const r=model.read();node.dataset.state=r.state;node.dataset.quality=r.quality;node.dataset.symbol=model.symbol;
    const span=seconds=>seconds>=60?`${seconds/60}p`:`${seconds}s`;
    const title=`OB ${span(model.horizon)} · ${r.label}`;
    if(headline.textContent!==title)headline.textContent=title;
    const total=r.summary;
    const roundPct=x=>pct(Math.round(x*20)/20);
    const money=x=>`${x>0?'+':''}${Math.abs(x)>=1e6?(x/1e6).toFixed(1)+'M':Math.abs(x)>=1000?(x/1000).toFixed(1)+'K':x.toFixed(0)}`;
    const line=total?`${total.seconds<model.horizon?span(total.seconds)+'~ ':''}Δ${money(total.delta)}$ · L${roundPct(total.flow)} · B${roundPct(total.obi)}${total.large?' !':''}`:'';
    detail.textContent=r.quality==='live'?line:({warming:'Đang tích lũy · chờ đủ cửa sổ',snapshot:'Snapshot · chờ luồng giao dịch',offline:'Chờ đồng bộ dữ liệu',quiet:'Không có khớp mới trong 60s'}[r.quality]??r.reason);
    node.title=[detail.textContent, 'L: lệch khớp · B: Book · $: USDT · ~: cửa sổ tạm · !: lệch lớn.',`${model.symbol} · Binance USD-M · chỉ đọc thời điểm hiện tại, độc lập dữ liệu nến M15.`,
      'Book: lệch thanh khoản chờ, có trọng số theo 20 mức gần giá. % cửa sổ: (mua chủ động − bán chủ động) / tổng khớp, tính theo USDT; không phải xác suất thắng.',
      'Chọn 3/5/10 phút, mặc định 5 phút; khi chưa đủ dùng cửa sổ nhỏ hơn và ghi TẠM. Lệch khớp ≥30%; giá ≥2/3/4 spread tương ứng 3/5/10 phút; cửa sổ ngắn ≥1,5 spread. Số khớp tối thiểu 20/30/50 tương ứng 3/5/10 phút. Xác nhận 8s, đảo trạng thái 15s và giữ tối thiểu 20s trước khi đảo; về chưa rõ cần 20s. Lệch lớn có thể xác nhận sau 5s, không bỏ qua điều kiện giá. Tổng kết cập nhật mỗi 5s; tỷ lệ làm mượt với nửa đời 15s, làm tròn 5 điểm %. Lệch lớn: ≥20 khớp, lệch ≥45%, |delta| ≥50% độ sâu đối ứng và Book/OFI cùng hướng. Hấp thụ là giả thuyết, chưa phải tín hiệu vào lệnh.',
      `Lọc lực duy trì: ${r.persistence?.applied?(r.persistence.passed?'ĐẠT':'CHƯA ĐẠT')+' · '+r.persistence.aligned+'/3 phút cùng chiều · '+({history:'chưa đủ lịch sử', 'recent-quiet':'phút mới nhất ít khớp', 'recent-opposed':'lệch phút mới nhất chưa cùng hướng ≥10%', 'not-sustained':'lực chưa duy trì', confirmed:'đã xác nhận'}[r.persistence.reason]??'chưa rõ'):'chưa áp dụng: dữ liệu chưa đủ hoặc không phải nhãn đẩy giá cửa sổ dài'}. Với nhãn đẩy giá 3/5/10 phút: phút gần nhất cần >=10 bản tin khớp, lệch cùng hướng >=10%; ít nhất 2/3 phút rời nhau có delta cùng hướng và >=5 bản tin/phút. Lệch lớn không bỏ qua bộ lọc này.`,
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
  return {model,tape,node,start,stop,setHorizon:seconds=>{model.setHorizon(seconds);render();},onBook:book=>{if(enabled)model.onBook(book);},render};
}
