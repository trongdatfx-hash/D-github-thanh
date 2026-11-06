export function volatilityQuoteState(quote,now=Date.now(),requestFailed=false){
 const valid=quote&&Number.isFinite(quote.price)&&quote.price>0&&Number.isFinite(quote.asOf)&&quote.asOf>0&&quote.asOf<=now+60000;
 if(!valid)return {status:'WAIT',price:null,changePct:null,asOf:null,lagMinutes:null};
 const lagMinutes=Math.max(0,(now-quote.asOf)/60000),stale=requestFailed||quote.fetchStatus!=='ok'||lagMinutes>35;
 return {status:stale?'DỮ LIỆU CŨ':'DELAYED · ~15 phút',price:quote.price,changePct:Number.isFinite(quote.changePct)?quote.changePct:null,asOf:quote.asOf,lagMinutes};
}

export function sp500AlertState(quote,now=Date.now(),requestFailed=false,threshold=1.3){
 const state=volatilityQuoteState(quote,now,requestFailed),move=state.changePct;
 const volatile=Number.isFinite(move)&&Math.abs(move)>threshold;
 return {...state,volatile,threshold};
}
