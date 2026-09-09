import {z} from 'zod';
export const simpleSettingsSchema=z.object({
 schemaVersion:z.literal(4),workMinutes:z.number().int().min(15).max(60),restMinutes:z.number().int().min(1).max(10),
 openAtLogin:z.boolean(),theme:z.enum(['system','light','dark']),placement:z.enum(['top','corner'])
}).strict();
export type SimpleSettings=z.infer<typeof simpleSettingsSchema>;
export const simpleDefaults:SimpleSettings={schemaVersion:4,workMinutes:30,restMinutes:3,openAtLogin:false,theme:'system',placement:'top'};
export const simpleCommand=z.discriminatedUnion('type',[
 z.object({type:z.enum(['start','return','later','snooze','onboard','pause','resume','skip']),id:z.string().uuid()}).strict(),
 z.object({type:z.literal('settings'),id:z.string().uuid(),settings:simpleSettingsSchema}).strict()
]);
export type SimpleCommand=z.infer<typeof simpleCommand>;
