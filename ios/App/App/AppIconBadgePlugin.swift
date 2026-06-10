import Capacitor
import UIKit
import UserNotifications

/// Updates the home-screen icon badge only — does not call requestAuthorization (unlike capacitor-badge).
@objc(AppIconBadgePlugin)
public class AppIconBadgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconBadgePlugin"
    public let jsName = "AppIconBadge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setCount", returnType: CAPPluginReturnPromise),
    ]

    private func applyBadgeCount(_ count: Int) {
        // Legacy API updates SpringBoard immediately; setBadgeCount keeps Notification Center in sync.
        UIApplication.shared.applicationIconBadgeNumber = count
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { error in
                if let error = error {
                    CAPLog.print("[AppIconBadge] setBadgeCount failed:", error.localizedDescription)
                }
            }
        }
    }

    @objc func setCount(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)
        DispatchQueue.main.async {
            self.applyBadgeCount(count)
            call.resolve()
        }
    }
}
