/**
 * Store shipping mode (decision recorded 2026-08).
 *
 * Default for App Store / production archives: **bundled** `webDir`
 * (fast cold start, offline UI). Live Vercel WebView remains available via
 * `npm run ios:release:sync:remote` for TestFlight iteration only.
 *
 * Capgo / OTA: optional later — keep store binaries bundled and push JS
 * packages when a Capgo app id is configured. Do not re-enable remote
 * `server.url` for store archives once bundled is the default.
 *
 * @see docs/operations/native-shipping-mode.md
 */
export const NATIVE_STORE_SHIPPING_MODE = "bundled" as const;

export type NativeStoreShippingMode = typeof NATIVE_STORE_SHIPPING_MODE;
