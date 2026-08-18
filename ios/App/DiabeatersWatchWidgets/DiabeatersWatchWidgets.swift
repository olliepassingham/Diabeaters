import SwiftUI
import WidgetKit

struct WatchGlanceEntry: TimelineEntry {
    let date: Date
    let status: DiabeatersSharedStatus
}

struct WatchGlanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> WatchGlanceEntry {
        WatchGlanceEntry(date: Date(), status: .idle)
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchGlanceEntry) -> Void) {
        completion(WatchGlanceEntry(date: Date(), status: DiabeatersSharedStatus.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchGlanceEntry>) -> Void) {
        let entry = WatchGlanceEntry(date: Date(), status: DiabeatersSharedStatus.load())
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct WatchGlanceView: View {
    var entry: WatchGlanceEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if #available(watchOS 10.0, *) {
                familyContent
                    .containerBackground(for: .widget) {
                        AccessoryWidgetBackground()
                    }
            } else {
                familyContent
            }
        }
    }

    @ViewBuilder
    private var familyContent: some View {
        switch family {
        case .accessoryInline:
            Text(entry.status.glucoseLine ?? "Diabeaters")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(entry.status.glucoseDisplay ?? "—")
                        .font(.headline.monospacedDigit())
                    if !entry.status.trendArrow.isEmpty {
                        Text(entry.status.trendArrow)
                    }
                }
                Text(entry.status.glucoseAgeLabel ?? "From phone")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        case .accessoryCorner:
            Text(entry.status.glucoseDisplay ?? "—")
                .font(.headline.monospacedDigit())
                .widgetLabel {
                    Text(entry.status.trendArrow.isEmpty ? (entry.status.glucoseAgeLabel ?? "BG") : entry.status.trendArrow)
                }
        default:
            ZStack {
                AccessoryWidgetBackground()
                VStack(spacing: 0) {
                    Text(entry.status.glucoseDisplay ?? "—")
                        .font(.headline.monospacedDigit())
                    if !entry.status.trendArrow.isEmpty {
                        Text(entry.status.trendArrow)
                            .font(.caption2)
                    }
                }
            }
        }
    }
}

struct DiabeatersWatchGlanceWidget: Widget {
    let kind = "DiabeatersWatchGlance"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WatchGlanceProvider()) { entry in
            WatchGlanceView(entry: entry)
        }
        .configurationDisplayName("Diabeaters")
        .description("Last glucose from the phone. Not a CGM alarm.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

@main
struct DiabeatersWatchWidgets: WidgetBundle {
    var body: some Widget {
        DiabeatersWatchGlanceWidget()
    }
}
