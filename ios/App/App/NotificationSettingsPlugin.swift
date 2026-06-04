import Capacitor
import UIKit
import UserNotifications

/// Exposes iOS notification authorization + per-channel settings (lock screen, sounds, banners).
@objc(NotificationSettingsPlugin)
public class NotificationSettingsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NotificationSettingsPlugin"
    public let jsName = "NotificationSettings"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSettings", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAppSettings", returnType: CAPPluginReturnPromise),
    ]

    @objc func getSettings(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            var result: [String: Any] = [
                "authorizationStatus": Self.statusName(settings.authorizationStatus),
            ]
            result["alertSetting"] = Self.settingName(settings.alertSetting)
            result["soundSetting"] = Self.settingName(settings.soundSetting)
            result["badgeSetting"] = Self.settingName(settings.badgeSetting)
            result["lockScreenSetting"] = Self.settingName(settings.lockScreenSetting)
            result["notificationCenterSetting"] = Self.settingName(settings.notificationCenterSetting)
            if #available(iOS 15.0, *) {
                result["scheduledDeliverySetting"] = Self.settingName(settings.scheduledDeliverySetting)
            }
            call.resolve(result)
        }
    }

    @objc func openAppSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("settings_url_unavailable")
                return
            }
            UIApplication.shared.open(url, options: [:]) { _ in
                call.resolve()
            }
        }
    }

    private static func statusName(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .denied: return "denied"
        case .authorized: return "authorized"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        @unknown default: return "unknown"
        }
    }

    private static func settingName(_ setting: UNNotificationSetting) -> String {
        switch setting {
        case .notSupported: return "notSupported"
        case .disabled: return "disabled"
        case .enabled: return "enabled"
        @unknown default: return "unknown"
        }
    }
}
