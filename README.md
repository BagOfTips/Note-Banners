# Note Banners

Uses an image from note frontmatter as a banner behind Obsidian's inline title. The banner begins at the top of the note and fades into the note background.

## Example

[![Note Banners example](https://i.ibb.co/TMNWbD3t/image.png)](https://ibb.co/B2YnrHMB)

## Frontmatter

The default property used for banners is `art`:

```yaml
---
art: "[[Attachments/feldon.jpg]]"
banner-pos: 0
---
```

`banner-pos` controls the crop for each note. It accepts values from `-100` to `100`: `-100` shows the bottom of the image, `0` is centred, and `100` shows the top. Missing or invalid values use `0`; values outside the range are clamped.

By default, both activation settings are blank, so every note with the configured image property can display a banner. Set **Activation property** to restrict banners to notes containing a particular property. Optionally set **Activation value** when that property must also contain a particular value. Lists and single values are supported, and tag values may optionally begin with `#`.

Leave **Activation property** blank to allow banners on every note. Leave only **Activation value** blank to activate whenever the selected property exists.

External URLs and Markdown image links are also supported. The first string is used when the property is a list. Notes without a valid image do not receive banner styling.

The inline title must be enabled in Obsidian for the banner and title overlay to appear.
