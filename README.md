## Data & Safety

Diabeaters provides general lifestyle organization for people living with Type 1 diabetes. It does not provide medical advice and is not a medical device. Always follow guidance from your healthcare professional.

### Disclaimer placement

The above disclaimer appears in:

- **Onboarding** – During the “One important thing” step, before the user completes setup. Acceptance is required to proceed.
- **Settings → About** – In the “Data & Safety” tab for easy access at any time.

### Avoiding medical claims

- App copy uses “lifestyle organization,” “information,” and “suggestions” rather than “treatment,” “diagnosis,” or “medical advice.”
- Activity Adviser and similar features present guidance based on user-entered ratios; they do not make clinical recommendations.
- Users are consistently reminded to consult their healthcare professional.

## Environments

| Environment | Host           | Branch   | Notes                                      |
|-------------|----------------|----------|--------------------------------------------|
| Development | localhost:5173 | local    | `.env` with `VITE_APP_ENV=development`     |
| Staging     | Vercel Preview | `develop`| `.env.staging`, staging Supabase, no-index |
| Production  | Vercel Prod    | `main`   | Production Supabase, indexing allowed      |

**Required env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV` (optional; defaults to `development` when `DEV`, `production` when `PROD`). Vite exposes `VITE_*` to the client via `import.meta.env`. Copy `.env.example` or `.env.staging.example` as needed. Restart dev server after changing `.env`.

**How `VITE_APP_ENV` controls the app:**
- **Banners:** Staging shows a top ribbon “Staging — not for real use” and a “Preview: this feature is in staging” chip on the dashboard. Production shows neither.
- **Robots:** Staging builds emit `Disallow: /`; production emits `Allow: /`. Search engines should not index staging.
- **Feature flags:** Use `isStaging`, `isProd`, `isDev` from `@/lib/flags` for conditional UI or analytics (e.g. only enable tracking in production).

```ts
import { isStaging } from "@/lib/flags";

if (isStaging) {
  // Show "Preview: this feature is in staging" chip, or skip analytics
}
```

## Local Env

- **Supabase credentials**: In your Supabase project, go to **Project Settings → API** and copy the **project URL** and **public anon key**.
- **.env variables**: Put them in the root `.env` file as:
  - `VITE_SUPABASE_URL=...`
  - `VITE_SUPABASE_ANON_KEY=...`
  - `VITE_APP_ENV=development` (optional; see `.env.example`)
- **Vite prefix**: The `VITE_` prefix is required for Vite to expose these values to the client (`import.meta.env.VITE_SUPABASE_URL`, etc.).
- **Restart dev server**: After changing `.env`, stop and restart `npm run dev` so Vite picks up the new values.

## Local Development

- **Node**: Node 18+ recommended.
- **Install deps**: `npm install`
- **Env file**: Create a root `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Run dev server**: `npm run dev` → open `http://localhost:5173/`

## Supabase URL Configuration (copy/paste)

**Supabase Dashboard → Authentication → URL Configuration**

- **Site URL**: `https://YOUR_DOMAIN` (or your Vercel preview URL while testing)
- **Redirect URLs** (newline separated):

```
https://YOUR_DOMAIN/auth/callback
https://YOUR_DOMAIN/reset-password
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

Add these for OAuth, email verification, and password reset. For local testing, use the `localhost` entries.

## OAuth (Apple, Google, Microsoft)

Supabase Auth supports OAuth sign-in with Apple, Google, and Microsoft. Configure each provider in the Supabase Dashboard.

### URL configuration

See **Supabase URL Configuration (copy/paste)** above.

### Provider setup

**Supabase Dashboard → Authentication → Providers**

- **Apple**: Configure Services ID, Key ID, Team ID. Redirect URI: `https://YOUR_DOMAIN/auth/callback`
- **Google** (OAuth 2.0): Client ID and Secret. Authorised redirect URI: `https://YOUR_DOMAIN/auth/callback`
- **Microsoft** (Azure AD): Client ID and Secret. Redirect URI: `https://YOUR_DOMAIN/auth/callback`

### Local testing

Use `http://localhost:5173/auth/callback` as a redirect URL in each provider’s developer console.

### iOS / mobile

OAuth opens in the system browser (SFSafariViewController). After sign-in, the user returns to the app at `/auth/callback`. ATS already enforces HTTPS.

## Email Verification (Supabase)

### Enable confirmations

**Supabase Dashboard → Authentication → Providers → Email**

- Enable **Confirm email** (email confirmations required).

### URL configuration

See **Supabase URL Configuration (copy/paste)** above.

### Flow

1. User signs up → app redirects to `/check-email`
2. User clicks verification link in email → goes to `/auth/callback` → session is set
3. If verified → redirect to dashboard; otherwise → `/check-email`
4. User can resend verification email from `/check-email`

### iOS wrapper note

The email link opens in the system browser (SFSafariViewController). The WebView session reflects verification after the user returns and logs in if needed.

## Password Reset (Supabase)

### URL configuration

See **Supabase URL Configuration (copy/paste)** above.

### Flow

1. User clicks “Forgot your password?” on the login page → `/reset-request`
2. User enters email → reset email sent
3. User clicks link in email → `/reset-password` (temporary session from Supabase)
4. User sets new password → redirect to `/login` with success toast

### iOS note

The email link opens in the system browser to your domain. After resetting, the user logs in again in the app.

## Supabase Setup

- **Project keys**: In Supabase, go to **Project Settings → API**, then copy the **project URL** and **anon public key** into your `.env`.
- **Create `supplies` table**: In the Supabase SQL editor, run:

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.supplies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null,
  name text not null,
  quantity int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists idx_supplies_user_id on public.supplies(user_id);

alter table public.supplies enable row level security;

create policy "Supplies: select own" on public.supplies
  for select using (auth.uid() = user_id);

create policy "Supplies: insert own" on public.supplies
  for insert with check (auth.uid() = user_id);

create policy "Supplies: update own" on public.supplies
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Supplies: delete own" on public.supplies
  for delete using (auth.uid() = user_id);
```

- **RLS note**: RLS is enabled; all access is restricted so each user can only read/write rows where `user_id = auth.uid()`.

## E2E tests (Playwright)

Smoke and auth tests run against a running app (local preview or deployed).

1. **Install browsers** (first time only): `npx playwright install chromium`
2. **Local**: `npm run build && npm run preview` in one terminal, then `BASE_URL=http://localhost:4173 npm run test:e2e` in another
3. **Deployed**: `BASE_URL=https://your-app.vercel.app npm run test:e2e`

Tests: onboarding brand header visible; login form renders when onboarding is completed; auth routes (login, signup, reset-request, reset-password, auth callback, account redirect). No real provider credentials required. Not wired into CI yet.

## App Store Screenshots

Automated screenshot capture for App Store submission.

1. **Start dev server** (if not already running): `npm run shots:dev`
2. **Capture**: `npm run shots:capture`

Output folder: `screenshots/en-GB/`. Required sizes:

| Size       | Dimensions   | Filename pattern                    |
|------------|--------------|-------------------------------------|
| iPhone 6.7"| 1290 × 2796  | iphone-67-{state}.png               |
| iPhone 6.5"| 1242 × 2688  | iphone-65-{state}.png               |
| iPhone 5.5"| 1242 × 2208  | iphone-55-{state}.png               |

States: `onboarding`, `dashboard`, `add-supply`, `routines`, `settings-about`. The `/_shots` route renders staged UI with mock data and no network calls. Set `SHOTS_BASE_URL` if the app runs on a different port.

## Icons

Export the App Store icon as a 1024×1024 PNG **without transparency** and place it at `branding/appstore-icon-1024.png`. Run `npm run icons:validate` to check dimensions and alpha channel. See [docs/icons_required.md](docs/icons_required.md) for sizes and `AppIcon.appiconset` setup.

## Policies & Support

- **Privacy**: [/privacy](privacy) – Data collected (email, profile name, supplies), purpose, retention, deletion, cookies, third parties.
- **Support**: [/support](support) – Contact email and FAQ (login, password reset, data deletion).

Footer links appear on onboarding and the dashboard. **Replace placeholder URLs** with your full domain after deploy (e.g. `https://diabeaters.vercel.app/privacy`).

## Account page

[/account](/account) – Manage email, password, verification, and sign out. Accessible to signed-in users (including unverified). Linked from the header, footer, profile menu, and Settings → About.

## Build

- **Build app**: `npm run build`
- **Preview build**: `npm run preview`

## Deploy (Vercel CI)

Push to `main` to trigger an automatic deploy. First deploy may take a few minutes. The production URL is printed in the Vercel workflow summary.

**Required secrets:** Add the five GitHub Actions secrets before the first run. See [docs/ci_secrets.md](docs/ci_secrets.md) for copy-paste instructions (Vercel token, org/project IDs, Supabase URL and anon key).

## Deploy to Vercel (manual)

Production builds use env vars from Vercel only (not `.env`). Add them before deploying:

1. **Install and log in**:
   ```bash
   npm i -g vercel
   vercel login
   ```

2. **Link the project** (first time only):
   ```bash
   vercel link
   ```
   Or run `vercel init` to create a new project. Pick your Vercel account and project when prompted.

3. **Add env vars** (required for Supabase):
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   ```
   Paste your Supabase project URL and anon key when prompted. Choose Production (and Preview if you want).

4. **Deploy**:
   ```bash
   vercel deploy
   ```
   For production:
   ```bash
   vercel deploy --prod
   ```

The `vercel.json` in the repo configures build, output dir (`dist/public`), and SPA rewrites. No `.env` is used in production.

## iOS (Capacitor)

Capacitor wraps the web app in a native iOS shell. The `ios/` platform is configured under `/ios` and ready for Xcode builds and App Store submission.

### Build and sync

1. **Build web assets**: `npm run build`
2. **Sync to native**:
   ```bash
   npx cap sync
   npx cap sync ios
   ```
3. **Open Xcode**: `npx cap open ios`

### Server URL

`capacitor.config.ts` is set to load the app from `https://diabeaters.vercel.app` (production). The WebView loads this deployed Vercel URL; bundled assets in `ios/App/App/public` are used as fallback when offline. `cleartext: false` enforces HTTPS only.

**Staging testing:** To test the staging URL inside the iOS wrapper, temporarily change `server.url` in `capacitor.config.ts` to your staging URL and run `npx cap sync ios`. Do not ship to the App Store with a staging URL; revert to production before archiving.

### ATS (App Transport Security)

`Info.plist` includes `NSAppTransportSecurity` with `NSAllowsArbitraryLoads: false` and `NSAllowsLocalNetworking: false` so only HTTPS traffic is allowed. Required for App Store submission.

### External links

To open external links in `SFSafariViewController`, add `@capacitor/browser` and use `Browser.open()` from the web app for outbound links.

### Disclaimer (App Store requirement)

`ios/App/App/Disclaimer.swift` contains the canonical disclaimer string used for App Store review and medical compliance:

> "Diabeaters provides general lifestyle organization for people living with Type 1 diabetes. It does not provide medical advice and is not a medical device. Always follow guidance from your healthcare professional."

The WebView content (loaded from Vercel) must not make medical claims. Avoid diagnosis, treatment, or cure language.

## iOS Build & App Store Submission

After `npx cap open ios`:

1. **Archive**:
   - Select **Any iOS Device (arm64)** as the run destination.
   - **Product → Archive**.
   - When the Organizer appears, click **Distribute App** and follow the App Store Connect flow.

2. **Signing**:
   - In Xcode → **Signing & Capabilities**, choose your Team and enable **Automatically manage signing**.
   - Ensure the bundle ID matches `com.passingtime.diabeaters` (or your registered App ID in the Apple Developer portal).

3. **Icons & versioning**:
   - Set app icons in `ios/App/App/Assets.xcassets/AppIcon.appiconset/`.
   - Update **Marketing Version** and **Current Project Version** in the target’s **General** tab.

4. **WebView content**:
   - The app loads the deployed Vercel URL (`https://diabeaters.vercel.app`). Ensure the live site includes disclaimers (onboarding and Settings → About) and does not contain medical claims.

## App Store Submission (iOS)

For full Xcode archive and App Store Connect submission, use:

- [docs/ios_build_checklist.md](docs/ios_build_checklist.md) – Numbered checklist (preconditions, versioning, signing, ATS, icons, build steps, distribution, validation, review notes)
- [docs/infoplist_verification.md](docs/infoplist_verification.md) – Info.plist ATS entries and external link handling
- [docs/appstore_metadata.json](docs/appstore_metadata.json) – Metadata template (name, description, screenshots, URLs, keywords)
- [docs/app_review_notes.txt](docs/app_review_notes.txt) – Bullets for App Review (Guideline 1.4.1, non-medical, safety)
- [docs/icons_required.md](docs/icons_required.md) – Icon sizes, placement, launch screen
- [docs/data_collection.md](docs/data_collection.md) – Data handling for privacy policy

**Build commands:**

```bash
npm run build
npx cap sync
npx cap open ios
```

Then: **Product → Archive** → **Distribute** → TestFlight or App Store.

## Continuous Deployment via Vercel + GitHub Actions

A workflow at `.github/workflows/deploy-vercel.yml` triggers on every push to `main`, builds the app, and deploys to Vercel. Pushing to `main` auto-builds and auto-deploys.

### Where to copy values in Vercel

1. **Project ID**: Vercel Dashboard → your project → **Settings** → **General** → **Project ID**
2. **Org ID**: Vercel Dashboard → **Account** (or Team) → **Settings** → **General** → **Team ID** / **Account ID** (this is `VERCEL_ORG_ID`; for personal accounts, use **Account → General**)
3. **Vercel token**: Vercel Dashboard → **Account** → **Settings** → **Tokens** → **Create Token** (name it e.g. `github-actions`, no expiry or 1 year)

### Where to store secrets in GitHub

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add:

   | Name                   | Value                                                                 |
   |------------------------|-----------------------------------------------------------------------|
   | `VERCEL_TOKEN`         | Token from Vercel **Account → Settings → Tokens** → Create Token      |
   | `VERCEL_ORG_ID`        | Org/Team/Account ID from Vercel **Account/Team → Settings → General** |
   | `VERCEL_PROJECT_ID`    | Project ID from Vercel **Project → Settings → General**               |
   | `VITE_SUPABASE_URL`    | Supabase project URL (from Supabase **Project Settings → API**)       |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon public key (from Supabase **Project Settings → API**) |

These are used by the workflow: Vercel IDs for deployment, Supabase vars for build-time injection into the client bundle.

## Deploy to Netlify

1. **Env vars in Netlify**: In your Netlify site → **Site settings → Environment variables**, add:
   - `VITE_SUPABASE_URL` – your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` – your Supabase anon public key  
   Redeploy after adding or changing these.

2. **CLI deploy**:
   ```bash
   npm i -g netlify-cli
   netlify login
   netlify init
   netlify deploy
   ```
   For production:
   ```bash
   netlify deploy --prod
   ```

## iOS WebView Wrapper (Xcode)

Step-by-step guide to wrap the deployed web app in a native iOS shell using WKWebView.

### 1. Build the web app

```bash
npm run build
```

Output is in `dist/public/`. Choose one of:

- **Option A – Remote URL**: Deploy to Vercel/Netlify and use the live URL (e.g. `https://your-app.vercel.app`). No file copying.
- **Option B – Bundled**: Add `dist/public/` to the Xcode project so the app loads files from the bundle. Drag the `dist/public` folder into Xcode and check "Copy items if needed" and your app target.

### 2. Create the project

1. In Xcode: **File → New → Project** → iOS App.
2. Product Name: e.g. `Diabeaters`, Language: **Swift**, Life Cycle: **UIKit App Delegate**.
3. Disable Storyboards: remove `Main.storyboard` and set **Main Interface** to empty in the target’s General tab.

### 3. `AppDelegate.swift` – set root view controller

```swift
import UIKit

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = WebViewController()
        window?.makeKeyAndVisible()
        return true
    }
}
```

### 4. `WebViewController.swift` – WKWebView with pull-to-refresh and external links

```swift
import UIKit
import WebKit
import SafariServices

final class WebViewController: UIViewController {
    private var webView: WKWebView!
    private var refreshControl = UIRefreshControl()

    // Set to your deployed URL, or nil to load bundled files
    private let remoteURL = "https://your-app.vercel.app"
    // Or for bundled: private let remoteURL: String? = nil

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.processPool = WKProcessPool()
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.scrollView.bounces = true
        view = webView
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        refreshControl.addTarget(self, action: #selector(reloadWebView), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
        loadContent()
    }

    private func loadContent() {
        if let urlString = remoteURL, let url = URL(string: urlString) {
            webView.load(URLRequest(url: url))
        } else {
            if let indexURL = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "public") {
                webView.loadFileURL(indexURL, allowingReadAccessTo: indexURL.deletingLastPathComponent())
            } else {
                fatalError("Bundled index.html not found. Add dist/public to the project.")
            }
        }
    }

    @objc private func reloadWebView() {
        webView.reload()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.refreshControl.endRefreshing()
        }
    }
}

extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        // Open external links in Safari
        if navigationAction.navigationType == .linkActivated {
            let host = url.host ?? ""
            let appHost = URL(string: remoteURL ?? "")?.host ?? ""
            if host != appHost && host != "" {
                let safari = SFSafariViewController(url: url)
                present(safari, animated: true)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }
}
```

### 5. `Info.plist` – App Transport Security (HTTPS only)

Add or merge:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
    <key>NSAllowsLocalNetworking</key>
    <false/>
</dict>
```

Or in the Xcode plist editor: **App Transport Security Settings** → **Allow Arbitrary Loads** = NO. This restricts the app to HTTPS.

### 6. Bundle `dist/public` (Option B only)

1. Build with `npm run build`.
2. Drag the `dist/public` folder into the Xcode project navigator.
3. Check **Copy items if needed** and your app target.
4. In **Build Phases → Copy Bundle Resources**, confirm `public/index.html` and assets are included.
5. In `WebViewController`, set `remoteURL = nil` and rely on `loadFileURL` for bundled loading.

### 7. App Store Review – disclaimers and no medical claims

- **Medical disclaimer**: The app is not a medical device and does not provide medical advice. Add to your App Store listing and in-app:
  - e.g. *"This app is for informational and tracking purposes only. Always consult your healthcare provider for medical decisions."*
- **No medical claims**: Do not claim to diagnose, treat, cure, or prevent disease. Avoid wording that suggests medical advice.
- **Data**: If you collect health-related data, state it in the Privacy Policy and in App Store metadata.
- **Login/signup**: If you have Supabase auth, mention account creation and data storage in the listing and Privacy Policy.

## Typical flow (branching)

1. `git checkout -b feature/xyz` from `develop`
2. Push → Vercel Preview URL auto-generated for the branch
3. Merge to `develop` → Staging URL updates
4. Merge `develop` → `main` → Production goes live

See [docs/branching.md](docs/branching.md) for the full model.
