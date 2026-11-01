# Instagram Parser

A Flutter mobile app that turns an Instagram data export into a browsable, human-readable dashboard. Instead of digging through folders of JSON, you can view your account data, media, connections and activity inside a native app.

## What it does

Instagram lets you download a copy of your data in JSON format, usually delivered as a ZIP archive. This app reads the extracted export and:

- Parses the JSON files from a standard Instagram export
- Displays the information in organized, scrollable screens
- Shows your exported photos and videos directly in the app
- Groups everything into clear categories: connections, media, ads, security, preferences and more

## Features

- **Dashboard** - At-a-glance summary cards with counts and quick navigation
- **Media** - Browse posts, reels, stories, archived posts and profile photos; view images full screen and play videos
- **Connections** - Followers, following, follow requests, close friends, blocked and restricted accounts, synced contacts
- **Ads & Views** - Ads viewed/clicked, posts viewed, videos watched, advertisers using your information, off-Meta activity
- **Security** - Login activity, logout activity, password and privacy changes, signup details, last known location
- **Preferences** - Notification settings, filtered keywords, allowed commenters, consents, topics
- **External Apps** - Apps and websites connected through Meta
- **Profile & Personal Info** - Device information, profile changes, locations of interest and related account details
- **Search & Link History** - Recent searches and link history records
- **Material 3 UI** - Light and dark themes with bottom-tab navigation

## How it works

1. Request your data from Instagram: **Settings > Accounts Center > Your information and permissions > Download your information**. Choose **JSON** as the format.
2. Extract the downloaded ZIP onto the device so the app can access it.
3. The app locates the account folder (for example `meta-<timestamp>/instagram-<username>-<date>-<id>`) and maps every known JSON file through `lib/config/file_paths.dart`.
4. `FileLoader` reads and decodes each JSON file, repairs Unicode escapes (so emojis render correctly) and caches the result in memory.
5. Riverpod providers expose the parsed data to the screens, which render it as cards, lists and media galleries.

### Expected export location

`FilePaths.init()` currently looks for the export under the app's external storage directory:

```
/storage/emulated/0/Android/data/com.example.my_app/meta-<timestamp>/instagram-<username>-<date>-<id>/
```

It falls back to the first folder starting with `instagram-` inside `meta-<timestamp>`. For a different export, either move the extracted folder to that location or update the default folder/path logic in `lib/config/file_paths.dart` and `lib/main.dart`.

> Note: The `archive` package is included as a dependency, but ZIP extraction is not yet wired into the Dart app. Currently the app expects an already-extracted export folder.

## Tech stack

- **Flutter / Dart** (SDK `>=3.0.0 <4.0.0`)
- **Riverpod** for state management
- **go_router** for navigation
- **video_player** for local video playback
- **photo_view**, **cached_network_image** for media viewing
- **path_provider**, **archive**, **intl**, **url_launcher**, **open_file**

## Project structure

```
Mobile/my_app/
  lib/
    main.dart                 App entry point and storage initialization
    config/file_paths.dart    All Instagram export file paths
    models/                   Data models per category
    services/                 JSON loaders, media file discovery, per-section services
    providers/                Riverpod state providers
    screens/                  Dashboard, media, connections, ads, security, profile
    routing/app_router.dart   Route definitions and bottom navigation shell
    widgets/                  Reusable cards and form widgets
  pubspec.yaml

Web/backend/
  Python CLI with analyzers for the same export data (legacy/companion tooling)
```

## Getting started

Requirements: Flutter SDK 3.0 or newer, Android Studio or Xcode and a connected device or emulator.

```bash
cd Mobile/my_app
flutter pub get
flutter run
```

Typical developer checks:

```bash
flutter analyze
flutter test
```

## Notes and limitations

- The app is designed around the folder layout of Instagram's JSON export. Meta occasionally changes file names, so update `file_paths.dart` if a section appears empty.
- Messages are not parsed yet; the Messages tab shows an empty-state screen.
- Data stays on the device; nothing is uploaded.
- Export paths and the default account folder are currently configured for a specific export. Generalize them before distributing the app.
