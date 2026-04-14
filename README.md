# Capacitor Camera iCloud Reproduction

Minimal reproduction for [ionic-team/capacitor-plugins#1807](https://github.com/ionic-team/capacitor-plugins/issues/1807).

## Bug

`Camera.getPhoto()` and `Camera.pickImages()` throw **"Error loading image"** on iOS when the selected photo is stored in iCloud and not downloaded locally on the device (i.e., "Optimize iPhone Storage" is enabled).

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
- At least one photo that exists **only in iCloud** (not downloaded locally — shown with a small download icon in the Photos app)

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
2. In the photo picker, select a photo that is **only in iCloud** (not stored locally)
3. Observe the log panel — it will show:
   ```
   ERROR: Error loading image
   ```

### Expected Behavior

The photo should load successfully. The plugin should wait for iOS to download the image from iCloud before returning it, matching the behavior of `<input type="file">` in Safari.

### Actual Behavior

The plugin throws `"Error loading image"`.

---

## Root Cause Analysis

The issue is in two locations within the Camera plugin's iOS source code.

### Problem 1: Image loading ignores iCloud-only assets

**File:** `node_modules/@capacitor/camera/ios/Sources/CameraPlugin/CameraPlugin.swift`
**Method:** `fetchProcessedImages(from:accumulating:_:)` (line ~361)

```swift
func loadImage(from pickerResult: PHPickerResult, _ completionHandler: @escaping (UIImage?) -> Void) {
    let itemProvider = pickerResult.itemProvider
    if itemProvider.canLoadObject(ofClass: UIImage.self) {          // ← returns false for iCloud-only photos
        itemProvider.loadObject(ofClass: UIImage.self) { ... }
    } else {
        itemProvider.loadDataRepresentation(forTypeIdentifier: UTType.image.identifier) { data, _ in
            guard let data else {
                return completionHandler(nil)                       // ← returns nil → triggers "Error loading image"
            }
            completionHandler(UIImage(data: data))
        }
    }
}
```

When a photo is stored only in iCloud:
1. `canLoadObject(ofClass: UIImage.self)` may return `false`
2. `loadDataRepresentation` may also fail (returns nil data) because the PHPicker item provider doesn't always handle iCloud downloads reliably
3. The `completionHandler(nil)` propagates up to line 348 where it becomes `"Error loading image"`

There is **no fallback** to use `PHImageManager.requestImageData(for:options:)` with `isNetworkAccessAllowed = true`, which is the standard iOS API for fetching iCloud photos.

### Problem 2: Metadata fetch explicitly blocks network access

**File:** `node_modules/@capacitor/camera/ios/Sources/CameraPlugin/CameraExtensions.swift`
**Property:** `PHAsset.imageData` (line ~44)

```swift
var imageData: [String: Any] {
    let options = PHImageRequestOptions()
    options.isSynchronous = true
    options.resizeMode = .none
    options.isNetworkAccessAllowed = false       // ← explicitly prevents iCloud download
    options.version = .current
    // ...
}
```

`isNetworkAccessAllowed = false` means even if the image were loaded successfully, the metadata/EXIF retrieval would silently fail for any asset not cached locally.

---

## Proposed Fix

See `fix-icloud-loading.patch` for the full diff.

The fix adds a fallback in `loadImage(from:)` that uses `PHImageManager` with `isNetworkAccessAllowed = true` when the `itemProvider` methods fail, and also sets `isNetworkAccessAllowed = true` on the metadata request.
