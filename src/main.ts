import { Plugin, TFile, Notice } from "obsidian";
import {
  NoteExportSettings,
  DEFAULT_SETTINGS,
  NoteExportSettingTab,
} from "./settings";
import { exportAsHtml, exportAsPdf } from "./exporters";

export default class NoteExportPlugin extends Plugin {
  settings: NoteExportSettings = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    // ── Ribbon icon ──────────────────────────────
    this.addRibbonIcon("file-down", "Export note", async () => {
      const file = this.app.workspace.getActiveFile();
      if (!file) {
        new Notice("No active note to export.");
        return;
      }
      await this.exportNote(file, this.settings.defaultFormat);
    });

    // ── Command: Export as PDF ───────────────────
    this.addCommand({
      id: "export-pdf",
      name: "Export as PDF",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          exportAsPdf(this.app, file, this.settings, this);
        }
        return true;
      },
    });

    // ── Command: Export as HTML5 ─────────────────
    this.addCommand({
      id: "export-html",
      name: "Export as standalone HTML5",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          exportAsHtml(this.app, file, this.settings, this);
        }
        return true;
      },
    });

    // ── Command: Quick export (default format) ───
    this.addCommand({
      id: "export-default",
      name: "Quick export (default format)",
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file) return false;
        if (!checking) {
          this.exportNote(file, this.settings.defaultFormat);
        }
        return true;
      },
    });

    // ── File menu integration ────────────────────
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;

        menu.addItem((item) => {
          item
            .setTitle("Export as PDF")
            .setIcon("file-down")
            .onClick(async () => {
              await exportAsPdf(this.app, file, this.settings, this);
            });
        });

        menu.addItem((item) => {
          item
            .setTitle("Export as HTML5")
            .setIcon("code")
            .onClick(async () => {
              await exportAsHtml(this.app, file, this.settings, this);
            });
        });
      })
    );

    // ── Settings tab ─────────────────────────────
    this.addSettingTab(new NoteExportSettingTab(this.app, this));
  }

  onunload(): void {
    // cleanup if needed
  }

  private async exportNote(
    file: TFile,
    format: "pdf" | "html"
  ): Promise<void> {
    if (format === "html") {
      await exportAsHtml(this.app, file, this.settings, this);
    } else {
      await exportAsPdf(this.app, file, this.settings, this);
    }
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
