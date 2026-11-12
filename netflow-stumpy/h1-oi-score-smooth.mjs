const finite=Number.isFinite;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// OI may use the locked H1 context only as a prior. Remove the OI component
// first: otherwise an OI reading would reinforce itself.
export function h1ScoreWithoutOi(record){
  if(record?.status!=='LOCKED')return null;
  const score=finite(record.rawScore)?record.rawScore:record.score;
  if(!finite(score))return null;
  const oi=record?.parts?.oi;
  return clamp(score-(finite(oi)?oi:0),-5,5);
}

export function m15OiEndpointWeight(levels){
  if(!Array.isArray(levels)||levels.length!==5||levels.some(level=>!(finite(level)&&level>0)))return null;
  const changes=levels.slice(1).map((end,index)=>(end-levels[index])/levels[index]);
  const net=changes.reduce((sum,value)=>sum+value,0),gross=changes.reduce((sum,value)=>sum+Math.abs(value),0),direction=Math.sign(net);
  if(!gross||!direction)return {weight:0,coherence:0,activity:0,direction:0};
  const coherence=Math.abs(net)/gross;
  const dominance=changes.filter(value=>Math.sign(value)===direction).length/changes.length;
  // A 0.40% gross movement across the four M15 endpoint pairs earns full
  // activity. Smaller but unanimous changes receive proportionally less pull.
  const activity=clamp(gross/.004,0,1);
  return {weight:coherence*dominance*activity,coherence,activity,direction};
}

function scoreSmooth(value,score,flowDirection,matrixWeight,{targetAtFive,neutralRange,minMagnitude}){
  if(!finite(value)||!finite(score)||!finite(matrixWeight)||![-1,1].includes(flowDirection)||Math.abs(score)<2||Math.abs(value)<minMagnitude)return value;
  // The H1 score has to support price and taker flow, while OI keeps its own
  // sign. That preserves the difference between opening and closing positions.
  if(Math.sign(score)!==flowDirection)return value;
  const confidence=(Math.abs(score)-2)/3;
  const nearNeutral=clamp(1-Math.abs(value)/neutralRange,0,1);
  const weight=clamp(matrixWeight,0,1)*(.30+.65*confidence)*nearNeutral;
  const target=Math.sign(value)*targetAtFive;
  return clamp(value+weight*(target-value),-1,1);
}

export function smoothH1OiNet(rawNet,startOi,score,flowDirection,matrixWeight){
  if(!(startOi>0)||!finite(rawNet))return rawNet;
  const rawRatio=rawNet/startOi;
  return startOi*scoreSmooth(rawRatio,score,flowDirection,matrixWeight,{targetAtFive:.012,neutralRange:.015,minMagnitude:.0002});
}

export function smoothH1OiStrength(rawStrength,score,flowDirection,matrixWeight){
  return scoreSmooth(rawStrength,score,flowDirection,matrixWeight,{targetAtFive:.60,neutralRange:.75,minMagnitude:.015});
}
