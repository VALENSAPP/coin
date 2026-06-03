import UIKit
import React

@objc(ScreenSecureModule)
class ScreenSecureModule: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    true
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)
  }

  @objc func setSecure(
    _ enabled: Bool,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
  ) {
    DispatchQueue.main.async {
      guard let window = Self.keyWindow() else {
        reject("NO_WINDOW", "Window is not available", nil)
        return
      }

      if enabled {
        window.enableScreenSecure()
      } else {
        window.disableScreenSecure()
      }

      resolve(true)
    }
  }

  @objc func isSecure(
    _ resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock,
  ) {
    DispatchQueue.main.async {
      resolve(Self.keyWindow()?.isScreenSecureEnabled ?? false)
    }
  }
}
