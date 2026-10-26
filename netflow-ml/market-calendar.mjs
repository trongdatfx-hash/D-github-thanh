// Scheduled full-day NYSE closures. Input dates use America/New_York.
const cache=new Map();
const iso=date=>date.toISOString().slice(0,10);
const utcDate=(year,month,day)=>new Date(Date.UTC(year,month-1,day));
function observed(year,month,day){
  const date=utcDate(year,month,day),weekday=date.getUTCDay();
  if(weekday===6)date.setUTCDate(date.getUTCDate()-1);
  else if(weekday===0)date.setUTCDate(date.getUTCDate()+1);
  return iso(date);
}
function nthWeekday(year,month,weekday,n){
  const date=utcDate(year,month,1),offset=(weekday-date.getUTCDay()+7)%7;
  date.setUTCDate(1+offset+7*(n-1));return iso(date);
}
function lastWeekday(year,month,weekday){
  const date=utcDate(year,month+1,0),offset=(date.getUTCDay()-weekday+7)%7;
  date.setUTCDate(date.getUTCDate()-offset);return iso(date);
}
function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
  return utcDate(year,month,day);
}
function holidays(year){
  if(cache.has(year))return cache.get(year);
  const set=new Set([
    observed(year,1,1),nthWeekday(year,1,1,3),nthWeekday(year,2,1,3),
    lastWeekday(year,5,1),observed(year,7,4),nthWeekday(year,9,1,1),
    nthWeekday(year,11,4,4),observed(year,12,25)
  ]);
  const goodFriday=easterSunday(year);goodFriday.setUTCDate(goodFriday.getUTCDate()-2);set.add(iso(goodFriday));
  if(year>=2022)set.add(observed(year,6,19));
  const nextNewYear=observed(year+1,1,1);if(nextNewYear.startsWith(`${year}-`))set.add(nextNewYear);
  cache.set(year,set);return set;
}
export function isUsMarketHoliday(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day??''))return false;
  return holidays(+day.slice(0,4)).has(day);
}
export function isUsMarketTradingDay(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day??''))return false;
  const weekday=utcDate(+day.slice(0,4),+day.slice(5,7),+day.slice(8,10)).getUTCDay();
  return weekday!==0&&weekday!==6&&!isUsMarketHoliday(day);
}
export function eligibleMarketBar(bar){return Boolean(bar)&&bar.session!=='WEEKEND'&&isUsMarketTradingDay(bar.day);}
