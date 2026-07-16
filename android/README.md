# Ephemera Android

This folder contains a native Android WebView wrapper for the static Ephemera site.

## Native calling experience

- Android CallStyle incoming-call notifications
- ringtone and vibration
- Answer and Decline actions
- full-screen incoming-call activity when Android allows full-screen intents
- lock-screen visibility and screen wake-up
- foreground room-connection service
- camera, microphone and file-picker bridge for the embedded web app

## Build

The GitHub Actions workflow `Build Android APK` copies the repository's `site/` folder into the APK and builds `Ephemera-Android.apk`.

For a local build, install Android SDK 35 and Gradle 8.9, then run:

```bash
gradle -p android :app:assembleRelease
```

Successful workflow runs publish an artifact named `ephemera-android-apk`.

## Limitation

The APK can receive peer-to-peer call invitations while its foreground connection service and WebView process remain alive. Reliable calls after Android force-stops or kills the process require a push-signalling backend such as Firebase Cloud Messaging.
