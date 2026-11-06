import {H1ScoreLedger,lockedH1Blocks,scoreTitle,SCORE_STEP} from './h1-box-score.mjs?v=20261106-score1';
import {h1StripCell} from './h1-h4-strip.mjs?v=20261101-h1h4-align1';

export function mountH1ScoreHistogram({chart,host,getState,storage=null}){
  const ledger=new H1ScoreLedger(storage),nodes=new Map();let frame=0;
  const root=document.createElement('div');root.id='h1-score-histogram';root.hidden=true;root.setAttribute('role','group');root.setAttribute('aria-label','Điểm 8 hộp H1 đã khóa, từ âm 5 đến dương 5');
  const heading=document.createElement('span');heading.className='h1-score-heading';heading.textContent='8 H1 · ±5';heading.title='Điểm mô tả 8 hộp H1 đã khóa, căn cùng thời gian với dải H1 trong pane SPY V. Xanh: điểm dương; đỏ: điểm âm; * là thiếu dữ liệu, chưa khóa điểm.';
  const zero=document.createElement('div');zero.className='h1-score-zero';
  const label=document.createElement('span');label.className='h1-score-zero-label';label.textContent='0';zero.append(label);root.append(heading,zero);host.append(root);
  function draw(){
    frame=0;const state=getState();
    if(!state.active||!state.bars?.length){root.hidden=true;return;}
    const pane=chart.panes()[0]?.getHTMLElement?.();if(!pane||!host.contains(pane)){root.hidden=true;return;}
    const box=pane.getBoundingClientRect(),hostBox=host.getBoundingClientRect(),paneTop=box.top-hostBox.top-(host.clientTop||0);
    const scaleWidth=chart.priceScale('right',0)?.width?.()??64,plotWidth=Math.max(0,host.clientWidth-scaleWidth);
    const height=Math.min(100,Math.max(76,box.height*.24)),top=paneTop+Math.min(60,Math.max(38,box.height*.12)),baseline=height/2;
    if(box.height<180||plotWidth<40){root.hidden=true;return;}
    root.hidden=false;root.style.top=top+'px';root.style.width=plotWidth+'px';root.style.height=height+'px';zero.style.top=baseline+'px';
    const range=chart.timeScale().getVisibleRange(),visibleTo=range&&Number.isFinite(Number(range.to))?Number(range.to)*1000+SCORE_STEP-1:Infinity;
    const blocks=lockedH1Blocks(state.states,state.now,visibleTo),times=state.bars.map(b=>b.t),spacing=chart.timeScale().options().barSpacing;
    const used=new Set(),positions=[];let visible=0;
    for(const block of blocks){
      const cell=h1StripCell(block.blockStart,times,t=>chart.timeScale().timeToCoordinate(t),spacing);if(!cell||cell.x+cell.width<0||cell.x>plotWidth)continue;
      const score=ledger.get(block,state);if(!score)continue;used.add(block.blockStart);visible++;
      let node=nodes.get(block.blockStart);if(!node){node=document.createElement('div');node.className='h1-score-bar';node.tabIndex=0;const text=document.createElement('span');node.append(text);nodes.set(block.blockStart,node);root.append(node);}
      const value=score.score,amount=value===null?0:Math.abs(value),barHeight=value===null||value===0?2:amount*(height/2-18)/5;
      const x=cell.x+cell.width*.2,w=Math.max(1,cell.width*.6),y=value>0?baseline-barHeight:baseline;
      node.style.left=x+'px';node.style.width=w+'px';node.style.top=y+'px';node.style.height=barHeight+'px';
      node.dataset.direction=value===null?'missing':value>0?'up':value<0?'down':'neutral';node.dataset.status=score.status;node.dataset.start=String(block.blockStart);node.dataset.score=value===null?'':String(value);node.dataset.cellCenter=String(cell.x+cell.width/2);node.dataset.boxDirection=String(block.direction);
      const text=node.firstElementChild;text.textContent=(value===null?'—':value>0?'+'+value:String(value))+(score.status==='LOCKED'?'':'*');text.hidden=cell.width<12;
      const title=scoreTitle(score);if(node.title!==title)node.title=title;node.setAttribute('aria-label',title);node.dataset.conflict=String(value!==null&&value!==0&&block.direction!==0&&Math.sign(value)!==block.direction);
      positions.push({start:block.blockStart,x:cell.x,width:cell.width,center:cell.x+cell.width/2,score:value,status:score.status});
    }
    for(const [key,node] of nodes)if(!used.has(key)){node.remove();nodes.delete(key);}
    root.dataset.visible=String(visible);root.dataset.selected=String(blocks.length);root.dataset.positions=JSON.stringify(positions);root.dataset.pane='0';root.dataset.baseline=String(top+baseline);root.dataset.alignment='same-h1StripCell';
    heading.textContent=visible?`8 H1 · ±5${positions.some(p=>p.status!=='LOCKED')?' · * thiếu dữ liệu':''}`:'8 H1 · chờ hộp đã khóa';
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  schedule();return {schedule};
}
