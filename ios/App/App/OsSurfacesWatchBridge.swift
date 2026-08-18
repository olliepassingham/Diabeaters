import Foundation
import WatchConnectivity

/// Pushes App Group status to a paired Apple Watch and forwards “I've sorted it” back to JS.
final class OsSurfacesWatchBridge: NSObject, WCSessionDelegate {
    static let shared = OsSurfacesWatchBridge()

    weak var plugin: OsSurfacesPlugin?

    func activate() {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func pushStatus(_ status: DiabeatersSharedStatus) {
        guard WCSession.isSupported() else { return }
        let session = WCSession.default
        guard session.activationState == .activated, session.isPaired, session.isWatchAppInstalled else { return }
        do {
            try session.updateApplicationContext(status.asWatchPayload())
        } catch {
            // Best-effort; Watch will pick up the next successful push.
        }
    }

    func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: Error?) {
        if activationState == .activated {
            pushStatus(DiabeatersSharedStatus.load())
        }
    }

    func sessionDidBecomeInactive(_ session: WCSession) {}

    func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleWatchMessage(message)
    }

    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
        handleWatchMessage(userInfo)
    }

    private func handleWatchMessage(_ message: [String: Any]) {
        guard (message["action"] as? String) == "sorted_it" else { return }
        DispatchQueue.main.async { [weak self] in
            self?.plugin?.notifyListeners("watchSortedIt", data: [:])
        }
    }
}
