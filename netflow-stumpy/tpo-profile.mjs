import {isUsMarketTradingDay} from './market-calendar.mjs';
const minute=60000;
const sessionCache=new Map();
const clock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export const TPO_CONTROL_IDS=['tpo-toggle','tpo-session','tpo-row-size','tpo-source'];
export function tpoSession(t){
  const stamp=Math.floor(t/minute);if(sessionCache.has(stamp))return sessionCache.get(stamp);
  const p=Object.fromEntries(clock.formatToParts(t).map(x=>[x.type,x.value]));
  const day=`${p.year}-${p.month}-${p.day}`,m=+p.hour*60+ +p.minute;
  if(!isUsMarketTradingDay(day)){sessionCache.set(stamp,null);return null;}
  const session=m>=240&&m<570?'PRE':m>=570&&m<960?'RTH':null;
  if(!session){sessionCache.set(stamp,null);return null;}
  const first=session==='PRE'?240:570,last=session==='PRE'?570:960;
  const start=Math.floor(t/minute)*minute-(m-first)*minute;
  const result={day,session,start,end:start+(last-first)*minute,key:day+':'+session};
  if(sessionCache.size>12000)sessionCache.clear();sessionCache.set(stamp,result);return result;
}
export function tpoWindows(bars,{session='BOTH',limit=3}={}){
  const groups=new Map();
  for(const bar of bars){const s=tpoSession(bar.t);if(!s||(session!=='BOTH'&&s.session!==session))continue;
    if(!groups.has(s.key))groups.set(s.key,{...s,bars:[]});groups.get(s.key).bars.push(bar);
  }
  return [...groups.values()].sort((a,b)=>a.start-b.start).slice(-limit);
}
export function tpoValueArea(rows,ratio=.7){
  if(!rows.length)return null;
  // Stable tie rule: closest to profile midpoint, then lower row.
  const middle=(rows[0].index+rows.at(-1).index)/2;
  let poc=0;for(let i=1;i<rows.length;i++)if(rows[i].blocks.length>rows[poc].blocks.length||
    (rows[i].blocks.length===rows[poc].blocks.length&&Math.abs(rows[i].index-middle)<Math.abs(rows[poc].index-middle)))poc=i;
  let low=poc,high=poc,covered=rows[poc].blocks.length;
  const total=rows.reduce((s,r)=>s+r.blocks.length,0),target=total*ratio;
  while(covered<target&&(low>0||high<rows.length-1)){
    const down=low>0?rows[low-1].blocks.length:-1,up=high<rows.length-1?rows[high+1].blocks.length:-1;
    if(up>down){high++;covered+=up;}else{low--;covered+=down;}
  }
  return {pocIndex:rows[poc].index,val:rows[low].low,vah:rows[high].high,total,covered};
}
export function selectTpoBars(window,minutes,now){
  const fine=new Map(minutes.filter(b=>b.t>=window.start&&b.t<window.end&&b.t<now).map(b=>[b.t,b]));
  const bars=[],used=[];let fallback=0;
  for(const coarse of window.bars){
    if(coarse.t>=now)continue;
    const end=Math.min(coarse.t+900000,window.end,Math.ceil(now/minute)*minute),children=[];
    // Only use M1 if the whole observed part of this M15 is covered. Never mix
    // the same coarse candle and its children, or infer missing minutes.
    for(let t=coarse.t;t<end;t+=minute){const b=fine.get(t);if(!b)break;children.push(b);}
    const expected=(end-coarse.t)/minute;
    if(expected>0&&children.length===expected){bars.push(...children);used.push(...children);}
    else{bars.push(coarse);fallback++;}
  }
  return {bars,source:fallback?(used.length?'M1/M15':'M15'):'M1',fallback};
}
export function buildTpo(window,{minutes=[],now=Date.now(),rowSize=.5,source='AUTO'}={}){
  if(!(rowSize>=.01&&rowSize<=100))throw Error('Bước giá TPO không hợp lệ');
  const selected=source==='M15'?{bars:window.bars.filter(b=>b.t<now),source:'M15',fallback:window.bars.length}:selectTpoBars(window,minutes,now);
  const bins=new Map();let ibLow=Infinity,ibHigh=-Infinity,work=0;
  for(const b of selected.bars){
    if(![b.t,b.l,b.h].every(Number.isFinite)||b.l<=0||b.h<b.l||b.t>=now)continue;
    const block=Math.floor((b.t-window.start)/1800000);if(block<0||b.t>=window.end)continue;
    if(b.t<window.start+3600000){ibLow=Math.min(ibLow,b.l);ibHigh=Math.max(ibHigh,b.h);}
    const first=Math.floor((b.l+rowSize*1e-9)/rowSize),last=Math.floor((b.h+rowSize*1e-9)/rowSize);
    if(last-first>5000||(work+=last-first+1)>500000)throw Error('TPO quá dày; tăng bước giá');
    for(let i=first;i<=last;i++){if(!bins.has(i))bins.set(i,new Set());bins.get(i).add(block);}
  }
  // Keep zero-count gaps so Value Area always expands through adjacent rows.
  const indexes=[...bins.keys()].sort((a,b)=>a-b),rows=[];
  if(indexes.length&&indexes.at(-1)-indexes[0]>5000)throw Error('TPO quá nhiều hàng; tăng bước giá');
  if(indexes.length)for(let i=indexes[0];i<=indexes.at(-1);i++)rows.push({index:i,low:i*rowSize,high:(i+1)*rowSize,blocks:[...(bins.get(i)??[])].sort((a,b)=>a-b)});
  const va=tpoValueArea(rows);
  const observed=new Set(window.bars.filter(b=>b.t<now).map(b=>b.t));
  const observedEnd=Math.min(window.end,Math.ceil(now/900000)*900000);
  const expected=Math.max(0,Math.ceil((observedEnd-window.start)/900000));
  const ibComplete=now>=window.start+3600000&&Array.from({length:4},(_,i)=>window.start+i*900000).every(t=>observed.has(t));
  return {...window,rows,va,rowSize,source:selected.source,approximate:selected.fallback>0,
    missing:Math.max(0,expected-observed.size),forming:now<window.end,
    ib:Number.isFinite(ibLow)?{low:ibLow,high:ibHigh,complete:ibComplete}:null};
}
export function parseTpoMinutes(raw,now){
  if(!Array.isArray(raw))throw Error('M1 không hợp lệ');
  const map=new Map();
  for(const r of raw){const [t,o,h,l,c,v,end]=r.map(Number);
    if(![t,o,h,l,c,v,end].every(Number.isFinite)||t%minute||end!==t+minute-1||l<=0||h<Math.max(o,c)||l>Math.min(o,c)||v<0)throw Error('Nến M1 không hợp lệ');
    if(t<now)map.set(t,{t,o,h,l,c,v,end});
  }return [...map.values()].sort((a,b)=>a.t-b.t);
}
