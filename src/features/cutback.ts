import type {Entry,Settings} from '../lib/model.ts';import {localDay,onDay,totals} from '../lib/model.ts';
export type Cutback={started:string;baseline:number;goal:number;steps:number;completed:string[]};
export function startCutback(entries:Entry[],goal:number,now=new Date()):Cutback{
 const end=localDay(now),begin=new Date(now);begin.setDate(begin.getDate()-7);const start=localDay(begin);
 const days=[...new Set(entries.filter(e=>localDay(e.at)>=start&&localDay(e.at)<end).map(e=>localDay(e.at)))];
 const values=days.map(d=>totals(onDay(entries,d))).filter(t=>!t.missing.caffeine);
 if(!values.length)throw Error('Log at least one complete previous day first. Missing days are not counted as zero.');
 const baseline=values.reduce((a,t)=>a+t.caffeine,0)/values.length;
 if(!Number.isFinite(goal)||goal<0||goal>baseline)throw Error('Choose a goal between zero and your recorded average.');
 return {started:end,baseline,goal,steps:0,completed:[]};
}
export function advanceCutback(plan:Cutback,entries:Entry[],day=localDay()):Cutback{
 const complete=[...new Set([...plan.completed,...entries.filter(e=>localDay(e.at)>=plan.started&&localDay(e.at)<day).map(e=>localDay(e.at)).filter(d=>!totals(onDay(entries,d)).missing.caffeine)])].sort();
 return {...plan,completed:complete,steps:Math.max(plan.steps,Math.floor(complete.length/7))};
}
export function caffeineLimit(settings:Settings,entries:Entry[],day=localDay()){
 const plan=settings.cutback?advanceCutback(settings.cutback,entries,day):undefined;
 return plan?Math.min(settings.caffeine,Math.max(plan.goal,plan.baseline-plan.steps*25)):settings.caffeine;
}
