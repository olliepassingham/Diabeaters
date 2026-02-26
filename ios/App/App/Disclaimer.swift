import Foundation

/// App Store requirement: reusable disclaimer string for medical compliance.
/// The WebView content must not make medical claims. This string is kept in the native
/// layer for reference and App Store review.
enum Disclaimer {
    static let text = "Diabeaters provides general lifestyle organization for people living with Type 1 diabetes. It does not provide medical advice and is not a medical device. Always follow guidance from your healthcare professional."
}
