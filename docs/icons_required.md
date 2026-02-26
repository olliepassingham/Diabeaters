# iOS App Icons – Required Sizes

Place icon images in:

```
ios/App/App/Assets.xcassets/AppIcon.appiconset/
```

## App Store 1024×1024

- **No transparency** – App Store Connect rejects icons with an alpha channel.
- Source: Export a 1024×1024 PNG with no transparency from your design tool.
- Pipeline: Place the source at `/branding/appstore-icon-1024.png` and run `npm run icons:validate`.

## Asset Catalog Structure

The `Contents.json` in `AppIcon.appiconset` defines which images are used. Valid template:

| Size (px) | Filename example     | Usage                        |
|-----------|----------------------|------------------------------|
| 1024×1024 | AppIcon-1024.png     | App Store, marketing icon    |
| 180×180   | AppIcon-60@3x.png    | iPhone 60pt @3x              |
| 167×167   | AppIcon-83.5@2x.png  | iPad Pro 83.5pt @2x          |
| 152×152   | AppIcon-76@2x.png    | iPad 76pt @2x                |
| 120×120   | AppIcon-60@2x.png    | iPhone 60pt @2x              |
| 120×120   | AppIcon-40@3x.png    | iPhone 40pt @3x              |
| 87×87     | AppIcon-29@3x.png    | iPhone 29pt @3x (Settings)   |
| 80×80     | AppIcon-40@2x.png    | iPhone 40pt @2x (Spotlight)  |
| 76×76     | AppIcon-76@1x.png    | iPad 76pt @1x                |
| 60×60     | AppIcon-60@1x.png    | iPhone 60pt @1x              |
| 58×58     | AppIcon-29@2x.png    | iPhone 29pt @2x (Settings)   |
| 40×40     | AppIcon-40@1x.png    | iPhone 40pt @1x (Spotlight)  |
| 29×29     | AppIcon-29@1x.png    | iPhone 29pt @1x (Settings)   |

## AppIcon.appiconset Contents.json template

```json
{
  "images": [
    {
      "filename": "AppIcon-1024.png",
      "idiom": "universal",
      "platform": "ios",
      "size": "1024x1024"
    },
    {
      "filename": "AppIcon-60@2x.png",
      "idiom": "iphone",
      "scale": "2x",
      "size": "60x60"
    },
    {
      "filename": "AppIcon-60@3x.png",
      "idiom": "iphone",
      "scale": "3x",
      "size": "60x60"
    }
  ],
  "info": {
    "author": "xcode",
    "version": 1
  }
}
```

## Minimum for App Store

- **1024×1024** – Required for App Store Connect; upload in asset catalog or separately during submission
- At least one icon set for iPhone and (if supporting iPad) iPad

## Xcode Asset Catalog (AppIcon.appiconset)

1. Open `ios/App/App.xcworkspace` or `ios/App/App.xcodeproj` in Xcode
2. Navigate to `App` → `Assets.xcassets` → `AppIcon`
3. Drag PNGs into the appropriate slots, or use a single 1024×1024 and let Xcode generate sizes (if supported)

## Current Setup

The project currently has `AppIcon-512@2x.png` (1024×1024) in `AppIcon.appiconset`. Add further sizes if Xcode reports missing icons for specific devices.

---

## Launch Screen

Capacitor uses `ios/App/App/Base.lproj/LaunchScreen.storyboard` for the launch screen. It is referenced by `UILaunchStoryboardName` in `Info.plist`.

- **Background colour**: Edit the storyboard; the root view uses `systemBackgroundColor` by default. Change the `backgroundColor` of the image view or its parent to customise.
- **Brand mark / splash image**: The storyboard references the `Splash` image from `Assets.xcassets/Splash.imageset/`. Replace the images in that set:
  - `splash-2732x2732.png` (1x)
  - `splash-2732x2732-1.png` (2x)
  - `splash-2732x2732-2.png` (3x)
  Use a 2732×2732 px source image; Xcode scales as needed.
