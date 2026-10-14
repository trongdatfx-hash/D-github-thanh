import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCalendarEvent,normalizeCalendarFeed,parseForexFactoryMarkdown,mergeCalendarResults,selectCalendarEvents,calendarEventState,actualVsForecast,loadForexCalendar} from '../forex-calendar.mjs';

const sample=[
  {title:'Core CPI m/m',country:'usd',date:'2026-10-14T08:30:00-04:00',impact:'High',forecast:'0.2%',previous:'0.3%'},
  {title:'ECB President Speaks',country:'EUR',date:'2026-10-14T09:00:00-04:00',impact:'Medium',forecast:'',previous:''},
  {title:'Minor release',country:'USD',date:'2026-10-14T10:00:00-04:00',impact:'Low',forecast:'',previous:''}
];

test('normalizes official Forex Factory fields and rejects invalid rows',()=>{
  const event=normalizeCalendarEvent(sample[0]);
  assert.equal(event.country,'USD');assert.equal(event.impact,'High');assert.equal(event.timestamp,Date.parse('2026-10-14T12:30:00Z'));
  assert.equal(normalizeCalendarEvent({title:'missing date',country:'USD'}),null);
});

test('deduplicates, sorts and filters impact/currency without changing timestamps',()=>{
  const events=normalizeCalendarFeed([sample[2],sample[0],sample[0],sample[1],{bad:true}]);
  assert.equal(events.length,3);assert.equal(events[0].title,'Core CPI m/m');
  const selected=selectCalendarEvents(events,{now:Date.parse('2026-10-14T12:00:00Z'),impact:'important',currency:'all'});
  assert.deepEqual(selected.map(x=>x.title),['Core CPI m/m','ECB President Speaks']);
  assert.deepEqual(selectCalendarEvents(events,{now:Date.parse('2026-10-14T12:00:00Z'),impact:'all',currency:'USD'}).map(x=>x.title),['Core CPI m/m','Minor release']);
});

test('labels imminent, future and past events from the supplied clock',()=>{
  const now=Date.parse('2026-10-14T12:30:00Z'),event=normalizeCalendarEvent(sample[0]);
  assert.equal(calendarEventState(event,now).key,'now');
  assert.equal(calendarEventState({...event,timestamp:now+120*60000},now).label,'Còn 2 giờ');
  assert.equal(calendarEventState({...event,timestamp:now-180*60000},now).label,'3 giờ trước');
});

test('parses Actual from Forex Factory calendar markdown and merges revised figures',()=>{
  const markdown=`| Wed Oct 14 | 7:30am | USD | ![Image](https://resources.faireconomy.media/images/sprites/ff-impact-red.png) | Core CPI m/m |  | [detail](https://www.forexfactory.com/) | 0.3% | 0.2% | 0.3% | [graph](https://www.forexfactory.com/) |\n|  | USD | ![Image](https://resources.faireconomy.media/images/sprites/ff-impact-red.png) | CPI y/y |  | [detail](https://www.forexfactory.com/) | 3.7% | 3.6% | 3.4% | [graph](https://www.forexfactory.com/) |`;
  const results=parseForexFactoryMarkdown(markdown);assert.equal(results.length,2);assert.equal(results[0].actual,'0.3%');
  const merged=mergeCalendarResults(sample,results);assert.equal(merged[0].actual,'0.3%');assert.equal(merged[0].forecast,'0.2%');
});

test('classifies released actual versus forecast without calling higher better',()=>{
  assert.deepEqual(actualVsForecast({actual:'0.3%',forecast:'0.2%'}),{key:'above',label:'Cao hơn dự báo'});
  assert.equal(actualVsForecast({actual:'199K',forecast:'199K'}).key,'equal');
  assert.equal(actualVsForecast({actual:'',forecast:'1%'}).key,'pending');
  assert.equal(actualVsForecast({actual:'3.80|1.4',forecast:''}).key,'released');
});

test('loads the same-origin snapshot and preserves its provenance',async()=>{
  const result=await loadForexCalendar({url:'/calendar.json',fetchImpl:async url=>({ok:true,json:async()=>({source:'official-feed',updatedAt:'2026-10-14T12:00:00Z',events:sample}),url})});
  assert.equal(result.events.length,3);assert.equal(result.source,'official-feed');assert.equal(result.updatedAt,Date.parse('2026-10-14T12:00:00Z'));
});
