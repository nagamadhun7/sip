import type {Drink,Entry,Settings} from '../lib/model.ts';import {localDay,onDay} from '../lib/model.ts';
export function alcoholAllowed(s:Settings){return (s.profile?.age??0)>=18&&s.makerProfile?.alcohol_tracking===true;}
export function isAlcohol(d:Drink){return (d.alcohol_abv??0)>0||d.recipe?.ingredients.some(p=>/^(beer|wine|vodka|rum|gin|whiskey|tequila)$/.test(p.ingredient_id))||/\b(beer|wine|cocktail|vodka|whisk[ey]+|rum|tequila|gin)\b/i.test(d.name);}
export function standardDrinks(ml:number,abv:number,grams=14){if(!Number.isFinite(ml)||ml<0||!Number.isFinite(abv)||abv<0||abv>100||!Number.isFinite(grams)||grams<=0)throw Error('Check volume, ABV and standard drink definition.');return ml*abv/100*0.789/grams;}
export function alcoholWeek(entries:Entry[],s:Settings,now=new Date()){
 const monday=new Date(now);monday.setDate(monday.getDate()-(monday.getDay()+6)%7);const start=localDay(monday),end=localDay(now),rows=entries.filter(e=>localDay(e.at)>=start&&localDay(e.at)<=end);
 const today=onDay(rows,end).filter(e=>isAlcohol(e.drink)),unknown=today.filter(e=>e.drink.alcohol_abv==null).length;
 const count=today.reduce((n,e)=>n+(e.drink.alcohol_abv==null?0:standardDrinks(e.ml,e.drink.alcohol_abv,s.alcohol?.grams??14)),0);
 const confirmed=[...new Set(s.alcohol?.freeDays??[])].filter(d=>d>=start&&d<=end&&!onDay(rows,d).some(e=>isAlcohol(e.drink)));
 const last=today.sort((a,b)=>b.at.localeCompare(a.at))[0];
 return {count,unknown,freeDays:confirmed.length,nudge:!!last&&!rows.some(e=>e.drink.id==='water'&&e.at>last.at)};
}
export function requireAlcoholAccess(entries:Entry[],s:Settings){if(!alcoholAllowed(s)&&entries.some(e=>isAlcohol(e.drink)))throw Error('Alcohol tracking is available only for adults who have enabled it.');}
