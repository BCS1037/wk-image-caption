var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ImageCaptionPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");

// extension.ts
var import_view = require("@codemirror/view");
function parseCaption(altText, showFileName, srcText) {
  if (!altText || altText.trim() === "") {
    if (showFileName && srcText) {
      const fileName = srcText.split("/").pop() || srcText;
      return decodeURIComponent(fileName);
    }
    return null;
  }
  const parts = altText.split("|");
  const sizeRegex = /^\d+(x\d+)?$/;
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1].trim();
    if (sizeRegex.test(lastPart)) {
      parts.pop();
    }
  }
  const caption = parts.join("|").trim();
  if (caption === "") {
    if (showFileName && srcText) {
      const fileName = srcText.split("/").pop() || srcText;
      return decodeURIComponent(fileName);
    }
    return null;
  }
  return caption;
}
var ImageCaptionLPPlugin = class {
  constructor(view) {
    this.view = view;
    this.scanAndInject(view.dom);
    this.observer = new MutationObserver(() => {
      this.scanAndInject(this.view.dom);
    });
    this.observer.observe(view.dom, {
      childList: true,
      subtree: true
    });
  }
  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.scanAndInject(update.view.dom);
    }
  }
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
  getSettings() {
    var _a, _b;
    const plugin = (_b = (_a = app.plugins) == null ? void 0 : _a.plugins) == null ? void 0 : _b["wk-image-caption"];
    return plugin ? plugin.settings : {
      showFileNameAsCaption: false,
      captionAlign: "center",
      captionStyle: "italic"
    };
  }
  scanAndInject(dom) {
    const settings = this.getSettings();
    const imgs = dom.querySelectorAll("img");
    imgs.forEach((img) => {
      const wrapper = img.closest(".image-wrapper");
      const embedParent = img.closest(".image-embed") || img.closest(".cm-embed-block");
      let existingCaption = null;
      if (embedParent) {
        existingCaption = embedParent.querySelector(":scope > .image-caption");
      }
      if (!existingCaption && wrapper) {
        const next = wrapper.nextElementSibling;
        if (next && next.classList.contains("image-caption")) {
          existingCaption = next;
        }
      }
      if (!existingCaption && !wrapper && !embedParent) {
        const next = img.nextElementSibling;
        if (next && next.classList.contains("image-caption")) {
          existingCaption = next;
        }
      }
      if (existingCaption) {
        this.applyStyleClasses(existingCaption, settings);
        return;
      }
      const altText = img.getAttribute("alt");
      const resolvedAlt = altText || (embedParent ? embedParent.getAttribute("alt") : null);
      const resolvedSrc = img.getAttribute("src") || (embedParent ? embedParent.getAttribute("src") : null);
      const captionText = parseCaption(resolvedAlt, settings.showFileNameAsCaption, resolvedSrc);
      if (captionText) {
        img.dataset.hasCaption = "true";
        const captionEl = activeDocument.createElement("div");
        captionEl.className = "image-caption";
        captionEl.setText(captionText);
        this.applyStyleClasses(captionEl, settings);
        if (wrapper) {
          wrapper.after(captionEl);
        } else if (embedParent) {
          if (!embedParent.querySelector(":scope > .image-caption")) {
            embedParent.appendChild(captionEl);
          }
        } else {
          img.after(captionEl);
        }
      }
    });
  }
  applyStyleClasses(el, settings) {
    el.className = "image-caption";
    el.classList.add(`align-${settings.captionAlign}`);
    el.classList.add(`style-${settings.captionStyle}`);
  }
};
var imageCaptionExtension = import_view.ViewPlugin.fromClass(ImageCaptionLPPlugin);

// main.ts
var DEFAULT_SETTINGS = {
  showFileNameAsCaption: false,
  captionAlign: "center",
  captionStyle: "italic"
};
var ImageCaptionPlugin = class extends import_obsidian.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerEditorExtension(imageCaptionExtension);
    this.registerMarkdownPostProcessor((el) => {
      const embeds = el.classList.contains("internal-embed") ? [el] : Array.from(el.querySelectorAll(".internal-embed"));
      embeds.forEach((embedEl) => {
        const img = embedEl.querySelector("img");
        if (img) {
          this.injectReadingCaption(img, embedEl);
        } else {
          const observer = new MutationObserver((_, obs) => {
            const loadedImg = embedEl.querySelector("img");
            if (loadedImg) {
              this.injectReadingCaption(loadedImg, embedEl);
              obs.disconnect();
            }
          });
          observer.observe(embedEl, { childList: true, subtree: true });
        }
      });
      const imgs = el.querySelectorAll("img");
      imgs.forEach((img) => {
        if (img.closest(".internal-embed")) {
          return;
        }
        this.injectReadingCaption(img, null);
      });
    });
    this.addSettingTab(new ImageCaptionSettingTab(this.app, this));
  }
  /**
   * 抽象的阅读模式 Caption 注入核心方法
   */
  injectReadingCaption(img, embedParent) {
    const wrapper = img.closest(".image-wrapper");
    let existingCaption = null;
    if (wrapper) {
      const next = wrapper.nextElementSibling;
      if (next && next.classList.contains("image-caption")) {
        existingCaption = next;
      }
    } else if (embedParent) {
      existingCaption = embedParent.querySelector(":scope > .image-caption");
    } else {
      const next = img.nextElementSibling;
      if (next && next.classList.contains("image-caption")) {
        existingCaption = next;
      }
    }
    if (existingCaption) {
      return;
    }
    const altText = img.getAttribute("alt");
    const resolvedAlt = altText || (embedParent ? embedParent.getAttribute("alt") : null);
    const resolvedSrc = img.getAttribute("src") || (embedParent ? embedParent.getAttribute("src") : null);
    const captionText = parseCaption(resolvedAlt, this.settings.showFileNameAsCaption, resolvedSrc);
    if (captionText) {
      img.dataset.hasCaption = "true";
      const captionEl = activeDocument.createElement("div");
      captionEl.className = "image-caption";
      captionEl.setText(captionText);
      captionEl.classList.add(`align-${this.settings.captionAlign}`);
      captionEl.classList.add(`style-${this.settings.captionStyle}`);
      if (wrapper) {
        wrapper.after(captionEl);
      } else if (embedParent) {
        if (!embedParent.querySelector(":scope > .image-caption")) {
          embedParent.appendChild(captionEl);
        }
      } else {
        img.after(captionEl);
      }
    }
  }
  onunload() {
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  /**
   * 当用户修改设置后，通知编辑器及视口更新，触发 Caption 重绘与样式级联响应
   */
  refreshWorkspace() {
    this.app.workspace.updateOptions();
  }
};
var ImageCaptionSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app2, plugin) {
    super(app2, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Show image file name as caption").setDesc("Use the file name as a fallback caption when no alt text or alias is explicitly specified.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showFileNameAsCaption).onChange(async (value) => {
        this.plugin.settings.showFileNameAsCaption = value;
        await this.plugin.saveSettings();
        this.plugin.refreshWorkspace();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Caption text alignment").setDesc("Choose how you want your image caption text to align relative to the image container.").addDropdown(
      (dropdown) => dropdown.addOption("left", "Left").addOption("center", "Center").addOption("right", "Right").setValue(this.plugin.settings.captionAlign).onChange(async (value) => {
        this.plugin.settings.captionAlign = value;
        await this.plugin.saveSettings();
        this.plugin.refreshWorkspace();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Caption text style").setDesc("Configure the font appearance style for the caption text.").addDropdown(
      (dropdown) => dropdown.addOption("italic", "Italic").addOption("normal", "Normal").setValue(this.plugin.settings.captionStyle).onChange(async (value) => {
        this.plugin.settings.captionStyle = value;
        await this.plugin.saveSettings();
        this.plugin.refreshWorkspace();
      })
    );
  }
};
