import {H1ScoreLedger,h1ScoreBars,lockedH1Blocks,scoreableH1Blocks,scoreTitle,SCORE_STEP} from './h1-box-score.mjs?v=20261107-outside-fast1';
import {buildH1Matrix} from './h1-matrix-state.mjs?v=20261107-spy-delta-day1';
import {h1StripCell} from './h1-h4-strip.mjs?v=20261101-h1h4-align1';

export function mountH1ScoreHistogram({chart,host,getState,storage=null,onMatrix=()=>{}}){
  const ledger=new H1ScoreLedger(storage),nodes=new Map();let frame=0;
  const root=document.createElement('div');root.id='h1-score-histogram';root.hidden=true;root.setAttribute('role','group');root.setAttribute('aria-label','Điểm 36 hộp H1, bắt đầu từ 3 nến M15 đã đóng, từ âm 5 đến dương 5');
  const heading=document.createElement('span');heading.className='h1-score-heading';heading.textContent='36 H1 · ±5';heading.title='Điểm mô tả tối đa 36 hộp H1, căn cùng thời gian với dải H1 trong pane SPY V. Hộp hiện tại có điểm tạm sau 3 M15 đóng, khóa sau nến thứ tư nếu đủ dữ liệu. Xanh: điểm dương; đỏ: điểm âm; ~ là điểm tạm 3/4; * là thiếu dữ liệu.';
  const zero=document.createElement('div');zero.className='h1-score-zero';
  const label=document.createElement('span');label.className='h1-score-zero-label';label.textContent='0';zero.append(label);root.append(heading,zero);host.append(root);
  function draw(){
    frame=0;const state=getState();
    if(!state.active||!state.bars?.length){root.hidden=true;onMatrix(null);return;}
    const matrixBlocks=lockedH1Blocks(state.states,state.now,Infinity,state.matrixOptions?.window??9);
    const getScore=block=>ledger.get(block,{...state,bars:h1ScoreBars(state.bars,block.blockStart)});
    const matrixScores=new Map(matrixBlocks.map(b=>[b.blockStart,getScore(b)]));
    const matrix=buildH1Matrix([...matrixScores.values()],state.matrixOptions);
    const matrixNumbers=new Map(matrix.columns.map((c,i)=>[c.t,i+1]));onMatrix(matrix);
    const pane=chart.panes()[0]?.getHTMLElement?.();if(!pane||!host.contains(pane)){root.hidden=true;return;}
    const box=pane.getBoundingClientRect(),hostBox=host.getBoundingClientRect(),paneTop=box.top-hostBox.top-(host.clientTop||0);
    const scaleWidth=chart.priceScale('right',0)?.width?.()??64,plotWidth=Math.max(0,host.clientWidth-scaleWidth);
    const height=Math.min(100,Math.max(76,box.height*.24)),top=paneTop+Math.min(60,Math.max(38,box.height*.12)),baseline=height/2;
    if(box.height<180||plotWidth<40){root.hidden=true;return;}
    root.hidden=false;root.style.top=top+'px';root.style.width=plotWidth+'px';root.style.height=height+'px';zero.style.top=baseline+'px';
    const range=chart.timeScale().getVisibleRange(),visibleTo=range&&Number.isFinite(Number(range.to))?Number(range.to)*1000+SCORE_STEP-1:Infinity;
    const blocks=scoreableH1Blocks(state.states,state.bars,state.now,visibleTo),times=state.bars.map(b=>b.t),spacing=chart.timeScale().options().barSpacing;
    const used=new Set(),positions=[];let visible=0;
    for(const block of blocks){
      const cell=h1StripCell(block.blockStart,times,t=>chart.timeScale().timeToCoordinate(t),spacing);if(!cell||cell.x+cell.width<0||cell.x>plotWidth)continue;
      const score=matrixScores.has(block.blockStart)?matrixScores.get(block.blockStart):getScore(block);if(!score)continue;used.add(block.blockStart);visible++;
      let node=nodes.get(block.blockStart);if(!node){node=document.createElement('div');node.className='h1-score-bar';node.tabIndex=0;const text=document.createElement('span');node.append(text);nodes.set(block.blockStart,node);root.append(node);}
      const value=score.score,amount=value===null?0:Math.abs(value),barHeight=value===null||value===0?2:amount*(height/2-18)/5;
      const x=cell.x+cell.width*.2,w=Math.max(1,cell.width*.6),y=value>0?baseline-barHeight:baseline;
      node.style.left=x+'px';node.style.width=w+'px';node.style.top=y+'px';node.style.height=barHeight+'px';
      node.dataset.direction=value===null?'missing':value>0?'up':value<0?'down':'neutral';node.dataset.status=score.status;node.dataset.start=String(block.blockStart);node.dataset.score=value===null?'':String(value);node.dataset.cellCenter=String(cell.x+cell.width/2);node.dataset.boxDirection=String(block.direction);
      node.dataset.closedBars=String(score.closedBars??4);node.dataset.rwBonus=String(score.bonus?.randomWalkAlignment??0);node.dataset.rawScore=score.rawScore===null?'':String(score.rawScore);
      const text=node.firstElementChild;text.textContent=(score.status==='PREVIEW'?'~':'')+(value===null?'—':value>0?'+'+value:String(value))+(score.missing.length?'*':'');text.hidden=cell.width<12;
      const number=matrixNumbers.get(block.blockStart);node.dataset.matrixBox=number?String(number):'';
      const title=(number?`Ma trận H${number}/${matrix.columns.length}\n`:'')+scoreTitle(score);if(node.title!==title)node.title=title;node.setAttribute('aria-label',title);node.dataset.conflict=String(value!==null&&value!==0&&block.direction!==0&&Math.sign(value)!==block.direction);
      positions.push({start:block.blockStart,x:cell.x,width:cell.width,center:cell.x+cell.width/2,score:value,status:score.status,closedBars:score.closedBars??4,missing:score.missing.length});
    }
    for(const [key,node] of nodes)if(!used.has(key)){node.remove();nodes.delete(key);}
    root.dataset.visible=String(visible);root.dataset.selected=String(blocks.length);root.dataset.positions=JSON.stringify(positions);root.dataset.pane='0';root.dataset.baseline=String(top+baseline);root.dataset.alignment='same-h1StripCell';
    heading.textContent=visible?`36 H1 · ±5${positions.some(p=>p.status==='PREVIEW')?' · ~ tạm 3/4':''}${positions.some(p=>p.missing)?' · * thiếu':''}`:'36 H1 · chờ ≥3 M15 đóng';
  }
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};
  schedule();return {schedule};
}






