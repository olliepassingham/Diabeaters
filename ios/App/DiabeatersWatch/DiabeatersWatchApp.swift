import SwiftUI

@main
struct DiabeatersWatchApp: App {
    init() {
        WatchStatusStore.shared.activate()
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView()
            }
        }
    }
}
