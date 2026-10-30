export function chartFresh(data,now,receivedAt,wallNow=Date.now()){
 if(!data||data.historical||data.partial||![now,receivedAt].every(Number.isFinite)||wallNow-receivedAt<0||wallNow-receivedAt>=15000)return false;
 const step=({'5m':300000,'15m':900000,'30m':1800000,'1h':3600000})[data.interval];
 if(!step)return false;
 const tails=['SPYUSDT','QQQUSDT'].map(symbol=>data[symbol]?.at(-1));
 if(tails.some(last=>!Number.isFinite(last?.t)||!Number.isFinite(last?.end)||last.end!==last.t+step-1||last.t>now))return false;
 if(tails[0].t!==tails[1].t)return false;
 return tails.every(last=>now-last.end<=15000);
}

export function liveTrendAgeState(state,live){
 return state??null;
}
