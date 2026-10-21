import test from 'node:test';import assert from 'node:assert/strict';
import {compareDrink} from '../src/features/comparison.ts';import {defaults} from '../src/lib/model.ts';
const d={id:'a',name:'A',serving:100,color:'#aaaaaa',source:'label',nutrition:{sugar:10,caffeine:20,calories:30,sodium:null,potassium:null}};
test('comparison scales real portions, preserves unknowns and shows exceeded limits',()=>{const r=compareDrink(d,300,[],defaults);assert.equal(r.values.sugar,30);assert.equal(r.values.sodium,null);assert.match(r.sentence,/5 g sugar over/);assert.throws(()=>compareDrink(d,0,[],defaults));});
