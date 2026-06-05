import UIKit
import React

@objc(ScreenSecure)
class ScreenSecureModule: RCTEventEmitter {
  private var screenshotObserver: NSObjectProtocol?

  @objc override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func supportedEvents() -> [String]! {
    ["UserDidTakeScreenshot"]
  }

  override func startObserving() {
    guard screenshotObserver == nil else { return }

    screenshotObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.userDidTakeScreenshotNotification,
      object: nil,
      queue: .main,
    ) { [weak self] _ in
      self?.sendEvent(withName: "UserDidTakeScreenshot", body: nil)
    }
  }

  override func stopObserving() {
    if let screenshotObserver {
      NotificationCenter.default.removeObserver(screenshotObserver)
      self.screenshotObserver = nil
    }
  }

  @objc func setSecure(
    _ enabled: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
  ) {
    // iOS uses JS blur + screenshot listener; native secure layer stays off.
    resolve(true)
  }

  @objc func isSecure(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
  ) {
    resolve(false)
  }
}
