const { MarkdownView, Plugin, TFile } = require("obsidian");

const DEFAULT_PROPERTY = "art";

module.exports = class NoteBannersPlugin extends Plugin {
  async onload() {
    this.refreshTimer = null;

    const refresh = () => this.queueRefresh();
    this.registerEvent(this.app.workspace.on("layout-change", refresh));
    this.registerEvent(this.app.workspace.on("active-leaf-change", refresh));
    this.registerEvent(this.app.workspace.on("css-change", refresh));
    this.registerEvent(this.app.metadataCache.on("changed", refresh));
    this.registerEvent(this.app.vault.on("rename", refresh));
    this.registerEvent(this.app.vault.on("delete", refresh));

    this.requestStyleSettingsRefresh();
    this.app.workspace.onLayoutReady(() => {
      this.requestStyleSettingsRefresh();
      this.refreshAll();
    });
  }

  onunload() {
    window.clearTimeout(this.refreshTimer);
    document.querySelectorAll(".view-content.note-banner-active").forEach((el) => {
      this.clearBanner(el);
    });
  }

  queueRefresh() {
    window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => this.refreshAll(), 60);
  }

  requestStyleSettingsRefresh() {
    this.app.workspace.trigger("parse-style-settings");
  }

  refreshAll() {
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      if (leaf.view instanceof MarkdownView) this.refreshView(leaf.view);
    });
  }

  refreshView(view) {
    const host = view.contentEl;
    const file = view.file;

    if (!file || !this.shouldActivate(file)) {
      this.clearBanner(host);
      return;
    }

    const source = file ? this.getPropertyValue(file) : "";
    const imageUrl = file && source ? this.resolveImage(source, file) : null;

    if (!imageUrl) {
      this.clearBanner(host);
      return;
    }

    host.classList.add("note-banner-active");
    host.style.setProperty("--note-banner-image", `url(${JSON.stringify(imageUrl)})`);
    host.style.setProperty("--note-banner-position", `${this.getBannerPosition(file)}%`);
  }

  clearBanner(host) {
    host.classList.remove("note-banner-active");
    host.style.removeProperty("--note-banner-image");
    host.style.removeProperty("--note-banner-position");
  }

  getPropertyName() {
    const raw = getComputedStyle(document.body)
      .getPropertyValue("--note-banner-property")
      .trim();
    return raw.replace(/^['\"]|['\"]$/g, "") || DEFAULT_PROPERTY;
  }

  getActivationProperty() {
    const raw = getComputedStyle(document.body)
      .getPropertyValue("--note-banner-activation-property")
      .trim();
    return raw.replace(/^['\"]|['\"]$/g, "").trim();
  }

  getActivationValue() {
    const raw = getComputedStyle(document.body)
      .getPropertyValue("--note-banner-activation-value")
      .trim();
    return raw.replace(/^['\"]|['\"]$/g, "").trim();
  }

  shouldActivate(file) {
    const property = this.getActivationProperty();
    if (!property) return true;

    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
    if (!frontmatter || !Object.prototype.hasOwnProperty.call(frontmatter, property)) {
      return false;
    }

    const expected = this.getActivationValue();
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
    const value = frontmatter?.[this.getPropertyName()];
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
