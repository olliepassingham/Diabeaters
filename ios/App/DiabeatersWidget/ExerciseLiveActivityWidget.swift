import ActivityKit
import SwiftUI
import WidgetKit

struct ExerciseLiveActivityView: View {
    let context: ActivityViewContext<ExerciseLiveActivityAttributes>

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(context.state.exerciseLabel)
                    .font(.headline)
                    .lineLimit(1)
                Text(phaseLabel(context.state.phase))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Text("Open")
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color.accentColor.opacity(0.15), in: Capsule())
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .activityBackgroundTint(Color(.secondarySystemBackground))
    }

    private func phaseLabel(_ phase: String) -> String {
        switch phase {
        case "pre": return "Getting ready"
        case "recovery": return "Recovery"
        default: return "In progress"
        }
    }
}

struct ExerciseLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: ExerciseLiveActivityAttributes.self) { context in
            ExerciseLiveActivityView(context: context)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(context.state.exerciseLabel)
                        .font(.headline)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(phaseShort(context.state.phase))
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Tap to open Diabeaters")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            } compactLeading: {
                Image(systemName: "figure.run")
            } compactTrailing: {
                Text(phaseShort(context.state.phase))
                    .font(.caption2)
            } minimal: {
                Image(systemName: "figure.run")
            }
        }
    }

    private func phaseShort(_ phase: String) -> String {
        switch phase {
        case "pre": return "Prep"
        case "recovery": return "Rec"
        default: return "Go"
        }
    }
}
