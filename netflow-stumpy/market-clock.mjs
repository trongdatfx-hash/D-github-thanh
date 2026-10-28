import {ny} from './rth-structure.mjs?v=20261029-price-delta1';
const londonClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function europeOpen(day){
 const utc=Date.parse(day+'T08:00:00Z'),p=Object.fromEntries(londonClock.formatToParts(utc).map(v=>[v.type,v.value]));
 return utc+(480-(+p.hour*60+ +p.minute))*60000;
}
export const abaStartMinute=day=>ny(europeOpen(day)).minute;
