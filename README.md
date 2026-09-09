# Note Banners

Uses an image from note frontmatter as a banner behind Obsidian's inline title. The banner begins at the top of the note and fades into the note background.

## Example

[![Note Banners example](https://i.ibb.co/TMNWbD3t/image.png)](https://ibb.co/B2YnrHMB)

## Installation

### Community plugins

Install **Note Banners** from Obsidian's Community plugins browser.

### Manual installation

1. Create `.obsidian/plugins/note-banners` inside your vault.
2. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
3. Reload Obsidian.
4. Enable **Note Banners** under **Settings > Community plugins**.

## Frontmatter

The default property is `art`:

```yaml
---
banner-pos: 0
art: "[[Attachments/feldon.jpg]]"
---
```

## Embedded notes

Embedded banners and embed titles are both disabled by default. Enable either one under **Settings > Community plugins > Note Banners**.
When enabled, an embedded title follows compatible inline-title styling even when the embedded note has no banner. If both options are enabled and a banner is available, the title is displayed over the banner.

When they are enabled globally, use an embed alias to hide one for a particular embed:

```markdown
![[Example note|no-t]]
![[Example note|no-title]]
![[Example note|no-b]]
![[Example note|no-banner]]
![[Example note|no-t no-b]]
```

- `no-t` or `no-title` hides the title for that embedded note.
- `no-b` or `no-banner` prevents the banner from appearing for that embedded note.

These aliases affect only that embed. They do not change the original note.
Separate two aliases with a space when you want to hide both the title and banner.

`banner-pos` controls the crop for each note. It accepts values from `-100` to `100`: `-100` shows the bottom of the image, `0` is centred, and `100` shows the top. Missing or invalid values use `0`; values outside the range are clamped.

Both activation fields are blank by default, so every note with the configured image property can display a banner. Set **Activation property** to restrict banners to notes containing a particular property. Optionally set **Activation value** when that property must also contain a particular value. Lists and single values are supported, and tag values may optionally begin with `#`.

Leave **Activation property** blank to allow banners on every note. Leave only **Activation value** blank to activate whenever the selected property exists.

External URLs and Markdown image links are also supported. The first string is used when the property is a list. Notes without a valid image do not receive banner styling.

The main note banner works with Obsidian's inline titles enabled or disabled. When enabled, the title overlays the banner; when disabled, the banner keeps its own space above the note content.

## Settings

### Banner activation

- **Activation property:** Optional frontmatter property used to decide which notes receive banners.
- **Activation value:** Optional value required in the activation property.
- **Image property:** Frontmatter property containing the banner image. Defaults to `art`.

### Banner appearance

- **Banner height:** Banner height from 100 to 500 pixels. Defaults to 220 pixels.
- **Fade starting point:** Where the image begins fading into the note background. Defaults to 48 percent.

### Embedded notes

- **Show banners in embeds:** Disabled by default.
- **Show inline titles in embeds:** Disabled by default. Obsidian's native **Show inline title** option must also be enabled.
