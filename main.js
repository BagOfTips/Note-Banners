const { MarkdownView, Plugin, PluginSettingTab, Setting, TFile } = require("obsidian");

const DEFAULT_SETTINGS = {
  embeddedBannersEnabled: false,
  embeddedTitlesEnabled: false,
  activationProperty: "",
  activationValue: "",
  imageProperty: "art",
  bannerHeight: 220,
  fadeStart: 48,
};
const NO_BANNER_ALIASES = new Set(["no-b", "no-banner"]);
const NO_TITLE_ALIASES = new Set(["no-t", "no-title"]);
const HIDE_EMBED_TITLES_CLASS = "note-banners-hide-all-embed-titles";

module.exports = class NoteBannersPlugin extends Plugin {
  async onload() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.refreshTimer = null;
    this.applyGlobalClasses();
    this.addSettingTab(new NoteBannersSettingTab(this.app, this));

    const refresh = () => this.queueRefresh();
    this.registerEvent(this.app.workspace.on("layout-change", refresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));

    this.registerMarkdownPostProcessor((element, context) => {
      const embed = element.closest(".markdown-embed");
      if (embed) this.refreshEmbed(embed, context.sourcePath);
    });

    this.app.workspace.onLayoutReady(() => this.refreshAll());
  }

  onunload() {
    window.clearTimeout(this.refreshTimer);
    document.body.classList.remove(HIDE_EMBED_TITLES_CLASS);
    document.querySelectorAll(".view-content.note-banner-active").forEach((element) => {
      this.clearBanner(element);
    });
    document.querySelectorAll(
      ".markdown-embed.note-banner-embed-active, .markdown-embed.note-banners-hide-embed-title"
    ).forEach((element) => this.clearEmbed(element));
  }

  queueRefresh() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refreshAll(), 60);
  }

  refreshAll() {
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      if (leaf.view instanceof MarkdownView) this.refreshView(leaf.view);
    });

    const sourcePath = this.app.workspace.getActiveFile()?.path || "";
    document.querySelectorAll(".markdown-embed").forEach((embed) => {
      const source = embed.getAttribute("src") || embed.querySelector("[src]")?.getAttribute("src");
      const file = source ? this.resolveFile(source, sourcePath) : null;
      if (file) this.refreshEmbed(embed, file.path);
      else this.refreshEmbed(embed, "");
    });
  }

  refreshView(view) {
    const host = view.contentEl;
    const file = view.file;

    if (!file || !this.shouldActivate(file)) {
      this.clearBanner(host);
      return;
    }

    const source = this.getPropertyValue(file);
    const imageUrl = source ? this.resolveImage(source, file) : null;
    if (!imageUrl) {
      this.clearBanner(host);
      return;
    }

    this.applyBanner(host, imageUrl, file);
  }

  refreshEmbed(embed, sourcePath) {
    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    const aliases = this.getEmbedAliases(embed);
    const hideTitle = !this.settings.embeddedTitlesEnabled
      || aliases.some((alias) => NO_TITLE_ALIASES.has(alias));

    embed.classList.toggle("note-banners-hide-embed-title", hideTitle);

    const hideBanner = !this.settings.embeddedBannersEnabled
      || aliases.some((alias) => NO_BANNER_ALIASES.has(alias));
    if (!(file instanceof TFile) || hideBanner || !this.shouldActivate(file)) {
      this.clearEmbedBanner(embed);
      return;
    }

    const source = this.getPropertyValue(file);
    const imageUrl = source ? this.resolveImage(source, file) : null;
    if (!imageUrl) {
      this.clearEmbedBanner(embed);
      return;
    }

    embed.classList.add("note-banner-embed-active");
    const title = embed.querySelector(":scope > .markdown-embed-title");
    title?.classList.add("inline-title", "note-banner-embed-inline-title");
    this.setBannerProperties(embed, imageUrl, file);
  }

  applyBanner(host, imageUrl, file) {
    host.classList.add("note-banner-active");
    this.setBannerProperties(host, imageUrl, file);
  }

  setBannerProperties(element, imageUrl, file) {
    element.style.setProperty("--note-banner-image", `url(${JSON.stringify(imageUrl)})`);
    element.style.setProperty("--note-banner-position", `${this.getBannerPosition(file)}%`);
    element.style.setProperty("--note-banner-height", `${this.settings.bannerHeight}px`);
    element.style.setProperty("--note-banner-fade-start", `${this.settings.fadeStart}%`);
  }

  clearBanner(host) {
    host.classList.remove("note-banner-active");
    this.clearBannerProperties(host);
  }

  clearEmbedBanner(embed) {
    embed.classList.remove("note-banner-embed-active");
    const title = embed.querySelector(":scope > .markdown-embed-title");
    title?.classList.remove("inline-title", "note-banner-embed-inline-title");
    this.clearBannerProperties(embed);
  }

  clearEmbed(embed) {
    this.clearEmbedBanner(embed);
    embed.classList.remove("note-banners-hide-embed-title");
  }

  clearBannerProperties(element) {
    element.style.removeProperty("--note-banner-image");
    element.style.removeProperty("--note-banner-position");
    element.style.removeProperty("--note-banner-height");
    element.style.removeProperty("--note-banner-fade-start");
  }

  async updateSetting(key, value) {
    this.settings[key] = value;
    await this.saveData(this.settings);
    this.applyGlobalClasses();
    this.refreshAll();
  }

  applyGlobalClasses() {
    document.body.classList.toggle(
      HIDE_EMBED_TITLES_CLASS,
      !this.settings.embeddedTitlesEnabled
    );
  }

  getEmbedAliases(embed) {
    const alias = embed.getAttribute("alt")
      || embed.querySelector("[alt]")?.getAttribute("alt")
      || "";
    return alias
      .split(/[\s,]+/)
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean);
  }

  shouldActivate(file) {
    const property = this.settings.activationProperty.trim();
    if (!property) return true;

    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter || !Object.prototype.hasOwnProperty.call(frontmatter, property)) {
      return false;
    }

    const expected = this.settings.activationValue.trim();
    if (!expected) return true;
    return this.matchesActivationValue(frontmatter[property], expected, property);
  }

  matchesActivationValue(value, expected, property) {
    if (Array.isArray(value)) {
      return value.some((item) => this.matchesActivationValue(item, expected, property));
    }
    if (value === null || value === undefined) return false;

    const wanted = this.normaliseActivationValue(expected);
    const actual = String(value).trim();
    if (property.toLowerCase() === "tags") {
      return actual
        .split(/[\s,]+/)
        .filter(Boolean)
        .some((tag) => this.normaliseActivationValue(tag) === wanted);
    }
    return this.normaliseActivationValue(actual) === wanted;
  }

  normaliseActivationValue(value) {
    return String(value).trim().replace(/^#/, "").toLowerCase();
  }

  getPropertyValue(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const value = frontmatter?.[this.settings.imageProperty.trim() || "art"];
    if (Array.isArray(value)) {
      return value.find((item) => typeof item === "string")?.trim() || "";
    }
    return typeof value === "string" ? value.trim() : "";
  }

  getBannerPosition(file) {
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    const value = Number(frontmatter?.["banner-pos"]);
    if (!Number.isFinite(value)) return 0;
    return Math.max(-100, Math.min(100, value));
  }

  resolveFile(value, sourcePath) {
    const link = value.split("|")[0].split("#")[0].trim();
    return this.app.metadataCache.getFirstLinkpathDest(link, sourcePath);
  }

  resolveImage(value, sourceFile) {
    let link = value.trim();
    const wiki = link.match(/^!?\[\[([^\]]+)\]\]$/);
    const markdown = link.match(/^!?\[[^\]]*\]\((.+)\)$/);
    if (wiki) link = wiki[1];
    else if (markdown) link = markdown[1];

    link = link.split("|")[0].split("#")[0].trim().replace(/^<|>$/g, "");
    if (/^(?:https?:|data:|app:)/i.test(link)) return link;

    let target = this.app.metadataCache.getFirstLinkpathDest(link, sourceFile.path);
    if (!(target instanceof TFile)) {
      const decoded = this.safeDecode(link).replace(/^\/+/, "");
      const candidate = this.app.vault.getAbstractFileByPath(decoded);
      if (candidate instanceof TFile) target = candidate;
    }

    return target instanceof TFile ? this.app.vault.getResourcePath(target) : null;
  }

  safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
};

class NoteBannersSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Banner activation").setHeading();

    new Setting(containerEl)
      .setName("Activation property")
      .setDesc("Frontmatter property to inspect. Leave blank to allow banners on every note.")
      .addText((text) => text
        .setPlaceholder("tags")
        .setValue(this.plugin.settings.activationProperty)
        .onChange((value) => this.plugin.updateSetting("activationProperty", value.trim())));

    new Setting(containerEl)
      .setName("Activation value")
      .setDesc("Value the activation property must contain. Leave blank to require only that the property exists.")
      .addText((text) => text
        .setPlaceholder("banner")
        .setValue(this.plugin.settings.activationValue)
        .onChange((value) => this.plugin.updateSetting("activationValue", value.trim())));

    new Setting(containerEl)
      .setName("Image property")
      .setDesc("Frontmatter property containing an image wikilink, Markdown link, or URL.")
      .addText((text) => text
        .setPlaceholder("art")
        .setValue(this.plugin.settings.imageProperty)
        .onChange((value) => this.plugin.updateSetting("imageProperty", value.trim() || "art")));

    new Setting(containerEl).setName("Banner appearance").setHeading();

    new Setting(containerEl)
      .setName("Banner height")
      .setDesc("Banner height in pixels.")
      .addSlider((slider) => slider
        .setLimits(100, 500, 10)
        .setValue(this.plugin.settings.bannerHeight)
        .setDynamicTooltip()
        .onChange((value) => this.plugin.updateSetting("bannerHeight", value)));

    new Setting(containerEl)
      .setName("Fade starting point")
      .setDesc("Percentage of the banner shown before it begins fading into the note background.")
      .addSlider((slider) => slider
        .setLimits(0, 90, 1)
        .setValue(this.plugin.settings.fadeStart)
        .setDynamicTooltip()
        .onChange((value) => this.plugin.updateSetting("fadeStart", value)));

    new Setting(containerEl).setName("Embedded notes").setHeading();

    new Setting(containerEl)
      .setName("Show banners in embeds")
      .setDesc("Display the embedded note's banner unless its embed alias is no-b or no-banner. Disabled by default.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.embeddedBannersEnabled)
        .onChange((value) => this.plugin.updateSetting("embeddedBannersEnabled", value)));

    new Setting(containerEl)
      .setName("Show inline titles in embeds")
      .setDesc("Display embedded inline titles unless the embed alias is no-t or no-title. Disabled by default.")
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.embeddedTitlesEnabled)
        .onChange((value) => this.plugin.updateSetting("embeddedTitlesEnabled", value)));
  }
}
