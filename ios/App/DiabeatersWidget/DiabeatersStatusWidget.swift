import SwiftUI
import WidgetKit

struct DiabeatersStatusEntry: TimelineEntry {
    let date: Date
    let status: DiabeatersSharedStatus
}

struct DiabeatersStatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> DiabeatersStatusEntry {
        DiabeatersStatusEntry(date: Date(), status: .idle)
    }

    func getSnapshot(in context: Context, completion: @escaping (DiabeatersStatusEntry) -> Void) {
        completion(DiabeatersStatusEntry(date: Date(), status: DiabeatersSharedStatus.load()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DiabeatersStatusEntry>) -> Void) {
        let entry = DiabeatersStatusEntry(date: Date(), status: DiabeatersSharedStatus.load())
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

struct DiabeatersStatusWidgetView: View {
    var entry: DiabeatersStatusEntry

    var body: some View {
        Group {
            if #available(iOSApplicationExtension 17.0, *) {
                statusContent
                    .containerBackground(for: .widget) {
                        Color(.systemBackground)
                    }
            } else {
                statusContent
                    .background(Color(.systemBackground))
            }
        }
    }

    private var statusContent: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(entry.status.title)
                .font(.headline)
                .foregroundStyle(.primary)
                .lineLimit(2)
            Text(entry.status.subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Spacer(minLength: 0)
            Text("Diabeaters")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding(12)
    }
}

struct DiabeatersStatusWidget: Widget {
    let kind = "DiabeatersStatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DiabeatersStatusProvider()) { entry in
            DiabeatersStatusWidgetView(entry: entry)
                .widgetURL(entry.status.openURL)
        }
        .configurationDisplayName("Diabeaters status")
        .description("Shows active travel, sick day, or exercise status.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
