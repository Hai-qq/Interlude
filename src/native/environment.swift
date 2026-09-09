import AppKit
import CoreGraphics
import CoreAudio
import IOKit.pwr_mgt

// Public state only. No event taps, audio samples, application-window titles, or screen pixels.
// Only the system Control Center indicator identifier is inspected for capture suppression.
NSApplication.shared.setActivationPolicy(.accessory)
var previousFront: pid_t = 0
var switchedAt: TimeInterval = 0
var displaySleeping = false
var last = ""
func runningAudio(_ selector: AudioObjectPropertySelector) -> Bool {
 var address = AudioObjectPropertyAddress(mSelector: selector, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
 var device = AudioObjectID(0), size = UInt32(MemoryLayout<AudioObjectID>.size)
 guard AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject), &address, 0, nil, &size, &device) == noErr, device != 0 else { return false }
 address = AudioObjectPropertyAddress(mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
 var active: UInt32 = 0; size = UInt32(MemoryLayout<UInt32>.size)
 return AudioObjectGetPropertyData(device, &address, 0, nil, &size, &active) == noErr && active != 0
}
func audioNumber(_ object:AudioObjectID,_ selector:AudioObjectPropertySelector) -> UInt32 {
 var address=AudioObjectPropertyAddress(mSelector:selector,mScope:kAudioObjectPropertyScopeGlobal,mElement:kAudioObjectPropertyElementMain)
 var value:UInt32=0,size=UInt32(MemoryLayout<UInt32>.size)
 if AudioObjectGetPropertyData(object,&address,0,nil,&size,&value) != noErr { return 0 };return value
}
func belongsToForeground(_ pid:pid_t,_ front:pid_t) -> Bool {
 var current=pid
 for _ in 0..<5 {
  if current==front { return true };if current<=1 { return false }
  var info=proc_bsdinfo()
  guard proc_pidinfo(current,PROC_PIDTBSDINFO,0,&info,Int32(MemoryLayout<proc_bsdinfo>.size))>0 else{return false}
  current=pid_t(info.pbi_ppid)
 }
 return false
}
func audioActivity(_ front:pid_t) -> (any:Bool,foreground:Bool) {
 if #available(macOS 14.2,*) {
  var address=AudioObjectPropertyAddress(mSelector:kAudioHardwarePropertyProcessObjectList,mScope:kAudioObjectPropertyScopeGlobal,mElement:kAudioObjectPropertyElementMain)
  var size:UInt32=0
  if AudioObjectGetPropertyDataSize(AudioObjectID(kAudioObjectSystemObject),&address,0,nil,&size)==noErr && size>0 {
   var objects=[AudioObjectID](repeating:0,count:Int(size)/MemoryLayout<AudioObjectID>.size)
   if AudioObjectGetPropertyData(AudioObjectID(kAudioObjectSystemObject),&address,0,nil,&size,&objects)==noErr {
    var any=false,foreground=false
    for object in objects {
     let output=audioNumber(object,kAudioProcessPropertyIsRunningOutput)>0,input=audioNumber(object,kAudioProcessPropertyIsRunningInput)>0
     any = any || output || input
     if output && belongsToForeground(pid_t(audioNumber(object,kAudioProcessPropertyPID)),front){foreground=true}
    }
    return (any,foreground)
   }
  }
 }
 // On older systems global audio can establish presence, but cannot quiet an unrelated foreground app.
 return (runningAudio(kAudioHardwarePropertyDefaultOutputDevice) || runningAudio(kAudioHardwarePropertyDefaultInputDevice),false)
}
func hasCaptureAssertion() -> Bool {
 var ref: Unmanaged<CFDictionary>?
 guard IOPMCopyAssertionsByProcess(&ref) == kIOReturnSuccess, let raw = ref?.takeRetainedValue() as? [AnyHashable: Any] else { return false }
 for value in raw.values {
  guard let assertions = value as? [[String: Any]] else { continue }
  for assertion in assertions {
   guard (assertion[kIOPMAssertionLevelKey] as? Int ?? 1) != 0 else { continue }
   let name = (assertion[kIOPMAssertionNameKey] as? String ?? "").lowercased()
   if name.contains("screencapture") || name.contains("screen capture") || name.contains("screen recording") || name.contains("screen sharing") || name.contains("screensharing") || name.contains("display stream") || name.contains("cgdisplaystream") { return true }
  }
 }
 return false
}
func sample() {
 autoreleasepool {
  let front = NSWorkspace.shared.frontmostApplication
  if let pid = front?.processIdentifier, pid != previousFront { previousFront = pid; switchedAt = ProcessInfo.processInfo.systemUptime }
  let displays = NSScreen.screens
  let awake = !displaySleeping && displays.contains { s in
   guard let n = s.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { return false }
   return CGDisplayIsAsleep(n.uint32Value) == 0
  }
  let windows = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
  let controlCenter = Set(NSWorkspace.shared.runningApplications.filter { $0.bundleIdentifier == "com.apple.controlcenter" }.map { $0.processIdentifier })
  // This system indicator covers sharing/recording and may also appear for video calls.
  // Hide conservatively for either, rather than claim that all global capture APIs are observable.
  let captureIndicator = windows.contains { w in
   guard controlCenter.contains(pid_t(w[kCGWindowOwnerPID as String] as? Int ?? 0)) else { return false }
   let name = w[kCGWindowName as String] as? String ?? ""
   return name == "AudioVideoModule" || name == "ScreenSharing" || name == "Screen Recording"
  }
  let fullscreen = windows.contains { w in
   guard (w[kCGWindowOwnerPID as String] as? Int) == Int(previousFront), (w[kCGWindowLayer as String] as? Int) == 0,
    let b = w[kCGWindowBounds as String] as? [String: Any], let rect = CGRect(dictionaryRepresentation: b as CFDictionary) else { return false }
   return displays.contains { s in
    guard let n = s.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber else { return false }
    let d = CGDisplayBounds(n.uint32Value)
    // Native fullscreen windows on a notched display start below its safe-area inset.
    let topInset = max(CGFloat(3), s.safeAreaInsets.top)
    return abs(rect.minX-d.minX)<3 && abs(rect.width-d.width)<3 && rect.minY>=d.minY-3 && rect.minY-d.minY<=topInset+3 && abs(rect.maxY-d.maxY)<3
   }
  }
  let category = front?.bundleURL.flatMap { Bundle(url:$0)?.object(forInfoDictionaryKey:"LSApplicationCategoryType") as? String } ?? ""
  let media = audioActivity(previousFront)
  let object: [String: Any] = ["screenAwake":awake,"mediaActive":media.any,"appSwitch":ProcessInfo.processInfo.systemUptime-switchedAt<10,
   "captureActive":captureIndicator || hasCaptureAssertion(),"fullscreenQuiet":fullscreen && (media.foreground || category.contains("games") || category=="public.app-category.video"),
   "reducedMotion":NSWorkspace.shared.accessibilityDisplayShouldReduceMotion]
  if let data = try? JSONSerialization.data(withJSONObject:object,options:[.sortedKeys]), let line = String(data:data,encoding:.utf8), line != last {
   last=line;FileHandle.standardOutput.write(Data((line+"\n").utf8))
  }
 }
}
let nc = NSWorkspace.shared.notificationCenter
nc.addObserver(forName:NSWorkspace.screensDidSleepNotification,object:nil,queue:.main) { _ in displaySleeping=true; sample() }
nc.addObserver(forName:NSWorkspace.screensDidWakeNotification,object:nil,queue:.main) { _ in displaySleeping=false; sample() }
nc.addObserver(forName:NSWorkspace.didActivateApplicationNotification,object:nil,queue:.main) { _ in sample() }
// A small native poll notices playback/fullscreen/capture changes even without input.
Timer.scheduledTimer(withTimeInterval:2,repeats:true) { _ in sample() }
sample();RunLoop.main.run()
