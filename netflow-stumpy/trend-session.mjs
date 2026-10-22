import {europeOpen} from './wlr-aba-core.mjs?v=20261022-europe1';
import {ny,tradingDay,closeMinute} from './rth-structure.mjs';

export function trendSessionAt(t){
 const p=ny(t),active=tradingDay(p.day)&&t>=europeOpen(p.day)&&p.minute<closeMinute(p.day);
 return {...p,active,session:active?(p.minute<240?'EURO':p.minute<570?'PRE':'RTH'):null};
}
export function trendSessionRows(rows){
 return rows.flatMap(row=>{const p=trendSessionAt(row.t);return p.active?[{...row,day:p.day,session:p.session}]:[];});
}
