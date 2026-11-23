// The two things TASK-70's measurements need from macOS that no shipped command
// gives: when a launched app's window stops changing on screen, and which
// processes macOS holds an app responsible for.
//
//   launchwatch watch --app <App.app> [--file <path>] [--route open|args] [--seconds 8] [--png <out.png>]
//   launchwatch procs <pid>
//
// `watch` is an outside measurement by construction — it reads the screen, not
// the app — so it applies to mallow and to every other app alike (TASK-70 forbids
// comparing a figure mallow reports about itself with one taken from outside).
//
// Build: swiftc -O scripts/bench/launchwatch.swift -o _sandbox/bench/launchwatch

import AppKit
import CoreImage
import CoreMedia
import Foundation
import ScreenCaptureKit

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(2)
}

// WebKit's WebContent / Networking / GPU processes are XPC services launchd
// starts, not children of the app, so the parent pid says nothing about whose
// they are. The responsible pid is what Activity Monitor groups them by. It is
// private API, looked up at run time so a macOS that drops it fails loudly here
// rather than at link time.
typealias ResponsibleFor = @convention(c) (pid_t) -> pid_t

func responsibleLookup() -> ResponsibleFor {
  guard let symbol = dlsym(dlopen(nil, RTLD_NOW), "responsibility_get_pid_responsible_for_pid") else {
    fail("responsibility_get_pid_responsible_for_pid is not available on this macOS")
  }
  return unsafeBitCast(symbol, to: ResponsibleFor.self)
}

func allPids() -> [pid_t] {
  let capacity = Int(proc_listallpids(nil, 0)) + 64
  var pids = [pid_t](repeating: 0, count: capacity)
  let count = Int(proc_listallpids(&pids, Int32(capacity * MemoryLayout<pid_t>.size)))
  return Array(pids.prefix(max(count, 0))).filter { $0 > 0 }
}

func procs(_ root: pid_t) {
  let responsible = responsibleLookup()
  for pid in allPids() where pid == root || responsible(pid) == root {
    print(pid)
  }
}

// A frame is kept as sums of BLOCK×BLOCK pixel blocks rather than as pixels:
// enough to tell whether any part of the window changed between two frames,
// small enough to keep every frame of a run. Dirty rects cannot answer that —
// the stream reports them for windows it leaves out of the picture too, so the
// reader's other apps redrawing behind would read as the launched app changing.
let BLOCK = 4

struct Frame {
  let seconds: Double
  let columns: Int
  let sums: [UInt32]
}

final class Recorder: NSObject, SCStreamOutput {
  private let lock = NSLock()
  private var frames: [Frame] = []
  private var lastBuffer: CVPixelBuffer?
  var keepImages = false
  var images: [Double: CGImage] = [:]

  func stream(_ stream: SCStream, didOutputSampleBuffer buffer: CMSampleBuffer, of type: SCStreamOutputType) {
    guard type == .screen,
      let attachments = CMSampleBufferGetSampleAttachmentsArray(buffer, createIfNecessary: false)
        as? [[SCStreamFrameInfo: Any]],
      let info = attachments.first,
      let rawStatus = info[.status] as? Int,
      SCFrameStatus(rawValue: rawStatus) == .complete,
      let pixels = CMSampleBufferGetImageBuffer(buffer)
    else {
      return
    }
    let frame = Frame(
      seconds: CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(buffer)),
      columns: CVPixelBufferGetWidth(pixels) / BLOCK,
      sums: blockSums(pixels))
    var image: CGImage? = nil
    if keepImages {
      let ci = CIImage(cvPixelBuffer: pixels)
      image = CIContext().createCGImage(ci, from: ci.extent)
    }
    lock.lock()
    if let image { images[frame.seconds] = image }
    frames.append(frame)
    lastBuffer = pixels
    lock.unlock()
  }

  func snapshot() -> ([Frame], CVPixelBuffer?) {
    lock.lock()
    defer { lock.unlock() }
    return (frames, lastBuffer)
  }
}

func blockSums(_ pixels: CVPixelBuffer) -> [UInt32] {
  CVPixelBufferLockBaseAddress(pixels, .readOnly)
  defer { CVPixelBufferUnlockBaseAddress(pixels, .readOnly) }
  let width = CVPixelBufferGetWidth(pixels)
  let height = CVPixelBufferGetHeight(pixels)
  let stride = CVPixelBufferGetBytesPerRow(pixels)
  let columns = width / BLOCK
  let rows = height / BLOCK
  var sums = [UInt32](repeating: 0, count: columns * rows)
  guard let base = CVPixelBufferGetBaseAddress(pixels)?.assumingMemoryBound(to: UInt8.self) else { return sums }
  for y in 0..<(rows * BLOCK) {
    let row = base + y * stride
    let rowOffset = (y / BLOCK) * columns
    for x in 0..<(columns * BLOCK) {
      let p = row + x * 4
      sums[rowOffset + x / BLOCK] &+= UInt32(p[0]) &+ UInt32(p[1]) &+ UInt32(p[2])
    }
  }
  return sums
}

func hostSeconds() -> Double {
  CMTimeGetSeconds(CMClockGetTime(CMClockGetHostTimeClock()))
}

func option(_ name: String, in args: [String]) -> String? {
  guard let index = args.firstIndex(of: name), index + 1 < args.count else { return nil }
  return args[index + 1]
}

func writePng(_ buffer: CVPixelBuffer, crop: CGRect, scale: CGFloat, to path: String) {
  let image = CIImage(cvPixelBuffer: buffer)
  // CIImage's origin is bottom-left; the window frame is in top-left screen points.
  let height = image.extent.height
  let pixels = CGRect(
    x: crop.minX * scale, y: height - crop.maxY * scale, width: crop.width * scale, height: crop.height * scale)
  let context = CIContext()
  guard let cg = context.createCGImage(image.cropped(to: pixels), from: image.cropped(to: pixels).extent) else {
    return
  }
  let rep = NSBitmapImageRep(cgImage: cg)
  try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
}

func watch(_ args: [String]) async {
  guard let app = option("--app", in: args) else { fail("watch needs --app <App.app>") }
  let file = option("--file", in: args)
  let seconds = Double(option("--seconds", in: args) ?? "8") ?? 8
  let png = option("--png", in: args)

  let content: SCShareableContent
  do {
    content = try await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: false)
  } catch {
    fail("screen capture is not permitted (System Settings → Privacy & Security → Screen Recording): \(error)")
  }
  guard let display = content.displays.first(where: { $0.displayID == CGMainDisplayID() }) else {
    fail("no main display")
  }
  // Every app running now is left out of the picture, the wallpaper's owner
  // included, so what the stream sees is the app this run launches and nothing
  // the reader had open — which is the point: no other window is ever captured.
  let filter = SCContentFilter(display: display, excludingApplications: content.applications, exceptingWindows: [])
  // Half a point per pixel: the stream scales on the GPU, and summing a quarter of
  // the points keeps the work per frame small enough not to compete with the
  // launch it is timing.
  let scale: CGFloat = 0.5
  let config = SCStreamConfiguration()
  config.width = Int(CGFloat(display.width) * scale)
  config.height = Int(CGFloat(display.height) * scale)
  config.minimumFrameInterval = CMTime(value: 1, timescale: 60)
  config.showsCursor = false
  config.queueDepth = 6

  let recorder = Recorder()
  // --frames-dir writes the window as it looked at every change, for finding out
  // what a change was; it costs a full image per frame, so it is not for timing.
  let framesDir = option("--frames-dir", in: args)
  recorder.keepImages = framesDir != nil
  let stream = SCStream(filter: filter, configuration: config, delegate: nil)
  do {
    try stream.addStreamOutput(recorder, type: .screen, sampleHandlerQueue: DispatchQueue(label: "frames"))
    try await stream.startCapture()
  } catch {
    fail("could not start the capture: \(error)")
  }
  try? await Task.sleep(nanoseconds: 300_000_000)

  let open = Process()
  open.executableURL = URL(fileURLWithPath: "/usr/bin/open")
  // `--route args` hands the file over as an argument rather than as an open
  // event, for an app that reads only its argv; which route an app took is part
  // of its result.
  let route = option("--route", in: args) ?? "open"
  open.arguments = ["-a", app] + (file.map { route == "args" ? ["--args", $0] : [$0] } ?? [])
  let launchedAt = hostSeconds()
  do {
    try open.run()
  } catch {
    fail("could not run open: \(error)")
  }
  try? await Task.sleep(nanoseconds: UInt64(seconds * 1_000_000_000))
  try? await stream.stopCapture()

  let after = try? await SCShareableContent.excludingDesktopWindows(false, onScreenWindowsOnly: true)
  let bundlePath = URL(fileURLWithPath: app).standardizedFileURL.path
  let windows = (after?.windows ?? []).filter { window in
    guard let owner = window.owningApplication,
      let running = NSRunningApplication(processIdentifier: owner.processID)
    else { return false }
    return running.bundleURL?.standardizedFileURL.path == bundlePath && window.windowLayer == 0
      && window.frame.width > 100 && window.frame.height > 100
  }
  guard let window = windows.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) else {
    fail("no window of \(app) was found on screen after \(seconds)s")
  }
  let frame = window.frame
  let (frames, last) = recorder.snapshot()
  guard let columns = frames.first?.columns, let total = frames.first?.sums.count else {
    fail("the stream delivered no frame")
  }
  let rows = total / columns
  let x0 = max(0, Int(frame.minX * scale) / BLOCK), x1 = min(columns, Int(frame.maxX * scale) / BLOCK + 1)
  let y0 = max(0, Int(frame.minY * scale) / BLOCK), y1 = min(rows, Int(frame.maxY * scale) / BLOCK + 1)
  // The area that changed between two frames, in points from the window's
  // top-left corner, or nil when nothing in the window did.
  let changed = { (a: Frame, b: Frame) -> [Int]? in
    var box: [Int]? = nil
    for y in y0..<y1 {
      let offset = y * columns
      for x in x0..<x1 where a.sums[offset + x] != b.sums[offset + x] {
        let px = Int(CGFloat(x * BLOCK) / scale - frame.minX), py = Int(CGFloat(y * BLOCK) / scale - frame.minY)
        box = box.map { [min($0[0], px), min($0[1], py), max($0[2], px), max($0[3], py)] } ?? [px, py, px, py]
      }
    }
    return box
  }
  // A frame counts as a change when the window's area differs from the frame
  // before it; the first frame after the launch is compared with the last one
  // before it, which shows the area empty.
  var times: [Double] = []
  var boxes: [[Int]] = []
  var previous = frames.last(where: { $0.seconds < launchedAt })
  for current in frames where current.seconds >= launchedAt {
    let box = previous.map({ changed($0, current) }) ?? [0, 0, Int(frame.width), Int(frame.height)]
    if let box {
      times.append(((current.seconds - launchedAt) * 1000).rounded())
      if let framesDir, let image = recorder.images[current.seconds] {
        let ci = CIImage(cgImage: image)
        let h = ci.extent.height
        let crop = CGRect(
          x: frame.minX * scale, y: h - frame.maxY * scale, width: frame.width * scale, height: frame.height * scale)
        if let cg = CIContext().createCGImage(ci.cropped(to: crop), from: ci.cropped(to: crop).extent) {
          let name = String(format: "%05d.png", Int(times.last!))
          try? NSBitmapImageRep(cgImage: cg).representation(using: .png, properties: [:])?
            .write(to: URL(fileURLWithPath: framesDir).appendingPathComponent(name))
        }
      }
      boxes.append(box)
    }
    previous = current
  }
  guard let first = times.first, let complete = times.last else {
    fail("the window never changed on screen during the run")
  }
  if let png, let last {
    writePng(last, crop: frame, scale: scale, to: png)
  }
  let pid = window.owningApplication?.processID ?? 0
  let result: [String: Any] = [
    "app": app,
    "file": file ?? NSNull(),
    "pid": pid,
    "route": route,
    "firstPaintMs": first,
    "completeMs": complete,
    // A change in the last second means the window was still moving when the
    // run ended, so completeMs is a floor rather than a measurement.
    "settled": complete < (seconds - 1) * 1000,
    "window": ["x": frame.minX, "y": frame.minY, "width": frame.width, "height": frame.height],
    "changesMs": times,
    "changedBoxes": boxes,
  ]
  let json = try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
  print(String(data: json, encoding: .utf8)!)
}

let args = Array(CommandLine.arguments.dropFirst())
switch args.first {
case "procs":
  guard args.count == 2, let pid = pid_t(args[1]) else { fail("usage: launchwatch procs <pid>") }
  procs(pid)
case "watch":
  await watch(Array(args.dropFirst()))
default:
  fail("usage: launchwatch watch --app <App.app> [--file <path>] [--seconds 8] [--png <out.png>] | procs <pid>")
}
