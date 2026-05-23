# File Recency Star

An Obsidian plugin that marks recently created and modified files in the file explorer with customizable markers.

## Features

- **Marker icons** — configurable shape (★, ❗, ●, 🔥, ✦), color, and position (before/after filename)
- **Title styling** — bold, color change, or highlight on recent file titles
- **Separate durations** — independent thresholds for new and modified files
- **Marker toggle** — option to hide icons and use title styling only
- **i18n** — automatic Korean/English labels based on Obsidian language setting

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| New file color | Marker color for recently created files | `#22c55e` |
| Modified file color | Marker color for recently modified files | `#eab308` |
| Marker shape | Icon character | ★ |
| Marker position | Before or after filename | After |
| New file duration | Hours to mark as new | 24 |
| Modified file duration | Hours to mark as modified | 24 |
| Refresh interval | Seconds between rescans | 60 |
| Title style | none / bold / color / highlight / bold+color | none |
| New file title color | Title color for created files | `#22c55e` |
| Modified file title color | Title color for modified files | `#eab308` |
| Show marker icon | Toggle marker icon on/off | On |

## Installation

### From Obsidian Community Plugins

1. Open **Settings → Community Plugins → Browse**
2. Search for **File Recency Star**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/songkeeh/obsidianstar/releases)
2. Create folder: `<vault>/.obsidian/plugins/file-recency-star/`
3. Copy both files into the folder
4. Enable the plugin in **Settings → Community Plugins**

## License

MIT © Keeho Song
