import test from "node:test";
import assert from "node:assert/strict";
import { validatePhoto } from "../src/features/photo.ts";
test("photo results cannot supply nutrition or select an unknown drink", () => {
  assert.equal(
    validatePhoto({ kind: "drink", drink_id: "unknown", amount_ml: 250 }, [
      "water",
    ]).kind,
    "unknown",
  );
  assert.equal(
    validatePhoto({ kind: "food", drink_id: null, amount_ml: null }, ["water"])
      .kind,
    "food",
  );
  assert.throws(() =>
    validatePhoto(
      { kind: "drink", drink_id: "water", amount_ml: 250, sugar: 0 },
      ["water"],
    ),
  );
});

test('photo endpoint uses quota, returns matched IDs only and cache prevents another model call',async()=>{
 const {handlePhoto}=await import('../backend/src/photo.ts');
 const memory=new Map<string,unknown>();let calls=0;const now=new Date();
 const deps={store:{get:async<T>(key:string)=>memory.get(key) as T|undefined,put:async(key:string,value:unknown)=>{memory.set(key,value);}},now:()=>now,isPro:async()=>false,recognize:async()=>{calls++;return JSON.stringify({kind:'drink',drink_id:'water',amount_ml:250});}};
 const input={image_base64:'a'.repeat(40),now:now.toISOString(),timezone_offset:0,catalog:[{id:'water',name:'Water',serving:250}]};
 const first=await handlePhoto(input,deps);assert.equal(first.status,200);const result=await first.json() as {drinks:{amount_ml:number}[]};assert.equal(result.drinks[0].amount_ml,250);await handlePhoto(input,deps);assert.equal(calls,1);
 const food=await handlePhoto({...input,image_base64:'b'.repeat(40)},{...deps,recognize:async()=>JSON.stringify({kind:'food',drink_id:'water',amount_ml:250})});const body=await food.json() as {drinks:unknown[]};assert.equal(body.drinks.length,0);
});
