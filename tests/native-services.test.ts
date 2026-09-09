import {it,expect,vi,afterEach} from 'vitest';import {EventEmitter} from 'node:events';
const mocks=vi.hoisted(()=>({spawn:vi.fn()}));vi.mock('node:child_process',()=>({spawn:mocks.spawn}));
import {DesktopEnvironment} from '../src/main/environment';
const child=()=>Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:{resume:vi.fn()},kill:vi.fn()});
const signals={screenAwake:true,mediaActive:false,appSwitch:false,captureActive:false,fullscreenQuiet:false,reducedMotion:false};
afterEach(()=>{vi.useRealTimers();mocks.spawn.mockReset()});
it('native signal streams handle split lines and reject non-booleans and unrelated data',()=>{
 const c=child(),changed=vi.fn();mocks.spawn.mockReturnValue(c);const env=new DesktopEnvironment(changed);env.start();
 c.stdout.emit('data','{"screenAwake":');c.stdout.emit('data','"yes"}\nnot json\n');expect(changed).not.toHaveBeenCalled();
 const line=JSON.stringify({...signals,mediaActive:true,unrelated:'discarded'});c.stdout.emit('data',line.slice(0,20));c.stdout.emit('data',line.slice(20)+'\n');
 expect(env.value).toEqual({...signals,mediaActive:true});expect(changed).toHaveBeenCalledTimes(1);env.stop();
});
it('a crashed helper keeps capture suppression, clears stale presence and restarts once; stop cancels retries',()=>{
 vi.useFakeTimers();const c=child(),next=child();mocks.spawn.mockReturnValueOnce(c).mockReturnValueOnce(next);const env=new DesktopEnvironment(()=>{});env.start();
 c.stdout.emit('data',JSON.stringify({...signals,captureActive:true,mediaActive:true})+'\n');c.emit('close');
 expect(env.value).toEqual({captureActive:true,fullscreenQuiet:false,reducedMotion:false});vi.advanceTimersByTime(10000);expect(mocks.spawn).toHaveBeenCalledTimes(2);
 next.emit('close');env.stop();vi.advanceTimersByTime(20000);expect(mocks.spawn).toHaveBeenCalledTimes(2);
});
it('oversized malformed native output is discarded and a subsequent valid line still works',()=>{
 const c=child();mocks.spawn.mockReturnValue(c);const env=new DesktopEnvironment(()=>{});env.start();
 c.stdout.emit('data','x'.repeat(17000));c.stdout.emit('data',JSON.stringify(signals)+'\n');expect(env.value).toEqual(signals);env.stop();
});
