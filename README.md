# Capacitor Camera iCloud Reproduction

> This reproduction was generated with the assistance of AI ([Claude Code](https://docs.anthropic.com/en/docs/claude-code)).

Minimal reproduction for [ionic-team/capacitor-plugins#1807](https://github.com/ionic-team/capacitor-plugins/issues/1807).

## Bug

`Camera.getPhoto()` and `Camera.pickImages()` throw **"Error loading image"** on iOS when the selected photo is stored in iCloud and not downloaded locally (i.e., "Optimize iPhone Storage" is enabled).

## Environment

| Package            | Version |
| ------------------ | ------- |
| `@capacitor/core`  | ~8.3.0  |
| `@capacitor/camera` | ~8.1.0 |
| `@capacitor/ios`   | ~8.3.0  |
| Platform           | iOS 16+ |

## Steps to Reproduce

### Prerequisites

- A **physical iOS device** (iCloud Photos cannot be tested in the Simulator)
- iCloud Photos **enabled** on the device
- **"Optimize iPhone Storage"** turned on (Settings → Photos → Optimize iPhone Storage)
- At least one photo that exists **only in iCloud** (not downloaded locally)

### Run the app

```bash
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Build and run on a physical device from Xcode.

### Reproduce

1. Tap **"Camera.getPhoto()"** or **"Camera.pickImages()"**
2. Select a photo that is **only in iCloud** (not stored locally)
3. The log panel will show: `ERROR: Error loading image`

### Expected

The photo loads successfully. The plugin should allow iOS to download the image from iCloud before returning it, matching `<input type="file">` behavior in Safari.

### Actual

The plugin rejects with `"Error loading image"`.

## Offending Code

Two locations in the plugin's iOS source prevent iCloud photos from loading.

### `itemProvider` fails for iCloud-only assets

[`CameraPlugin.swift#L362-L380`](https://github.com/nicoverbruggen/capacitor-camera/blob/7839573/ios/Sources/CameraPlugin/CameraPlugin.swift#L362-L380) — `loadImage(from:)` uses `itemProvider.canLoadObject` / `loadDataRepresentation`, neither of which reliably fetches iCloud-only photos. When both fail, `completionHandler(nil)` propagates to [line 348](https://github.com/nicoverbruggen/capacitor-camera/blob/7839573/ios/Sources/CameraPlugin/CameraPlugin.swift#L348) producing `"Error loading image"`.

A reliable alternative is `PHImageManager.requestImageDataAndOrientation(for:options:)` with `options.isNetworkAccessAllowed = true` — the same pattern the plugin already uses in [`getLimitedLibraryPhotos`](https://github.com/nicoverbruggen/capacitor-camera/blob/7839573/ios/Sources/CameraPlugin/CameraPlugin.swift#L196-L219).

### Metadata fetch blocks network access

[`CameraExtensions.swift#L48`](https://github.com/nicoverbruggen/capacitor-camera/blob/7839573/ios/Sources/CameraPlugin/CameraExtensions.swift#L48) — `PHAsset.imageData` sets `isNetworkAccessAllowed = false`, so EXIF retrieval silently fails for any asset not cached locally.
