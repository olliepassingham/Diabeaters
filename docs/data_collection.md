# Data Collection – Diabeaters

Summary of data handling for privacy policy and App Store disclosure.

## Tracking

- **No tracking** across apps or websites
- No third-party analytics or advertising SDKs
- Privacy manifest declares `NSPrivacyTracking: false`

## Authentication

- **Email**: Stored by Supabase Auth for sign-in and account recovery
- **Password**: Hashed; not stored in plain text
- **Profile name**: Optional, user-supplied; stored in Supabase (RLS-protected)

## User-Generated Data

- **Supplies**: Names, quantities, and usage data entered by the user
- **Scoped to account**: Row-level security (RLS) ensures each user only accesses their own data
- **Stored in Supabase**: Backed by PostgreSQL with RLS policies

## Deletion

- **Request path**: Users may request account and data deletion via:
  - In-app: Settings → Data (or equivalent) – instructions stub
  - Email: Support contact listed in app and on Support URL
- Deletion includes: profile data, supplies, and associated records in Supabase

## Third-Party Services

- **Supabase**: Auth and database hosting
- **Vercel**: Web hosting for the app URL loaded in the WebView
- No other third-party services that collect or share user data
