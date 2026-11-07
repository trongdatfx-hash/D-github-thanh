const $=id=>document.getElementById(id);
export function compactWeeklyDayLabel(name,packet){
 if(!packet)return '';
 return `${name} · ${packet.direction>0?'UP':packet.direction<0?'DOWN':'WAIT'} · ${Math.round(100*packet.quality)}% · ${packet.blocks}H1${packet.preview?' · PREVIEW':''}`;
}
export function renderWeeklyTrendMap(state){
 const root=$('weekly-trend-map'),cells=$('weekly-days');if(!root||!cells)return;
 root.dataset.state=(state?.label??'WAIT').toLowerCase();
 const cellRows=state?.cells??['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(name=>({name,packet:null}));
 cells.replaceChildren(...cellRows.map(({name,packet})=>{
 const node=document.createElement('div'),direction=packet?.direction??0;
 node.className=`weekly-day ${direction>0?'up':direction<0?'down':'wait'}${packet?.preview?' preview':''}`;
 node.innerHTML=`<small>${name}</small><b>${packet?direction>0?'UP':direction<0?'DOWN':'WAIT':'—'}</b><span>${packet?Math.round(100*packet.quality)+'% · '+packet.blocks+'H1':'chưa có'}</span>${packet?.preview?'<em>PREVIEW</em>':''}`;
 return node;
 }));
}
