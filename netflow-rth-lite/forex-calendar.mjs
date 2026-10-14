export const FOREX_FACTORY_CALENDAR_URL='https://www.forexfactory.com/calendar';
export const FOREX_FACTORY_FEED_URL='https://nfs.faireconomy.media/ff_calendar_thisweek.json';
export const CALENDAR_TIME_ZONE='Asia/Ho_Chi_Minh';

const IMPACTS=new Map([
  ['high','High'],['medium','Medium'],['med','Medium'],['low','Low'],['holiday','Holiday'],['non-economic','Non-Economic']
]);

const clean=value=>String(value??'').trim();

export function normalizeCalendarEvent(value){
  if(!value||typeof value!=='object')return null;
  const title=clean(value.title),country=clean(value.country).toUpperCase(),date=clean(value.date);
  const timestamp=Date.parse(date),impact=IMPACTS.get(clean(value.impact).toLowerCase())??clean(value.impact)??'Low';
  if(!title||!country||!Number.isFinite(timestamp))return null;
  return {title,country,date:new Date(timestamp).toISOString(),timestamp,impact,actual:clean(value.actual),forecast:clean(value.forecast),previous:clean(value.previous)};
}

export function normalizeCalendarFeed(payload){
  const raw=Array.isArray(payload)?payload:Array.isArray(payload?.events)?payload.events:[];
  const unique=new Map();
  for(const item of raw){
    const event=normalizeCalendarEvent(item);if(!event)continue;
    unique.set(`${event.timestamp}|${event.country}|${event.title}`,event);
  }
  return [...unique.values()].sort((a,b)=>a.timestamp-b.timestamp||a.country.localeCompare(b.country)||a.title.localeCompare(b.title));
}

export function selectCalendarEvents(events,{now=Date.now(),impact='important',currency='all',pastHours=2,futureHours=120,limit=40}={}){
  const min=now-pastHours*3600000,max=now+futureHours*3600000,currencyKey=clean(currency).toUpperCase();
  const allowed=impact==='high'?new Set(['High']):impact==='all'?null:new Set(['High','Medium']);
  return normalizeCalendarFeed(events).filter(event=>event.timestamp>=min&&event.timestamp<=max&&(!allowed||allowed.has(event.impact))&&(currencyKey==='ALL'||event.country===currencyKey)).slice(0,limit);
}

export async function loadForexCalendar({fetchImpl=fetch,url='./data/forex-calendar.json',signal}={}){
  const response=await fetchImpl(`${url}${url.includes('?')?'&':'?'}v=${Date.now()}`,{signal,cache:'no-store'});
  if(!response.ok)throw Error(`Lịch Forex Factory HTTP ${response.status}`);
  const payload=await response.json(),events=normalizeCalendarFeed(payload);
  if(!events.length)throw Error('Lịch Forex Factory không có sự kiện hợp lệ');
  const updatedAt=Date.parse(payload?.updatedAt);
  return {events,updatedAt:Number.isFinite(updatedAt)?updatedAt:null,source:clean(payload?.source)||FOREX_FACTORY_FEED_URL};
}

export function calendarEventState(event,now=Date.now()){
  const minutes=Math.round((event.timestamp-now)/60000);
  if(Math.abs(minutes)<=15)return {key:'now',label:'Sắp công bố'};
  if(minutes>15)return {key:'future',label:minutes<60?`Còn ${minutes} phút`:minutes<1440?`Còn ${Math.round(minutes/60)} giờ`:`Còn ${Math.round(minutes/1440)} ngày`};
  return {key:'past',label:`${Math.max(1,Math.round(Math.abs(minutes)/60))} giờ trước`};
}
