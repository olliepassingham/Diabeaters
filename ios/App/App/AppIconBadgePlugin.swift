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

    @objc func setCount(_ call: CAPPluginCall) {
        let count = max(0, call.getInt("count") ?? 0)
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                UNUserNotificationCenter.current().setBadgeCount(count) { error in
                    if let error = error {
                        call.reject(error.localizedDescription)
                    } else {
                        call.resolve()
                    }
                }
            } else {
                UIApplication.shared.applicationIconBadgeNumber = count
                call.resolve()
            }
        }
    }
}
