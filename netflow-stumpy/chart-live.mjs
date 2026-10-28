export function chartFresh(data,now,receivedAt,wallNow=Date.now()){
 if(!data||data.historical||data.partial||![now,receivedAt].every(Number.isFinite)||wallNow-receivedAt<0||wallNow-receivedAt>=15000)return false;
 const step=({'5m':300000,'15m':900000,'30m':1800000,'1h':3600000})[data.interval];
 return Boolean(step&&['SPYUSDT','QQQUSDT'].every(s=>{const last=data[s]?.at(-1);return Number.isFinite(last?.t)&&Number.isFinite(last?.end)&&last.t<=now&&now-last.end<=15000;}));
}
