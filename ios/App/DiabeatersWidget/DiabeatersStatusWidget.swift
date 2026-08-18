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

    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if #available(iOSApplicationExtension 17.0, *) {
                familyContent
                    .containerBackground(for: .widget) {
                        Color(.systemBackground)
                    }
            } else {
                familyContent
                    .background(Color(.systemBackground))
            }
        }
    }

    @ViewBuilder
    private var familyContent: some View {
        switch family {
        case .accessoryInline:
            Text(entry.status.glucoseLine ?? entry.status.title)
        case .accessoryRectangular:
            compactGlucose
        default:
            statusContent
        }
    }

    private var compactGlucose: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 4) {
                Text(entry.status.glucoseDisplay ?? entry.status.title)
                    .font(.headline.monospacedDigit())
                if !entry.status.trendArrow.isEmpty {
                    Text(entry.status.trendArrow)
                }
            }
            Text(entry.status.glucoseAgeLabel ?? entry.status.subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
    }

    private var statusContent: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let glucose = entry.status.glucoseDisplay {
                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(glucose)
                        .font(.title2.weight(.semibold).monospacedDigit())
                        .foregroundStyle(.primary)
                    if !entry.status.trendArrow.isEmpty {
                        Text(entry.status.trendArrow)
                            .font(.headline)
                            .foregroundStyle(.secondary)
                    }
                    Text(entry.status.glucoseUnitsShort)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                if let age = entry.status.glucoseAgeLabel {
                    Text(age)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
            Text(entry.status.title)
                .font(entry.status.glucoseDisplay == nil ? .headline : .subheadline)
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
        .description("Shows last glucose (when known) plus travel, sick day, or exercise.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
    }
}
