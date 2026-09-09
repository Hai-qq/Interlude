export const BIRD_NAME='小歇';
export const PREPARE_MS=130;
export const COMPACT_AFTER_MS=360;
export const DEPARTURE_MS=1080;
export const RETURN_TOUCH_MS=650;
export const LANDING_MS=250;
export const RETURN_MS=RETURN_TOUCH_MS+LANDING_MS;
export type BirdMotion={id:string;kind:'depart'|'return';ageMs:number;reason?:'early'|'completed'};

export type BirdHandle={release:()=>void};
