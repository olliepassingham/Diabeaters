/** Canonical app version — synced from repo root `package.json` via `npm run version:*`. */
import rootPackage from "../../../package.json";

export const APP_VERSION = rootPackage.version;
