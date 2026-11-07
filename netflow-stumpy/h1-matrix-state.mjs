export const MATRIX_ROWS=['position','slope','randomWalk','rwAdjustment','deltaNF','oi'];
export function matrixOptions(value={}){
  const pick=(key,list,fallback)=>list.includes(Number(value[key]))?Number(value[key]):fallback;
  const window=pick('window',[6,8,9,10],9),size=pick('size',[2,3,4],3),groups=Math.min(pick('groups',[1,2,3],2),Math.floor(window/size));
  return {window,size,groups};
}
function contiguous(columns){return columns.every((c,i)=>!i||c.t-columns[i-1].t===3600000);}
function evidence(columns){
  const needed=Math.ceil(columns.length*2/3),n=(key,d)=>columns.filter(c=>c.values[key]===d).length;
  const direction=[1,-1].find(d=>n('position',d)>=needed&&n('slope',d)>=1&&n('slope',-d)===0)??0;
  return {direction,n,needed,complete:columns.every(c=>['position','slope','deltaNF','oi'].every(k=>Number.isFinite(c.values[k])))};
}
export function classifyMatrixGroup(columns,previous=[]){
  const e=evidence(columns),d=e.direction,word=d>0?'Tăng':'Giảm';
  if(!columns.length||!contiguous(columns))return {state:'WAIT',text:'Chưa đủ hộp liên tục'};
  if(!e.complete)return {state:'MISSING',text:d?`${word} · thiếu dữ liệu`:'Thiếu dữ liệu'};
  if(!d)return {state:'MIXED',text:'Chuyển tiếp / chưa rõ'};
  if(e.n('deltaNF',-d)>=e.needed)return {state:'CONFLICT',text:'Giá–ΔV×C Taker NF xung đột'};
  if(e.n('deltaNF',d)>=e.needed&&e.n('oi',d)>=e.needed)return {state:d>0?'UP':'DOWN',text:`${word} được ủng hộ`};
  const p=evidence(previous),adjacent=previous.length===columns.length&&contiguous(previous)&&previous.at(-1)?.t+3600000===columns[0].t;
  if(adjacent&&p.complete&&p.direction===d&&p.n('deltaNF',d)>=p.needed&&p.n('oi',d)>=p.needed&&e.n('deltaNF',d)<p.n('deltaNF',d)&&e.n('oi',d)<p.n('oi',d))return {state:d>0?'UP_WEAK':'DOWN_WEAK',text:`Lực ${d>0?'tăng':'giảm'} suy yếu`};
  return {state:'UNCONFIRMED',text:`${word} chưa đủ xác nhận`};
}
export function buildH1Matrix(records,options={}){
  const o=matrixOptions(options),columns=[...new Map(records.filter(r=>r&&r.status!=='PREVIEW'&&r.status!=='WAIT_DATA'&&r.closedBars!==3).map(r=>[r.blockStart,r])).values()].sort((a,b)=>a.blockStart-b.blockStart).slice(-o.window).map(r=>({t:r.blockStart,values:{...r.parts,rwAdjustment:r.bonus?.randomWalkAlignment??null},missing:r.missing??[]}));
  const groups=[];
  for(let back=o.groups-1;back>=0;back--){
    const end=columns.length-back*o.size,start=end-o.size,current=start>=0?columns.slice(start,end):[],previous=start>=o.size?columns.slice(start-o.size,start):[];
    const result=current.length===o.size?classifyMatrixGroup(current,previous):{state:'WAIT',text:'Chưa đủ hộp'};
    groups.push({...result,firstBox:current.length?start+1:null,lastBox:current.length?end:null,from:current[0]?.t??null,to:current.at(-1)?.t??null,count:current.length});
  }
  return {options:o,rows:MATRIX_ROWS,columns,groups};
}
export function hasTrendPrediction(state){return !!state?.active&&state.reliable===true&&Number.isFinite(state.continuation);}
export function cvdConfirmationText(confirmation){
  if(confirmation.state==='conflict')return '';
  return ({confirmed:'XN',forming:'CHỜ XN',mixed:'HỖN HỢP',WAIT:'CHỜ XN'}[confirmation.state]??'CHỜ XN')+(confirmation.state==='confirmed'&&confirmation.count?` ${confirmation.support}/${confirmation.count} · ${Math.round(confirmation.share*100)}%`:'');
}
export function mountMatrixSettings(host,storage,onChange){
  let options;try{options=matrixOptions(JSON.parse(storage?.getItem('dvp:h1-matrix-options:v1')??'{}'));}catch{options=matrixOptions();}
  if(!host)return ()=>options;
  const panel=document.createElement('details');panel.className='h1-matrix-settings';const heading=document.createElement('summary');heading.textContent='Ma trận H1';panel.append(heading);
  const selects={};
  for(const [key,label,values] of [['window','Dữ liệu ma trận',[6,8,9,10]],['size','Hộp mỗi nhóm',[2,3,4]],['groups','Nhóm đọc kết quả',[1,2,3]]]){
    const field=document.createElement('label');field.textContent=label+' ';const select=document.createElement('select');select.setAttribute('aria-label',label);
    for(const v of values){const option=document.createElement('option');option.value=v;option.textContent=String(v);select.append(option);}select.value=String(options[key]);
    selects[key]=select;select.onchange=()=>{options=matrixOptions({...options,[key]:Number(select.value)});for(const [k,s] of Object.entries(selects))s.value=String(options[k]);try{storage?.setItem('dvp:h1-matrix-options:v1',JSON.stringify(options));}catch{}onChange?.();};field.append(select);panel.append(field);
  }
  host.append(panel);return ()=>options;
}

