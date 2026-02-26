# Info.plist Verification

## NSAppTransportSecurity (HTTPS Only)

`ios/App/App/Info.plist` enforces HTTPS only:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSAllowsLocalNetworking</key>
    <false/>
</dict>
```

- `NSAllowsArbitraryLoads: false` – Blocks non-HTTPS connections
- `NSAllowsLocalNetworking: false` – Blocks local network (e.g. `http://localhost`)

Required for App Store submission.

## External Links and SFSafariViewController

Capacitor loads the app in a `WKWebView` from the configured `server.url`. Link behaviour:

- **In-app navigation**: Handled by the WebView (same origin)
- **External links**: By default, open in the same WebView. To open them in `SFSafariViewController`:
  1. Add `@capacitor/browser`: `npm install @capacitor/browser`
  2. In the web app, use `Browser.open({ url })` for outbound links
  3. Run `npx cap sync`

No Info.plist changes are needed for this; it is implemented in the web app.
