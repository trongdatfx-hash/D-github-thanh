// Attribute each half of a connecting line to its own candle's color.
// Optional widths follow the same half-candle boundaries as colors.
export function wlrColorSegments(a,b,fallback='#f6c85f'){
 const ca=a.color??fallback,cb=b.color??fallback;
 const wa=Number.isFinite(a.width)?a.width:null,wb=Number.isFinite(b.width)?b.width:null;
 const width=w=>w===null?{}:{width:w};
 if(ca===cb&&wa===wb)return [{x1:a.x,y1:a.y,x2:b.x,y2:b.y,color:cb,...width(wb)}];
 const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
 return [{x1:a.x,y1:a.y,x2:x,y2:y,color:ca,...width(wa)},{x1:x,y1:y,x2:b.x,y2:b.y,color:cb,...width(wb)}];
}

