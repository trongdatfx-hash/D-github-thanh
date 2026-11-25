import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../app.mjs',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function drawGeometryOverlay(){'),app.indexOf('function render(fit=false){'));
function render({bars=8,provisional=true}={}){
 const strokes=[];let dash=[];
 const context={setTransform(){},clearRect(){},save(){},beginPath(){},rect(){},clip(){},moveTo(){},lineTo(){},arc(){},fill(){},restore(){},setLineDash(next){dash=[...next];},stroke(){strokes.push({dash:[...dash],width:this.lineWidth,color:this.strokeStyle});}};
 const canvas={dataset:{},getContext:()=>context};
 const nodes={'geometry-overlay':canvas,chart:{clientWidth:390,clientHeight:700},'causal-trend-channel':{checked:true},'geometry-pivots':{checked:false}};
 const trend={bars,provisional,direction:1,startTime:1000,confirmationTime:1000,lineWidth:5,qualityOpacity:.8,renderPoints:Array.from({length:bars},(_,i)=>({time:(i+1)*1000,upper:110,lower:90,center:100}))};
 vm.runInNewContext('('+source+')()',{ $:id=>nodes[id],window:{devicePixelRatio:1},geometryState:{},geometryStatePoints:[],causalChannelState:{trends:[trend]},chart:{panes:()=>[{getHeight:()=>500}],priceScale:()=>({width:()=>58}),timeScale:()=>({timeToCoordinate:t=>t*20})},price:{priceToCoordinate:p=>p}});
 return {strokes,canvas};
}
test('the actual chart renderer draws an active eight-bar channel as two dotted rails',()=>{
 const {strokes,canvas}=render();assert.equal(strokes.length,2);
 assert(strokes.every(s=>s.dash.join(',')==='4,4'));assert(strokes.every(s=>s.width<=3));
 assert.equal(canvas.dataset.causalActiveTrends,'1');assert.match(strokes[1].color,/34,211,238/);
});
test('the renderer keeps seven-bar channels hidden and finished channels solid',()=>{
 assert.equal(render({bars:7}).strokes.length,0);
 const {strokes}=render({provisional:false});assert.equal(strokes.length,2);
 assert(strokes.every(s=>s.dash.length===0));assert.match(strokes[1].color,/250,204,21/);
});
