import SwiftUI
import WatchKit

struct ContentView: View {
    @ObservedObject private var store = WatchStatusStore.shared
    @State private var sentConfirmation = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 6) {
                    Text(store.status.glucoseDisplay ?? "—")
                        .font(.system(size: 44, weight: .semibold, design: .rounded).monospacedDigit())
                    if !store.status.trendArrow.isEmpty {
                        Text(store.status.trendArrow)
                            .font(.title2)
                    }
                }
                if !store.status.glucoseUnitsShort.isEmpty {
                    Text(store.status.glucoseUnitsShort)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(store.status.glucoseAgeLabel ?? "No reading from the phone yet")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if store.status.kind != "idle" {
                    Text(store.status.title)
                        .font(.headline)
                    Text(store.status.subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text("Last reading from the phone — not a CGM alarm.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
                Text("Treat first, then tap I’ve sorted it.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                Button("I’ve sorted it") {
                    store.sendSortedIt()
                    sentConfirmation = true
                    WKInterfaceDevice.current().play(.success)
                }
                .buttonStyle(.borderedProminent)
                if sentConfirmation {
                    Text("Queued for iPhone")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .navigationTitle("Diabeaters")
    }
}
