import { App, TFile, TFolder, Notice, Component, normalizePath } from "obsidian";
import { renderNoteToHtml, wrapInHtmlDocument } from "./renderer";
import { EXPORT_CSS } from "./styles";
import type { NoteExportSettings } from "./settings";

// ─────────────────────────────────────────
//  Ensure export folder exists (recursive)
// ─────────────────────────────────────────

async function ensureExportFolder(app: App, folderPath: string): Promise<void> {
  const normalized = normalizePath(folderPath);
  const parts = normalized.split("/");
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    const existing = app.vault.getAbstractFileByPath(current);
    if (!existing) {
      try {
        await app.vault.createFolder(current);
      } catch (e) {
        console.log(`Note Export: folder ${current} may already exist`, e);
      }
    }
  }
}

/**
 * Generate a unique export file path to avoid overwriting.
 */
function getUniqueFilePath(app: App, folder: string, basename: string, extension: string): string {
  const base = normalizePath(`${folder}/${basename}.${extension}`);
  if (!app.vault.getAbstractFileByPath(base)) {
    return base;
  }
  let counter = 1;
  while (counter < 100) {
    const candidate = normalizePath(`${folder}/${basename} (${counter}).${extension}`);
    if (!app.vault.getAbstractFileByPath(candidate)) {
      return candidate;
    }
    counter++;
  }
  return normalizePath(`${folder}/${basename} (${Date.now()}).${extension}`);
}

/**
 * Write a string file to vault using adapter.write.
 */
async function writeStringToVault(app: App, path: string, content: string): Promise<void> {
  const normalized = normalizePath(path);
  await app.vault.adapter.write(normalized, content);
  await sleep(200);
}

/**
 * Write a binary file to vault using adapter.writeBinary.
 */
async function writeBinaryToVault(app: App, path: string, data: ArrayBuffer): Promise<void> {
  const normalized = normalizePath(path);
  await app.vault.adapter.writeBinary(normalized, data);
  await sleep(200);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────
//  HTML5 Export — saves to vault
// ─────────────────────────────────────────

export async function exportAsHtml(
  app: App,
  file: TFile,
  settings: NoteExportSettings,
  component: Component
): Promise<void> {
  try {
    new Notice("⏳ Generating HTML…");

    const bodyContent = await renderNoteToHtml(app, file, settings, component);
    const html = wrapInHtmlDocument(bodyContent, file.basename, settings);

    await ensureExportFolder(app, settings.exportFolder);
    const exportPath = getUniqueFilePath(app, settings.exportFolder, file.basename, "html");

    await writeStringToVault(app, exportPath, html);

    new Notice(`✅ HTML exported → ${exportPath}`);
  } catch (e) {
    console.error("Note Export: HTML export failed", e);
    new Notice(`❌ HTML export error: ${(e as Error).message}`);
  }
}

// ─────────────────────────────────────────
//  PDF Export — jsPDF + html2canvas
// ─────────────────────────────────────────

export async function exportAsPdf(
  app: App,
  file: TFile,
  settings: NoteExportSettings,
  component: Component
): Promise<void> {
  try {
    new Notice("⏳ Generating PDF…");

    const bodyContent = await renderNoteToHtml(app, file, settings, component);

    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");

    // Create a temporary off-screen rendering container
    const renderDiv = document.createElement("div");
    renderDiv.style.position = "fixed";
    renderDiv.style.top = "-10000px";
    renderDiv.style.left = "-10000px";
    renderDiv.style.width = "800px";
    renderDiv.style.background = "#ffffff";
    renderDiv.style.zIndex = "-9999";

    const styleEl = document.createElement("style");
    styleEl.textContent = EXPORT_CSS;
    if (settings.customCssSnippet) {
      styleEl.textContent += "\n" + settings.customCssSnippet;
    }

    const contentDiv = document.createElement("div");
    contentDiv.className = "ne-container";
    contentDiv.innerHTML = bodyContent;

    renderDiv.appendChild(styleEl);
    renderDiv.appendChild(contentDiv);
    document.body.appendChild(renderDiv);

    await sleep(500);

    const canvas = await html2canvas(contentDiv, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 800,
    });

    // Page dimensions
    const pageFormats: Record<string, [number, number]> = {
      a4: [210, 297],
      a5: [148, 210],
      letter: [215.9, 279.4],
      legal: [215.9, 355.6],
    };
    const [pageWidth, pageHeight] = pageFormats[settings.pageSize] || pageFormats.a4;
    const margin = 15;
    const contentWidth = pageWidth - 2 * margin;
    const usableHeight = pageHeight - 2 * margin;

    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: settings.pageSize,
    });

    const imgData = canvas.toDataURL("image/png");
    let heightLeft = imgHeight;
    let page = 0;

    while (heightLeft > 0) {
      if (page > 0) {
        pdf.addPage();
      }
      const sourceY = page * usableHeight;
      pdf.addImage(imgData, "PNG", margin, margin - sourceY, imgWidth, imgHeight);
      heightLeft -= usableHeight;
      page++;
    }

    document.body.removeChild(renderDiv);

    const pdfOutput = pdf.output("arraybuffer");

    await ensureExportFolder(app, settings.exportFolder);
    const exportPath = getUniqueFilePath(app, settings.exportFolder, file.basename, "pdf");

    await writeBinaryToVault(app, exportPath, pdfOutput);

    new Notice(`✅ PDF exported → ${exportPath}`);
  } catch (e) {
    console.error("Note Export: jsPDF export failed", e);
    new Notice(`❌ PDF export error: ${(e as Error).message}`);
  }
}
