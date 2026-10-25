import {reasonText} from './wlr-aba-status.mjs?v=20261025-dcommon-all1';
const probability=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const pct=x=>probability(x)?Math.round(x*100)+'%':'—';
export function assessTradeStrategy({aba=null,trend=null,symbol='SPYUSDT',interval='15m',live=false}={}){
 const out={status:'WAIT',label:'CHỜ DỮ LIỆU',tone:'wait',reason:'Chỉ hỗ trợ SPY M15 còn mới',abaUp:null,abaDown:null,membership:null,continuation:null,horizon:3,trendDirection:0,scenario:null};
 if(symbol!=='SPYUSDT'||interval!=='15m')return out;
 if(!live){out.reason='Chờ chart LIVE và phiên có dữ liệu mới';return out;}
 const ageReady=trend?.active===true&&trend.reliable===true&&trend.horizonSupported!==false&&[-1,1].includes(trend.direction)&&probability(trend.continuation);
 if(ageReady){out.continuation=trend.continuation;out.horizon=trend.horizon??3;out.trendDirection=trend.direction;}
 const t=aba?.track,d=t?.direction;
 const ready=aba?.enabled&&aba.live&&aba.verified&&aba.synced&&aba.version===3&&aba.preview?.emit===true&&t?.prediction?.ready&&d?.ready&&probability(d.pAbove)&&probability(d.pBelow)&&d.pAbove+d.pBelow<=1.0000001;
 if(!ready){out.reason=!aba?.enabled?'Bật A–B–A V3 để theo dõi':!aba.synced?'Chờ đồng bộ A–B–A với nến đóng':reasonText(aba.preview?.reason??'WAIT_FORECAST');return out;}
 out.abaUp=d.pAbove;out.abaDown=d.pBelow;
 if(t.prediction.memberReady&&probability(t.prediction.pMembership))out.membership=t.prediction.pMembership;
 out.status=aba.usage?.emit===true?'THAM KHẢO':'NGHIÊN CỨU · WAIT';
 out.reason=aba.usage?.emit===true?'Kịch bản theo quy tắc; không phải tỷ lệ thắng':'Chưa phát tín hiệu vào lệnh · '+reasonText(aba.usage?.reason??'FORWARD_NOT_VALIDATED');
 if(!ageReady){out.label='CHỜ XÁC SUẤT TUỔI TREND';return out;}
 if(probability(out.membership)&&out.membership<.5){out.scenario='observe';out.label='CHỜ MẪU A–B–A RÕ HƠN';return out;}
 const direction=d.pAbove>=.60?1:d.pBelow>=.60?-1:0;
 if(direction&&direction===trend.direction&&trend.continuation>=.60){out.scenario='pullback';out.label=direction>0?'CHỜ HỒI THEO TREND TĂNG':'CHỜ HỒI THEO TREND GIẢM';out.tone=direction>0?'up':'down';}
 else if(direction&&direction!==trend.direction){out.scenario='conflict';out.label='TRÁNH ĐUỔI · CHỜ XÁC NHẬN';}
 else if(trend.continuation<.45){out.scenario='weak';out.label='TREND YẾU · CHỜ XÁC NHẬN';}
 else{out.scenario='observe';out.label='QUAN SÁT · CHƯA ĐỒNG THUẬN';}
 return out;
}
export function strategyProbabilityText(s){
 return {aba:'A kế tiếp ↑ '+pct(s.abaUp)+' · ↓ '+pct(s.abaDown)+' | Thuộc ABA '+pct(s.membership),trend:'Trend '+(s.trendDirection>0?'↑':s.trendDirection<0?'↓':'—')+' sống thêm '+s.horizon+' nến: '+pct(s.continuation)};
}
export function createStrategyBadge(){
 const style=document.createElement('style');style.textContent=`
 #trade-strategy-badge{position:fixed;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:10000;pointer-events:none;box-sizing:border-box;margin:0;text-align:left;width:340px;max-width:calc(100vw - 16px);padding:9px 12px;background:rgba(10,20,35,.96);border:1px solid #688096;border-radius:10px;box-shadow:0 4px 18px #0006;color:#e4edf7;font:12px/1.45 system-ui,sans-serif}
 #trade-strategy-badge summary{pointer-events:auto;cursor:pointer;font-size:10px;letter-spacing:.3px;color:#b8c9db}
 #trade-strategy-badge strong{display:block;font-size:14px;margin:5px 0;color:#f6c85f}
 #trade-strategy-badge[data-tone=up] strong{color:#1ae0a3}#trade-strategy-badge[data-tone=down] strong{color:#ff7791}
 #trade-strategy-badge p{margin:3px 0;white-space:normal}#trade-strategy-badge small{display:block;color:#b1bfd0;font-size:10px;margin-top:5px}
 @media(max-width:600px){#trade-strategy-badge{width:285px;padding:7px 9px;font-size:11px}#trade-strategy-badge strong{font-size:12px}}
 `;document.head.append(style);
 const node=document.createElement('details');node.id='trade-strategy-badge';node.open=true;node.setAttribute('aria-label','Kịch bản giao dịch tham khảo từ ABA V3 và tuổi trend');
 const summary=document.createElement('summary'),label=document.createElement('strong'),a=document.createElement('p'),t=document.createElement('p'),reason=document.createElement('small');
 label.setAttribute('role','status');label.setAttribute('aria-live','polite');node.append(summary,label,a,t,reason);document.body.append(node);
 let last='';
 function update(input){const s=assessTradeStrategy(input),key=JSON.stringify(s);if(key===last)return;last=key;const text=strategyProbabilityText(s);node.dataset.status=s.status;node.dataset.tone=s.tone;summary.textContent='CHIẾN LƯỢC THAM KHẢO · '+s.status;label.textContent=s.label;a.textContent=text.aba;t.textContent=text.trend;reason.textContent=s.reason;node.title='Quy tắc thăm dò: hướng ABA ≥60% và khả năng trend sống thêm ≥60%, cùng hướng thì chờ hồi. Hướng ABA so trung vị A kế tiếp với WLR mốc, có điều kiện mẫu hoàn tất; thuộc mẫu là xác suất khác. Mẫu dưới 50% thì chờ. Tuổi trend là sống thêm số nến ghi trên nhãn. Không cộng hoặc nhân thành tỷ lệ thắng.';}
 document.addEventListener('fullscreenchange',()=>{(document.fullscreenElement??document.body).append(node);});
 update();return {update,node};
}
