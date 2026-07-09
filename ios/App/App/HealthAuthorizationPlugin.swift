import Capacitor
import Foundation
import HealthKit
import UIKit

/// Thin HealthKit auth bridge that always runs on the main thread.
/// Capgo's requestAuthorization / isAvailable can hang; Connect must not depend on Capgo for the sheet.
@objc(HealthAuthorizationPlugin)
public class HealthAuthorizationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthAuthorizationPlugin"
    public let jsName = "HealthAuthorization"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestBloodGlucoseRead", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "probe", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readBloodGlucoseSamples", returnType: CAPPluginReturnPromise),
    ]

    private let healthStore = HKHealthStore()

    @objc func probe(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve([
                "available": HKHealthStore.isHealthDataAvailable(),
                "hasBloodGlucoseType": HKObjectType.quantityType(forIdentifier: .bloodGlucose) != nil,
                "plugin": "HealthAuthorization",
            ])
        }
    }

    @objc func requestBloodGlucoseRead(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard HKHealthStore.isHealthDataAvailable() else {
                call.reject("Health data is not available on this device.", "health_unavailable")
                return
            }

            guard let bloodGlucose = HKObjectType.quantityType(forIdentifier: .bloodGlucose) else {
                call.reject("Blood glucose type is unavailable on this device.", "bg_type_unavailable")
                return
            }

            // Request Steps as well. On iOS 26.5, some HealthKit sheets that request a single
            // type (esp. clinical vitals) can present blank / dismiss immediately.
            var readTypes: Set<HKObjectType> = [bloodGlucose]
            if let steps = HKObjectType.quantityType(forIdentifier: .stepCount) {
                readTypes.insert(steps)
            }

            var settled = false
            let settle: (Bool, Error?) -> Void = { success, error in
                guard !settled else { return }
                settled = true
                if let error = error {
                    let nsError = error as NSError
                    CAPLog.print("[HealthAuthorization] error:", nsError.domain, nsError.code, error.localizedDescription)
                    call.reject(
                        error.localizedDescription,
                        "\(nsError.domain).\(nsError.code)",
                        error,
                        [
                            "domain": nsError.domain,
                            "code": nsError.code,
                            "success": success,
                        ]
                    )
                    return
                }
                CAPLog.print("[HealthAuthorization] finished success=", success)
                call.resolve([
                    "success": success,
                    "promptCompleted": true,
                ])
            }

            // Safety timeout only if iOS never invokes the completion (hang). Do NOT use a short
            // timeout — the user may take longer than a few seconds on the permission sheet.
            DispatchQueue.main.asyncAfter(deadline: .now() + 90) {
                settle(false, NSError(
                    domain: "HealthAuthorization",
                    code: 408,
                    userInfo: [NSLocalizedDescriptionKey: "Apple Health did not finish the permission request. If no sheet appeared, check Settings → Privacy & Security → Health, then try Connect again."]
                ))
            }

            self.healthStore.requestAuthorization(toShare: Set<HKSampleType>(), read: readTypes) { success, error in
                DispatchQueue.main.async {
                    settle(success, error)
                }
            }
        }
    }

    @objc func readBloodGlucoseSamples(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Health data is not available on this device.", "health_unavailable")
            return
        }
        guard let bloodGlucose = HKObjectType.quantityType(forIdentifier: .bloodGlucose) else {
            call.reject("Blood glucose type is unavailable on this device.", "bg_type_unavailable")
            return
        }
        guard let startIso = call.getString("startDate"), let endIso = call.getString("endDate") else {
            call.reject("startDate and endDate are required.")
            return
        }

        let limit = max(1, min(call.getInt("limit") ?? 20, 100))
        let startDate = Self.parseIsoDate(startIso)
        let endDate = Self.parseIsoDate(endIso)
        guard let startDate, let endDate else {
            call.reject("Invalid startDate or endDate.")
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let mgDlUnit = HKUnit(from: "mg/dL")
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        var settled = false
        let settle: (Result<[[String: Any]], Error>) -> Void = { result in
            guard !settled else { return }
            settled = true
            switch result {
            case .success(let samples):
                call.resolve(["samples": samples])
            case .failure(let error):
                let nsError = error as NSError
                call.reject(error.localizedDescription, "\(nsError.domain).\(nsError.code)", error)
            }
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 15) {
            settle(.failure(NSError(
                domain: "HealthAuthorization",
                code: 408,
                userInfo: [NSLocalizedDescriptionKey: "Apple Health did not return blood glucose samples in time."]
            )))
        }

        let query = HKSampleQuery(
            sampleType: bloodGlucose,
            predicate: predicate,
            limit: limit,
            sortDescriptors: [sort]
        ) { _, results, error in
            DispatchQueue.main.async {
                if let error = error {
                    settle(.failure(error))
                    return
                }
                let quantitySamples = (results as? [HKQuantitySample]) ?? []
                let mmolUnit = HKUnit.moleUnit(with: .milli, molarMass: HKUnitMolarMassBloodGlucose).unitDivided(by: .literUnit(with: .deci))
                let payload: [[String: Any]] = quantitySamples.map { sample in
                    let mgDl = sample.quantity.doubleValue(for: mgDlUnit)
                    let mmol = sample.quantity.doubleValue(for: mmolUnit)
                    // Prefer mg/dL conversion; fall back when Dexcom stores mmol/L quantities oddly.
                    let valueMgDl = mgDl >= 20 ? mgDl : max(mgDl, mmol * 18.0182)
                    return [
                        "value": valueMgDl,
                        "startDate": formatter.string(from: sample.startDate),
                        "endDate": formatter.string(from: sample.endDate),
                        "sourceName": sample.sourceRevision.source.name,
                    ]
                }
                settle(.success(payload))
            }
        }
        healthStore.execute(query)
    }

    private static func parseIsoDate(_ iso: String) -> Date? {
        let withFractional = ISO8601DateFormatter()
        withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = withFractional.date(from: iso) { return date }
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        return plain.date(from: iso)
    }
}
