/**
 * Native shipping mode.
 *
 * Default day-to-day sync (`ios:release:sync` / `android:release:sync`) is **remote**:
 * Capacitor `server.url` → https://diabeaters.vercel.app so pushes to main update the
 * WebView without a new binary (same on iOS and Android).
 *
 * Store / Play archives that must work offline: use `*:release:sync:bundled`.
 * Capgo OTA can later patch bundled binaries without resubmitting.
 *
 * @see docs/operations/native-shipping-mode.md
 */
export const NATIVE_STORE_SHIPPING_MODE = "remote" as const;

export type NativeStoreShippingMode = typeof NATIVE_STORE_SHIPPING_MODE;
