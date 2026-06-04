import ObjectiveC
import UIKit

private let secureTextFieldTag = 0x5EC0DE

extension UIWindow {
  private static var originalWindowSuperlayerKey: UInt8 = 0

  private var originalWindowSuperlayer: CALayer? {
    get {
      objc_getAssociatedObject(self, &UIWindow.originalWindowSuperlayerKey) as? CALayer
    }
    set {
      objc_setAssociatedObject(
        self,
        &UIWindow.originalWindowSuperlayerKey,
        newValue,
        .OBJC_ASSOCIATION_RETAIN_NONATOMIC,
      )
    }
  }

  var isScreenSecureEnabled: Bool {
    viewWithTag(secureTextFieldTag) != nil
  }

  func enableScreenSecure() {
    guard viewWithTag(secureTextFieldTag) == nil else { return }

    let field = UITextField()
    field.tag = secureTextFieldTag
    field.isSecureTextEntry = true
    field.isUserInteractionEnabled = false
    field.translatesAutoresizingMaskIntoConstraints = false

    addSubview(field)
    NSLayoutConstraint.activate([
      field.centerXAnchor.constraint(equalTo: centerXAnchor),
      field.centerYAnchor.constraint(equalTo: centerYAnchor),
      field.widthAnchor.constraint(equalToConstant: 1),
      field.heightAnchor.constraint(equalToConstant: 1),
    ])
    layoutIfNeeded()

    originalWindowSuperlayer = layer.superlayer
    layer.superlayer?.addSublayer(field.layer)
    if let secureContainer = field.layer.sublayers?.last {
      secureContainer.addSublayer(layer)
    } else if let secureContainer = field.layer.sublayers?.first {
      secureContainer.addSublayer(layer)
    }
  }

  func disableScreenSecure() {
    guard let field = viewWithTag(secureTextFieldTag) else { return }

    layer.removeFromSuperlayer()
    if let originalSuperlayer = originalWindowSuperlayer {
      originalSuperlayer.addSublayer(layer)
    }

    field.removeFromSuperview()
    originalWindowSuperlayer = nil
  }
}
