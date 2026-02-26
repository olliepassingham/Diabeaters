# Staging: Analytics and Tracking

When adding analytics or third-party tracking in the future, guard them with `APP_ENV`:

```ts
import { isProd } from "@/lib/flags";

if (isProd) {
  // Initialise analytics, tracking pixels, etc.
}
```

Staging and development builds should not send analytics or tracking data to production endpoints.
