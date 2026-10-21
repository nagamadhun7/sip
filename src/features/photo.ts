import {z} from 'zod';
export const photoSchema=z.object({kind:z.enum(['drink','food','soup','unknown']),drink_id:z.string().nullable(),amount_ml:z.number().positive().max(10000).nullable()}).strict();
export function validatePhoto(value:unknown,ids:string[]){const r=photoSchema.parse(value);if(r.kind==='food'||r.kind==='unknown')return {...r,drink_id:null,amount_ml:null};if((r.kind==='drink'||r.kind==='soup')&&(!r.drink_id||!ids.includes(r.drink_id)||!r.amount_ml))return {kind:'unknown' as const,drink_id:null,amount_ml:null};return r;}
