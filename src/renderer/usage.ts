import type {BirdMotion} from '../shared/bird';

export type Data=ReturnType<import('../main/simple-cycle').SimpleCycle['snapshot']>&{panelPage:'companion'|'settings';panelCompact:boolean;birdMotion:BirdMotion|null;onboarded:boolean;warning:string;theme:string;summary:{averageRises:number;longestSitMinutes:number;days:number}};
export const time=(ms:number)=>{const seconds=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`};
export const unavailableReason='当前屏幕休眠、会话锁定或长时间无活动，回到电脑后可开始休息。';

