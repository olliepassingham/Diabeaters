import Foundation
import WatchConnectivity
import WidgetKit

/// Receives phone status over WatchConnectivity and caches it for the glance + complications.
final class WatchStatusStore: NSObject, ObservableObject, WCSessionDelegate {
    static let shared = WatchStatusStore()

    @Published var status: DiabeatersSharedStatus = .idle

    func activate() {
        status = DiabeatersSharedStatus.load()
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func sendSortedIt() {
        let message = ["action": "sorted_it"]
        let session = WCSession.default
        guard session.activationState == .activated else {
            session.transferUserInfo(message)
            return
        }
        if session.isReachable {
            session.sendMessage(message, replyHandler: nil) { _ in
                session.transferUserInfo(message)
            }
        } else {
            session.transferUserInfo(message)
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        apply(session.receivedApplicationContext)
    }

    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        DispatchQueue.main.async {
            self.apply(applicationContext)
        }
    }

    private func apply(_ payload: [String: Any]) {
        guard !payload.isEmpty else { return }
        let next = DiabeatersSharedStatus.fromWatchPayload(payload)
        status = next
        next.save()
        WidgetCenter.shared.reloadAllTimelines()
    }
}
