import UIKit
import Capacitor
import WebKit
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    /// Safari → Develop only lists WKWebViews when `isInspectable` is true (iOS 16.4+).
    /// App Store / release binaries often omit this; this runs only in **Debug** Xcode installs.
    private func scheduleInspectableWebViewRetries() {
        #if DEBUG
        guard #available(iOS 16.4, *) else { return }
        Self.markWebViewInspectableIfPresent()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            Self.markWebViewInspectableIfPresent()
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            Self.markWebViewInspectableIfPresent()
        }
        #endif
    }

    private static func markWebViewInspectableIfPresent() {
        guard #available(iOS 16.4, *) else { return }
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows where window.isKeyWindow {
                if let webView = findWKWebView(in: window.rootViewController?.view) {
                    webView.isInspectable = true
                    return
                }
            }
        }
    }

    private static func findWKWebView(in root: UIView?) -> WKWebView? {
        guard let root else { return nil }
        if let w = root as? WKWebView { return w }
        for sub in root.subviews {
            if let w = findWKWebView(in: sub) { return w }
        }
        return nil
    }

    /// Reset stale SpringBoard badge before JS loads (APNs can leave a phantom count after reinstall).
    private func clearApplicationIconBadge() {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        if #available(iOS 16.0, *) {
            UNUserNotificationCenter.current().setBadgeCount(0) { _ in
                DispatchQueue.main.async {
                    UIApplication.shared.applicationIconBadgeNumber = 0
                }
            }
        } else {
            UIApplication.shared.applicationIconBadgeNumber = 0
        }
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Keep local Capacitor plugins in the Release binary (prevents dead-code strip).
        _ = AppIconBadgePlugin.self
        _ = NotificationSettingsPlugin.self
        _ = HealthAuthorizationPlugin.self

        // Categories must exist before remote pushes arrive (IDs match JS + APNs aps.category).
        registerNotificationActionCategories()
        clearApplicationIconBadge()
        DispatchQueue.main.async {
            application.registerForRemoteNotifications()
        }
        return true
    }

    private func registerNotificationActionCategories() {
        let hypoOk = UNNotificationAction(
            identifier: "hypo_check_in_ok",
            title: "I'm OK",
            options: []
        )
        let hypoCategory = UNNotificationCategory(
            identifier: "hypo_check_in",
            actions: [hypoOk],
            intentIdentifiers: [],
            options: []
        )

        let medTaken = UNNotificationAction(
            identifier: "sick_day_med_taken",
            title: "Taken",
            options: []
        )
        let medCategory = UNNotificationCategory(
            identifier: "sick_day_med_reminder",
            actions: [medTaken],
            intentIdentifiers: [],
            options: []
        )

        let bedtimeOpen = UNNotificationAction(
            identifier: "bedtime_open_guide",
            title: "Open guide",
            options: [.foreground]
        )
        let bedtimeSkip = UNNotificationAction(
            identifier: "bedtime_not_tonight",
            title: "Not tonight",
            options: []
        )
        let bedtimeCategory = UNNotificationCategory(
            identifier: "bedtime_reminder",
            actions: [bedtimeOpen, bedtimeSkip],
            intentIdentifiers: [],
            options: []
        )

        UNUserNotificationCenter.current().setNotificationCategories([
            hypoCategory,
            medCategory,
            bedtimeCategory,
        ])
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        clearApplicationIconBadge()
        scheduleInspectableWebViewRetries()
        application.registerForRemoteNotifications()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
