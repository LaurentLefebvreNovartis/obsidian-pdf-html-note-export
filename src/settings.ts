import { App, PluginSettingTab, Setting } from "obsidian";
import type NoteExportPlugin from "./main";

export type ExportFormat = "pdf" | "html";
export type PageSize = "a4" | "a5" | "letter" | "legal";

export interface NoteExportSettings {
  defaultFormat: ExportFormat;
  pageSize: PageSize;
  includeMetadata: boolean;
  includeDate: boolean;
  customCssSnippet: string;
  exportFolder: string;
}

export const DEFAULT_SETTINGS: NoteExportSettings = {
  defaultFormat: "pdf",
  pageSize: "a4",
  includeMetadata: true,
  includeDate: true,
  customCssSnippet: "",
  exportFolder: "exports",
};

export class NoteExportSettingTab extends PluginSettingTab {
  plugin: NoteExportPlugin;

  constructor(app: App, plugin: NoteExportPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Note Export — Settings" });

    // --- Default export format ---
    new Setting(containerEl)
      .setName("Default format")
      .setDesc("Format used by the quick export command.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("pdf", "PDF")
          .addOption("html", "Standalone HTML5")
          .setValue(this.plugin.settings.defaultFormat)
          .onChange(async (value) => {
            this.plugin.settings.defaultFormat = value as ExportFormat;
            await this.plugin.saveSettings();
          })
      );

    // --- Page Size ---
    new Setting(containerEl)
      .setName("Page size")
      .setDesc("Page size for PDF export.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("a4", "A4")
          .addOption("a5", "A5")
          .addOption("letter", "Letter")
          .addOption("legal", "Legal")
          .setValue(this.plugin.settings.pageSize)
          .onChange(async (value) => {
            this.plugin.settings.pageSize = value as PageSize;
            await this.plugin.saveSettings();
          })
      );

    // --- Include metadata ---
    new Setting(containerEl)
      .setName("Include metadata")
      .setDesc("Add title and frontmatter properties as a document header.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeMetadata)
          .onChange(async (value) => {
            this.plugin.settings.includeMetadata = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Include date ---
    new Setting(containerEl)
      .setName("Include date")
      .setDesc("Add export date in the document header.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeDate)
          .onChange(async (value) => {
            this.plugin.settings.includeDate = value;
            await this.plugin.saveSettings();
          })
      );

    // --- Export folder ---
    new Setting(containerEl)
      .setName("Export folder")
      .setDesc(
        "Folder in the vault where exported files will be saved. " +
        "Created automatically if it does not exist."
      )
      .addText((text) =>
        text
          .setPlaceholder("exports")
          .setValue(this.plugin.settings.exportFolder)
          .onChange(async (value) => {
            this.plugin.settings.exportFolder = value.trim() || "exports";
            await this.plugin.saveSettings();
          })
      );

    // --- Custom CSS snippet ---
    new Setting(containerEl)
      .setName("Custom CSS")
      .setDesc("Additional CSS appended after the built-in theme (optional).")
      .addTextArea((text) =>
        text
          .setPlaceholder("/* Your custom styles */")
          .setValue(this.plugin.settings.customCssSnippet)
          .onChange(async (value) => {
            this.plugin.settings.customCssSnippet = value;
            await this.plugin.saveSettings();
          })
      );

    // Make the textarea bigger
    const textAreas = containerEl.querySelectorAll("textarea");
    textAreas.forEach((ta) => {
      ta.style.width = "100%";
      ta.style.minHeight = "100px";
      ta.style.fontFamily = "monospace";
      ta.style.fontSize = "13px";
    });
  }
}
