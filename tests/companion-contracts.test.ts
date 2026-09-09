import {it,expect} from 'vitest';
import {stageForProgress} from '../src/shared/companion';
it('stage mapping changes exactly at 40%, 70%, 95%, and the deadline',()=>{
 expect([-1,0,.399999,.4,.699999,.7,.949999,.95,.999999,1,1.5].map(stageForProgress)).toEqual([0,0,0,1,1,2,2,3,3,4,4]);
});
