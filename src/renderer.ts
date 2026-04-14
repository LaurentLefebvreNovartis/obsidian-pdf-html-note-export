import { App, MarkdownRenderer, Component, TFile } from "obsidian";
import { EXPORT_CSS } from "./styles";
import type { NoteExportSettings } from "./settings";

/**
 * Renders an Obsidian note to a styled HTML string.
 * Uses Obsidian's own MarkdownRenderer for full compatibility
 * with plugins, callouts, embeds, etc.
 */
export async function renderNoteToHtml(
  app: App,
  file: TFile,
  settings: NoteExportSettings,
  component: Component
): Promise<string> {
  const content = await app.vault.cachedRead(file);
  const metadata = app.metadataCache.getFileCache(file);

  // Create a temporary container for rendering
  const container = document.createElement("div");
  container.addClass("markdown-preview-view");

  // Use Obsidian's MarkdownRenderer to render the full note
  await MarkdownRenderer.render(app, content, container, file.path, component);

  // Process embedded images: convert vault images to base64 data URIs
  await embedImages(app, container, file);

  // Build the metadata header
  const metaHtml = buildMetadataHeader(file, metadata, settings);

  // Build the full HTML
  const bodyContent = metaHtml + container.innerHTML;

  return bodyContent;
}

/**
 * Wraps rendered content into a complete standalone HTML5 document.
 */
export function wrapInHtmlDocument(
  bodyContent: string,
  title: string,
  settings: NoteExportSettings
): string {
  const customCss = settings.customCssSnippet
    ? `\n<style>\n${settings.customCssSnippet}\n</style>`
    : "";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${EXPORT_CSS}
  </style>${customCss}
</head>
<body>
  <div class="ne-container">
${bodyContent}
  </div>
</body>
</html>`;
}

/**
 * Converts vault images in the rendered HTML to inline base64 data URIs.
 * This makes the HTML fully self-contained.
 */
async function embedImages(
  app: App,
  container: HTMLElement,
  sourceFile: TFile
): Promise<void> {
  const images = container.querySelectorAll("img");

  for (const img of Array.from(images)) {
    const src = img.getAttribute("src");
    if (!src) continue;

    // Skip already-embedded images and external URLs
    if (src.startsWith("data:") || src.startsWith("http://") || src.startsWith("https://")) {
      continue;
    }

    try {
      // Resolve the image path relative to the source file
      let imagePath = src;

      // Handle Obsidian's internal URL format (app://local/...)
      if (src.includes("app://")) {
        const match = src.match(/app:\/\/[^/]+\/(.+)/);
        if (match) {
          imagePath = decodeURIComponent(match[1]);
        }
      }

      // Try to find the file in the vault
      const imageFile = app.metadataCache.getFirstLinkpathDest(
        imagePath,
        sourceFile.path
      );

      if (imageFile) {
        const arrayBuffer = await app.vault.readBinary(imageFile);
        const base64 = arrayBufferToBase64(arrayBuffer);
        const mimeType = getMimeType(imageFile.extension);
        img.setAttribute("src", `data:${mimeType};base64,${base64}`);
      }
    } catch (e) {
      console.warn(`Note Export: Could not embed image ${src}`, e);
    }
  }
}

function buildMetadataHeader(
  file: TFile,
  metadata: ReturnType<App["metadataCache"]["getFileCache"]>,
  settings: NoteExportSettings
): string {
  if (!settings.includeMetadata) return "";

  const title = file.basename;
  const parts: string[] = [];

  parts.push(`<div class="ne-metadata">`);
  parts.push(`  <div class="ne-title">${escapeHtml(title)}</div>`);

  if (settings.includeDate) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("fr-FR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    parts.push(`  <div class="ne-date">Exporté le ${dateStr}</div>`);
  }

  // Add frontmatter tags if present
  if (metadata?.frontmatter?.tags) {
    const tags: string[] = Array.isArray(metadata.frontmatter.tags)
      ? metadata.frontmatter.tags
      : [metadata.frontmatter.tags];
    const tagHtml = tags
      .map((t: string) => `<span class="tag">#${escapeHtml(t)}</span>`)
      .join(" ");
    parts.push(`  <div class="ne-tags" style="margin-top: 0.5em;">${tagHtml}</div>`);
  }

  parts.push(`</div>`);

  return parts.join("\n");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    bmp: "image/bmp",
    ico: "image/x-icon",
  };
  return mimeTypes[extension.toLowerCase()] || "image/png";
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
