const finite=Number.isFinite;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// OI may use the locked H1 context only as a small prior. Remove the OI
// component first: otherwise an OI reading would reinforce itself.
export function h1ScoreWithoutOi(record){
  if(record?.status!=='LOCKED')return null;
  const score=finite(record.rawScore)?record.rawScore:record.score;
  if(!finite(score))return null;
  const oi=record?.parts?.oi;
  return clamp(score-(finite(oi)?oi:0),-5,5);
}

function scoreSmooth(value,score,{targetAtFive,neutralRange}){
  if(!finite(value)||!finite(score)||Math.abs(score)<2||value*score<=0)return value;
  // Strong raw OI is already evidence in its own right. The prior only
  // helps a same-direction reading close to zero, with a maximum 65% weight.
  const confidence=(Math.abs(score)-2)/3;
  const nearNeutral=clamp(1-Math.abs(value)/neutralRange,0,1);
  const weight=(.20+.45*confidence)*nearNeutral;
  const target=targetAtFive*clamp(score/5,-1,1);
  return clamp(value+weight*(target-value),-1,1);
}

export function smoothH1OiNet(rawNet,startOi,score){
  if(!(startOi>0)||!finite(rawNet))return rawNet;
  const rawRatio=rawNet/startOi;
  return startOi*scoreSmooth(rawRatio,score,{targetAtFive:.004,neutralRange:.006});
}

export function smoothH1OiStrength(rawStrength,score){
  return scoreSmooth(rawStrength,score,{targetAtFive:.28,neutralRange:.30});
}
