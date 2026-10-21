import type {Settings} from '../lib/model.ts';
import {localDay} from '../lib/model.ts';
export const situations=['workout','hot-day','flight','sick-day','fasting'] as const;
export type Situation={mode:typeof situations[number];day:string;extra_ml:number;interval_minutes:number;start:string;end:string};
export const clockMinutes=(s:string)=>{if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))throw Error('Use HH:MM in 24-hour time.');const [h,m]=s.split(':').map(Number);return h*60+m;};
export function validateSituation(s:Situation){if(!situations.includes(s.mode)||!Number.isFinite(s.extra_ml)||s.extra_ml<0||s.extra_ml>3000||!Number.isInteger(s.interval_minutes)||s.interval_minutes<15||s.interval_minutes>1440)throw Error('Set extra water from 0–3,000 ml and reminders from 15–1,440 minutes.');if(clockMinutes(s.start)===clockMinutes(s.end))throw Error('Choose a non-empty eating window.');}
export function activeSituation(settings:Settings,day=localDay()){const s=settings.situation;return s&&(s.mode==='fasting'||s.day===day)?s:undefined;}
export function situationTarget(settings:Settings,day=localDay()){return settings.water+(activeSituation(settings,day)?.extra_ml??0);}
export function inEatingWindow(at:Date,s:Situation){const n=at.getHours()*60+at.getMinutes(),start=clockMinutes(s.start),end=clockMinutes(s.end);return start<end?n>=start&&n<end:n>=start||n<end;}
export function situationReason(s:Situation){return `${s.mode.replace('-',' ')}: your chosen ${s.extra_ml} ml adjustment is added to your usual goal; reminders are spaced ${s.interval_minutes} minutes apart.${s.mode==='fasting'?` Water reminders stay within ${s.start}–${s.end}, your eating window.`:' This mode applies today.'} These are your tracking preferences.`;}
