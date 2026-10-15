export const IMPACT_RETENTION_MS=48*60*60*1000;
export const IMPACT_CONFIRM_MS=350;

const finite=Number.isFinite;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function geometryBarIndexAt(time,bars,closedIndex=null){
  if(!finite(time)||!Array.isArray(bars))return null;let index=-1;
  for(let i=bars.length-1;i>=0;i--)if(finite(bars[i]?.t)&&bars[i].t<=time){index=i;break;}
  if(index>=0&&time<=(bars[index].end??bars[index].t))return index;
  if(index===bars.length-1)return index+1;
  return finite(closedIndex)?closedIndex+1:null;
}

export function geometryZoneAt(price,time,lines,{barIndex,atr,toleranceAtr=.28,minScore=64}={}){
  if(!finite(price)||!finite(time)||!Array.isArray(lines)||!finite(barIndex)||!finite(atr)||atr<=0)return null;
  let best=null;
  for(const line of lines){
    if(!line||!['support','resistance'].includes(line.kind)||!finite(line.slope)||!finite(line.startValue)||!finite(line.startIndex)||!finite(line.knownAt)||line.knownAt>time||(line.score??0)<minScore)continue;
    const lineValue=line.startValue+line.slope*(barIndex-line.startIndex),distanceAtr=Math.abs(price-lineValue)/atr;
    if(distanceAtr>toleranceAtr||best&&distanceAtr>=best.distanceAtr)continue;
    best={kind:line.kind,score:line.score??null,lineValue,distanceAtr,knownAt:line.knownAt};
  }
  return best;
}

export function pruneImpactEvents(events,now=Date.now(),retentionMs=IMPACT_RETENTION_MS){
  const cutoff=now-retentionMs;
  return Array.isArray(events)?events.filter(event=>finite(event?.time)&&event.time>=cutoff&&event.time<=now+60_000&&[-1,1].includes(event.side)&&finite(event.quote)&&event.quote>0):[];
}

export function aggregateImpactHistogram(events,step,{now=Date.now(),retentionMs=IMPACT_RETENTION_MS}={}){
  if(!finite(step)||step<=0)throw Error('Khung tổng hợp impact không hợp lệ');
  const buckets=new Map();
  for(const event of pruneImpactEvents(events,now,retentionMs)){
    const time=Math.floor(event.time/step)*step,record=buckets.get(time)??{time,buy:0,sell:0,buyCount:0,sellCount:0};
    if(event.side>0){record.buy+=event.quote;record.buyCount++;}else{record.sell+=event.quote;record.sellCount++;}
    buckets.set(time,record);
  }
  const ordered=[...buckets.values()].sort((a,b)=>a.time-b.time);
  return {
    buckets:ordered,
    buy:ordered.filter(row=>row.buy>0).map(row=>({time:row.time/1000,value:row.buy,color:'rgba(26,224,163,.72)'})),
    sell:ordered.filter(row=>row.sell>0).map(row=>({time:row.time/1000,value:-row.sell,color:'rgba(255,77,112,.72)'}))
  };
}

export class SpreadImpactDetector{
  constructor({zoneResolver,onImpact,confirmMs=IMPACT_CONFIRM_MS}={}){
    if(typeof zoneResolver!=='function'||typeof onImpact!=='function')throw Error('Thiếu bộ lọc vùng giá impact');
    this.zoneResolver=zoneResolver;this.onImpact=onImpact;this.confirmMs=confirmMs;this.books=[];this.pending=[];
  }
  onBook(event){
    const time=Number(event?.T??event?.E),bid=Number(event?.b),ask=Number(event?.a);
    if(!finite(time)||!finite(bid)||!finite(ask)||bid<=0||ask<=bid)return;
    const book={time,bid,ask};this.books.push(book);this.books=this.books.filter(row=>row.time>=time-2000).slice(-80);this.#settle(book);
  }
  onTrade(event){
    const time=Number(event?.T??event?.E),price=Number(event?.p),qty=Number(event?.q),side=event?.m===false?1:event?.m===true?-1:0;
    if(!finite(time)||!finite(price)||!finite(qty)||price<=0||qty<=0||!side)return;
    const before=[...this.books].reverse().find(book=>book.time<=time);if(!before)return;
    const spread=before.ask-before.bid,epsilon=Math.max(1e-10,spread*1e-6),crossed=side>0?price>=before.ask-epsilon:price<=before.bid+epsilon;if(!crossed)return;
    const zone=this.zoneResolver(price,time);if(!zone)return;
    const pending={id:event?.a??event?.id??null,time,price,qty,quote:price*qty,side,before,spread,zone,deadline:time+this.confirmMs};this.pending.push(pending);
    for(const book of this.books)if(book.time>=time)this.#settle(book);
  }
  #settle(book){
    const keep=[];
    for(const trade of this.pending){
      if(book.time<trade.time){keep.push(trade);continue;}
      const jump=trade.side>0?book.ask-trade.before.ask:trade.before.bid-book.bid;
      if(jump+trade.spread*1e-6>=trade.spread){
        this.onImpact({...trade,jump,jumpSpreads:jump/trade.spread,confirmedAt:book.time});continue;
      }
      if(book.time<=trade.deadline)keep.push(trade);
    }
    this.pending=keep.slice(-200);
  }
}
