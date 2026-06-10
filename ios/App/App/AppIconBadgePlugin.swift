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
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(count) { error in
                if let error = error {
                    CAPLog.print("[AppIconBadge] setBadgeCount failed:", error.localizedDescription)
                }
                // Always mirror the legacy property — keeps SpringBoard in sync when only one API succeeds.
                DispatchQueue.main.async {
                    UIApplication.shared.applicationIconBadgeNumber = count
                }
            }
        } else {
            UIApplication.shared.applicationIconBadgeNumber = count
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
