import ActivityKit
import Capacitor
import Foundation
import WidgetKit

/// Writes Lock Screen / Home widget status into the App Group and drives Exercise Live Activities.
@objc(OsSurfacesPlugin)
public class OsSurfacesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "OsSurfacesPlugin"
    public let jsName = "OsSurfaces"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "syncStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startExerciseLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateExerciseLiveActivity", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endExerciseLiveActivity", returnType: CAPPluginReturnPromise),
    ]

    private static let liveActivityIdKey = "exercise_live_activity_id"

    public override func load() {
        OsSurfacesWatchBridge.shared.plugin = self
        OsSurfacesWatchBridge.shared.activate()
    }

    @objc func syncStatus(_ call: CAPPluginCall) {
        let status = DiabeatersSharedStatus(
            title: call.getString("title") ?? "Diabeaters",
            subtitle: call.getString("subtitle") ?? "",
            kind: call.getString("kind") ?? "idle",
            deepLinkPath: call.getString("deepLinkPath") ?? "/",
            updatedAt: call.getString("updatedAt") ?? ISO8601DateFormatter().string(from: Date()),
            glucoseValue: call.getDouble("glucoseValue"),
            glucoseUnits: nonempty(call.getString("glucoseUnits")),
            glucoseTrend: nonempty(call.getString("glucoseTrend")),
            glucoseRecordedAt: nonempty(call.getString("glucoseRecordedAt"))
        )
        status.save()
        WidgetCenter.shared.reloadAllTimelines()
        OsSurfacesWatchBridge.shared.pushStatus(status)
        call.resolve()
    }

    @objc func startExerciseLiveActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false])
            return
        }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            call.resolve(["ok": false])
            return
        }

        let label = call.getString("exerciseLabel") ?? "Exercise"
        let phase = call.getString("phase") ?? "active"
        let startedAt = call.getString("startedAtIso")
        let deepLink = call.getString("deepLinkPath") ?? "/scenarios/exercise"
        let state = ExerciseLiveActivityAttributes.ContentState(
            exerciseLabel: label,
            phase: phase,
            startedAtIso: startedAt,
            deepLinkPath: deepLink
        )

        // Update existing activity when possible.
        if let existing = Activity<ExerciseLiveActivityAttributes>.activities.first {
            Task {
                await existing.update(ActivityContent(state: state, staleDate: nil))
                call.resolve(["ok": true])
            }
            return
        }

        let attributes = ExerciseLiveActivityAttributes(sessionId: UUID().uuidString)
        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
            DiabeatersAppGroup.defaults.set(activity.id, forKey: Self.liveActivityIdKey)
            call.resolve(["ok": true])
        } catch {
            CAPLog.print("[OsSurfaces] Live Activity start failed:", error.localizedDescription)
            call.resolve(["ok": false])
        }
    }

    @objc func updateExerciseLiveActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false])
            return
        }
        let label = call.getString("exerciseLabel") ?? "Exercise"
        let phase = call.getString("phase") ?? "active"
        let startedAt = call.getString("startedAtIso")
        let deepLink = call.getString("deepLinkPath") ?? "/scenarios/exercise"
        let state = ExerciseLiveActivityAttributes.ContentState(
            exerciseLabel: label,
            phase: phase,
            startedAtIso: startedAt,
            deepLinkPath: deepLink
        )
        Task {
            for activity in Activity<ExerciseLiveActivityAttributes>.activities {
                await activity.update(ActivityContent(state: state, staleDate: nil))
            }
            call.resolve(["ok": !Activity<ExerciseLiveActivityAttributes>.activities.isEmpty])
        }
    }

    @objc func endExerciseLiveActivity(_ call: CAPPluginCall) {
        guard #available(iOS 16.2, *) else {
            call.resolve(["ok": false])
            return
        }
        Task {
            for activity in Activity<ExerciseLiveActivityAttributes>.activities {
                let finalState = activity.content.state
                await activity.end(
                    ActivityContent(state: finalState, staleDate: nil),
                    dismissalPolicy: .immediate
                )
            }
            DiabeatersAppGroup.defaults.removeObject(forKey: Self.liveActivityIdKey)
            call.resolve(["ok": true])
        }
    }

    private func nonempty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }
}
