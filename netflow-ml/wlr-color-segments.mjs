// Attribute each half of a connecting line to its own candle's color.
// Width is deliberately kept at the existing endpoint-b value.
export function wlrColorSegments(a,b,fallback='#f6c85f'){
 const ca=a.color??fallback,cb=b.color??fallback;
 if(ca===cb)return [{x1:a.x,y1:a.y,x2:b.x,y2:b.y,color:cb}];
 const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
 return [{x1:a.x,y1:a.y,x2:x,y2:y,color:ca},{x1:x,y1:y,x2:b.x,y2:b.y,color:cb}];
}
