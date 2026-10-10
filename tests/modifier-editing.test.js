import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,normalize,modelData,ringAt,transition,moveModifier,duplicateModifier} from '../dist/geometry.js';
test('curves preserve endpoints and have distinct intermediate progress',()=>{
 for(const c of ['linear','easeIn','easeOut','smooth']){assert.equal(transition(0,c),0);assert.equal(transition(1,c),1);assert.equal(transition(-2,c),0);assert.equal(transition(3,c),1);}
 assert.equal(transition(.25,'easeIn'),.0625);assert.equal(transition(.25,'easeOut'),.4375);assert.equal(transition(.25,'smooth'),.15625);
});
test('legacy geometry remains linear and curve settings survive project round trip',()=>{
 const s=defaults();assert.deepEqual(modelData(s),modelData(normalize(s)));
 const next=normalize({...s,modifiers:[{type:'taper',value:40,start:1,end:48,curve:'easeIn'}]});assert.deepEqual(modelData(next),modelData(normalize(JSON.parse(JSON.stringify(next)))));
 const linear={...next,modifiers:next.modifiers.map(m=>({...m,curve:'linear'}))};assert.notDeepEqual(ringAt(next,12),ringAt(linear,12));assert.deepEqual(ringAt(next,48),ringAt(linear,48));
 assert.equal(normalize({...s,modifiers:[{...s.modifiers[0],curve:'invalid'}]}).modifiers[0].curve,'linear');
});
test('duplicate is independent and respects the 12 modifier limit',()=>{
 const m=[{id:'a',type:'wave',value:8,start:2,end:20,curve:'smooth',cycles:3}];assert.equal(duplicateModifier(m,0,'b'),true);assert.equal(m[1].curve,'smooth');assert.equal(m[1].id,'b');m[1].value=4;assert.equal(m[0].value,8);
 while(m.length<12)duplicateModifier(m,0,String(m.length));assert.equal(duplicateModifier(m,0,'extra'),false);assert.equal(m.length,12);
});
test('reordering affects outline operations and preserves fixed transformation stages',()=>{
 const s=normalize({...defaults(),modifiers:[{type:'morph',value:100,target:'ellipse',start:1,end:48},{type:'slender',value:2,start:1,end:48}]});const before=ringAt(s,48);assert.equal(moveModifier(s.modifiers,1,0),true);assert.notDeepEqual(ringAt(s,48),before);assert.equal(moveModifier(s.modifiers,-1,1),false);assert.equal(moveModifier(s.modifiers,0,0),false);
 const fixed=defaults();fixed.modifiers.push({type:'leanX',value:10,start:1,end:48,enabled:true});const a=ringAt(fixed,24);moveModifier(fixed.modifiers,2,0);assert.deepEqual(ringAt(fixed,24),a);
});
