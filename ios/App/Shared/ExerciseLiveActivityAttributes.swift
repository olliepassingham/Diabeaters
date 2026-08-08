import ActivityKit
import Foundation

struct ExerciseLiveActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var exerciseLabel: String
        var phase: String
        var startedAtIso: String?
        var deepLinkPath: String
    }

    var sessionId: String
}
