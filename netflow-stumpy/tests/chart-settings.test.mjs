import test from 'node:test';
import assert from 'node:assert/strict';
import {mountChartSettings} from '../chart-settings.mjs';
test('existing controls move into closed chart settings without cloning or losing listeners',()=>{
 const element=()=>({children:[],open:false,classList:{add(){}},setAttribute(){},append(...nodes){this.children.push(...nodes);},addEventListener(type,handler){this[type]=handler;},focus(){this.focused=true;}});
 globalThis.document={createElement:element};const controls=element(),listener=()=>{},head=element();controls.onchange=listener;
 const settings=mountChartSettings(controls,{querySelector:()=>head});
 assert.equal(settings.open,false);assert.equal(head.children[0],settings);assert.equal(settings.children[0].textContent,'Cài đặt chart');
 assert.equal(settings.children[1].children[0],controls);assert.equal(controls.onchange,listener);
 let stopped=false;settings.open=true;settings.keydown({key:'Escape',stopPropagation(){stopped=true;}});assert.equal(settings.open,false);assert.equal(stopped,true);assert.equal(settings.children[0].focused,true);
 delete globalThis.document;
});
test('missing optional settings controls do not interrupt chart initialization',()=>{assert.equal(mountChartSettings(null,null),null);});
