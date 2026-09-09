export type Stage=0|1|2|3|4;
export const stageForProgress=(progress:number):Stage=>progress>=1?4:progress>=.95?3:progress>=.7?2:progress>=.4?1:0;
