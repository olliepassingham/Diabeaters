import Foundation

/// Shared App Group used by the main app, Lock Screen widget, and Live Activities.
enum DiabeatersAppGroup {
    static let suiteName = "group.com.passingtime.diabeaters"
    static let statusKey = "os_surface_status_v1"
    static let deepLinkScheme = "diabeaters"

    static var defaults: UserDefaults {
        UserDefaults(suiteName: suiteName) ?? .standard
    }
}

struct DiabeatersSharedStatus: Codable, Equatable {
    var title: String
    var subtitle: String
    var kind: String
    var deepLinkPath: String
    var updatedAt: String

    static let idle = DiabeatersSharedStatus(
        title: "Diabeaters",
        subtitle: "Guides, tools, and check-ins",
        kind: "idle",
        deepLinkPath: "/",
        updatedAt: ISO8601DateFormatter().string(from: Date())
    )

    static func load() -> DiabeatersSharedStatus {
        guard let data = DiabeatersAppGroup.defaults.data(forKey: DiabeatersAppGroup.statusKey) else {
            return .idle
        }
        return (try? JSONDecoder().decode(DiabeatersSharedStatus.self, from: data)) ?? .idle
    }

    func save() {
        guard let data = try? JSONEncoder().encode(self) else { return }
        DiabeatersAppGroup.defaults.set(data, forKey: DiabeatersAppGroup.statusKey)
    }

    var openURL: URL? {
        var path = deepLinkPath.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if path.isEmpty {
            return URL(string: "\(DiabeatersAppGroup.deepLinkScheme)://")
        }
        return URL(string: "\(DiabeatersAppGroup.deepLinkScheme)://\(path)")
    }
}
