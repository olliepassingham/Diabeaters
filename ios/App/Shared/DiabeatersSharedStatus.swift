import Foundation

/// Shared App Group used by the main app, Lock Screen widget, Live Activities, and (on watchOS) complications.
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
    /// Last known glucose in the user's display units. Planning glance only — not a CGM alarm.
    var glucoseValue: Double?
    var glucoseUnits: String?
    var glucoseTrend: String?
    var glucoseRecordedAt: String?

    static let idle = DiabeatersSharedStatus(
        title: "Diabeaters",
        subtitle: "Guides, tools, and check-ins",
        kind: "idle",
        deepLinkPath: "/",
        updatedAt: ISO8601DateFormatter().string(from: Date()),
        glucoseValue: nil,
        glucoseUnits: nil,
        glucoseTrend: nil,
        glucoseRecordedAt: nil
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

    var glucoseDisplay: String? {
        guard let value = glucoseValue, let units = glucoseUnits, !units.isEmpty else { return nil }
        if units == "mg/dL" {
            return "\(Int(value.rounded()))"
        }
        return String(format: "%.1f", value)
    }

    var glucoseUnitsShort: String {
        guard let units = glucoseUnits else { return "" }
        return units == "mg/dL" ? "mg/dL" : "mmol/L"
    }

    var glucoseAgeMinutes: Int? {
        guard let iso = glucoseRecordedAt, let date = Self.parseIsoDate(iso) else { return nil }
        let mins = Int(Date().timeIntervalSince(date) / 60)
        return max(0, mins)
    }

    var glucoseAgeLabel: String? {
        guard let mins = glucoseAgeMinutes else { return nil }
        if mins < 1 { return "just now" }
        if mins < 60 { return "\(mins)m ago" }
        let hours = mins / 60
        return hours == 1 ? "1h ago" : "\(hours)h ago"
    }

    var glucoseLine: String? {
        guard let display = glucoseDisplay else { return nil }
        let age = glucoseAgeLabel.map { " · \($0)" } ?? ""
        return "\(display) \(glucoseUnitsShort)\(age)"
    }

    var trendArrow: String {
        switch glucoseTrend {
        case "rising": return "↑"
        case "falling": return "↓"
        case "flat": return "→"
        default: return ""
        }
    }

    func asWatchPayload() -> [String: Any] {
        var payload: [String: Any] = [
            "title": title,
            "subtitle": subtitle,
            "kind": kind,
            "deepLinkPath": deepLinkPath,
            "updatedAt": updatedAt,
        ]
        if let glucoseValue { payload["glucoseValue"] = glucoseValue }
        if let glucoseUnits { payload["glucoseUnits"] = glucoseUnits }
        if let glucoseTrend { payload["glucoseTrend"] = glucoseTrend }
        if let glucoseRecordedAt { payload["glucoseRecordedAt"] = glucoseRecordedAt }
        return payload
    }

    static func fromWatchPayload(_ payload: [String: Any]) -> DiabeatersSharedStatus {
        DiabeatersSharedStatus(
            title: payload["title"] as? String ?? idle.title,
            subtitle: payload["subtitle"] as? String ?? idle.subtitle,
            kind: payload["kind"] as? String ?? idle.kind,
            deepLinkPath: payload["deepLinkPath"] as? String ?? idle.deepLinkPath,
            updatedAt: payload["updatedAt"] as? String ?? idle.updatedAt,
            glucoseValue: double(from: payload["glucoseValue"]),
            glucoseUnits: nonempty(payload["glucoseUnits"] as? String),
            glucoseTrend: nonempty(payload["glucoseTrend"] as? String),
            glucoseRecordedAt: nonempty(payload["glucoseRecordedAt"] as? String)
        )
    }

    private static func nonempty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }

    private static func double(from value: Any?) -> Double? {
        if let number = value as? Double { return number }
        if let number = value as? NSNumber { return number.doubleValue }
        if let number = value as? Int { return Double(number) }
        return nil
    }

    private static func parseIsoDate(_ iso: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFraction.date(from: iso) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: iso)
    }
}
