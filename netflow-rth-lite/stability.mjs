const numericFields=['low','level','high','rate','lower','baselineRate','uplift','similarity'];
const blend=(from,to,alpha)=>Number.isFinite(from)&&Number.isFinite(to)?from+alpha*(to-from):to;

// Stateful live-bar stabilizer. It never reads future candles: each update is
// one newer Binance snapshot for the same open candle.
export class ReversalStabilizer{
  constructor({alpha=.25,confirmations=3}={}){
    if(!(alpha>0&&alpha<=1)||!Number.isInteger(confirmations)||confirmations<1)throw Error('Tham số làm mượt REV6 không hợp lệ');
    this.alpha=alpha;this.confirmations=confirmations;this.reset();
  }
  reset(){this.key=null;this.observation=null;this.state=null;this.pending=null;this.pendingCount=0;}
  update(raw,key,observation){
    if(key!==this.key){this.reset();this.key=key;this.observation=observation;this.state=raw;return raw;}
    if(observation===this.observation)return this.state??raw;
    this.observation=observation;
    const sameReady=this.state?.ready&&raw?.ready&&this.state.direction===raw.direction;
    if(sameReady){
      const next={...raw};for(const field of numericFields)next[field]=blend(this.state[field],raw[field],this.alpha);
      next.smoothed=true;this.state=next;this.pending=null;this.pendingCount=0;return next;
    }
    const signature=raw?.ready?`ready:${raw.direction}`:`off:${raw?.reason??'unknown'}`;
    if(!this.state?.ready&&!raw?.ready){this.state=raw;this.pending=null;this.pendingCount=0;return raw;}
    if(this.pending===signature)this.pendingCount++;else{this.pending=signature;this.pendingCount=1;}
    if(this.pendingCount<this.confirmations){this.state={...this.state,stabilizing:true,pendingReason:signature};return this.state;}
    this.state=raw;this.pending=null;this.pendingCount=0;return raw;
  }
}
