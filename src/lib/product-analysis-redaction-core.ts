import path from "node:path";

const PAGE_RENDER_SCALE = 2;
const REDACTION_PADDING = 8;
const MAX_ADDRESS_BLOCK_LINES = 4;
const LINE_MERGE_TOLERANCE = 4;
const ADDRESS_LINE_VERTICAL_GAP = 30;

const ADDRESS_LABEL_REGEX =
  /\b(?:adresse|address|adresse\s+de\s+production|adresse\s+producteur|producer\s+address|operator\s+address)\b/;
const STREET_DETAIL_REGEX =
  /\b(?:rue|route|avenue|av\b|av\.|chemin|impasse|boulevard|bd\b|bd\.|allee|all[ée]e|place|quai|faubourg|lieu[- ]dit|lotissement|zone artisanale|za\b|zi\b|street|st\b|st\.|road|rd\b|rd\.|lane|drive|dr\b|dr\.|way|parkway|blvd\b|blvd\.|suite)\b/;
const POSTAL_DETAIL_REGEX =
  /\b(?:fr-\d{5}|\d{5}|cedex|france|belgique|belgium|germany|deutschland|spain|espana|italy|italia)\b/;
const ADDRESS_NUMBER_REGEX = /^\d{1,4}[a-z]?(?:\s|,|-).+/;
const NON_ADDRESS_LABEL_REGEX =
  /^(?:date|batch|lot|sample|echantillon|analysis|analyse|result|resultat|status|statut|client|laboratoire|laboratory|lab|product|produit)\b.*:?\s*$/;

type Rect = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type PdfTextItem = {
  str: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL?: boolean;
};

type LineItem = {
  rect: Rect;
  text: string;
};

type TextLine = {
  bounds: Rect;
  items: LineItem[];
  normalizedText: string;
  text: string;
};

export class ProductAnalysisRedactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductAnalysisRedactionError";
  }
}

let pdfjsLoaded = false;

async function ensurePdfjsWorker(): Promise<void> {
  if (pdfjsLoaded) return;
  const { WorkerMessageHandler } = await import(
    "pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  const g = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: typeof WorkerMessageHandler };
  };
  g.pdfjsWorker ??= {};
  g.pdfjsWorker.WorkerMessageHandler = WorkerMessageHandler;
  pdfjsLoaded = true;
}

async function loadPdfjs() {
  await ensurePdfjsWorker();
  return await import("pdfjs-dist/legacy/build/pdf.mjs");
}

async function getPdfDocumentInit(data: Uint8Array) {
  const { VerbosityLevel, getDocument } = await loadPdfjs();
  const standardFontsDir =
    `${path.join(process.cwd(), "node_modules", "pdfjs-dist", "standard_fonts").replace(/\\/g, "/")}/`;

  return {
    getDocument,
    init: {
      data,
      useSystemFonts: true,
      standardFontDataUrl: standardFontsDir,
      verbosity: VerbosityLevel.ERRORS,
    } as Parameters<typeof getDocument>[0],
  };
}

function toRedactionError(error: unknown): ProductAnalysisRedactionError {
  if (error instanceof ProductAnalysisRedactionError) {
    return error;
  }

  if (error instanceof Error) {
    if (error.message.includes("standardFontDataUrl")) {
      return new ProductAnalysisRedactionError(
        "Le moteur PDF serveur n'a pas pu charger ses polices standards.",
      );
    }

    if (error.message.includes("Password")) {
      return new ProductAnalysisRedactionError("Le PDF est protege par mot de passe.");
    }

    if (error.message.includes("InvalidPDF")) {
      return new ProductAnalysisRedactionError("Le fichier PDF est invalide ou corrompu.");
    }

    return new ProductAnalysisRedactionError(error.message);
  }

  return new ProductAnalysisRedactionError("Impossible de sanitiser automatiquement ce PDF.");
}

function isPdfTextItem(value: unknown): value is PdfTextItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PdfTextItem>;
  return (
    typeof candidate.str === "string" &&
    typeof candidate.width === "number" &&
    typeof candidate.height === "number" &&
    Array.isArray(candidate.transform) &&
    candidate.transform.length === 6
  );
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function createRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x0: Math.min(x0, x1),
    y0: Math.min(y0, y1),
    x1: Math.max(x0, x1),
    y1: Math.max(y0, y1),
  };
}

function expandRect(rect: Rect, padding: number): Rect {
  return {
    x0: rect.x0 - padding,
    y0: rect.y0 - padding,
    x1: rect.x1 + padding,
    y1: rect.y1 + padding,
  };
}

function mergeRects(a: Rect, b: Rect): Rect {
  return {
    x0: Math.min(a.x0, b.x0),
    y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1),
    y1: Math.max(a.y1, b.y1),
  };
}

function getRectHeight(rect: Rect): number {
  return Math.max(0, rect.y1 - rect.y0);
}

function getRectCenterY(rect: Rect): number {
  return rect.y0 + getRectHeight(rect) / 2;
}

function getVerticalGap(upper: Rect, lower: Rect): number {
  return upper.y0 - lower.y1;
}

function isStandaloneFieldLabel(normalizedText: string): boolean {
  if (!normalizedText) {
    return false;
  }

  if (NON_ADDRESS_LABEL_REGEX.test(normalizedText)) {
    return true;
  }

  if (!normalizedText.endsWith(":")) {
    return false;
  }

  const words = normalizedText.slice(0, -1).trim().split(" ").filter(Boolean);
  return words.length > 0 && words.length <= 5;
}

function isAddressLabelLine(normalizedText: string): boolean {
  return ADDRESS_LABEL_REGEX.test(normalizedText);
}

function isAddressDetailLine(normalizedText: string): boolean {
  if (!normalizedText) {
    return false;
  }

  return (
    STREET_DETAIL_REGEX.test(normalizedText) ||
    POSTAL_DETAIL_REGEX.test(normalizedText) ||
    ADDRESS_NUMBER_REGEX.test(normalizedText)
  );
}

function itemToRect(item: PdfTextItem): Rect {
  const x = item.transform[4] ?? 0;
  const y = item.transform[5] ?? 0;
  const width = Math.max(Math.abs(item.width) || 0, 4);
  const height = Math.max(Math.abs(item.height) || Math.abs(item.transform[3] ?? 0) || 0, 8);
  return createRect(x, y, x + width, y + height);
}

function buildTextLines(items: unknown[]): TextLine[] {
  const sortedItems = items
    .filter(isPdfTextItem)
    .map((item) => ({
      rect: itemToRect(item),
      text: item.str.trim(),
    }))
    .filter((item) => item.text.length > 0)
    .sort((a, b) => {
      const vertical = getRectCenterY(b.rect) - getRectCenterY(a.rect);
      if (Math.abs(vertical) > LINE_MERGE_TOLERANCE) {
        return vertical;
      }

      return a.rect.x0 - b.rect.x0;
    });

  const lines: TextLine[] = [];

  for (const item of sortedItems) {
    const itemCenterY = getRectCenterY(item.rect);
    const existingLine = lines.find(
      (line) =>
        Math.abs(itemCenterY - getRectCenterY(line.bounds)) <=
        Math.max(LINE_MERGE_TOLERANCE, getRectHeight(item.rect) * 0.5),
    );

    if (existingLine) {
      existingLine.items.push(item);
      existingLine.bounds = mergeRects(existingLine.bounds, item.rect);
      continue;
    }

    lines.push({
      bounds: item.rect,
      items: [item],
      normalizedText: "",
      text: "",
    });
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.rect.x0 - b.rect.x0);
    line.text = line.items.map((item) => item.text).join(" ").replace(/\s+/g, " ").trim();
    line.normalizedText = normalizeText(line.text);
  }

  return lines.sort((a, b) => getRectCenterY(b.bounds) - getRectCenterY(a.bounds));
}

function collectAddressBlocks(lines: TextLine[]): Rect[] {
  const blocks: Rect[] = [];
  const consumedLineIndexes = new Set<number>();

  for (let index = 0; index < lines.length; index += 1) {
    if (consumedLineIndexes.has(index)) {
      continue;
    }

    const currentLine = lines[index];
    const isAddressAnchor = isAddressLabelLine(currentLine.normalizedText);
    const isAddressDetail = isAddressDetailLine(currentLine.normalizedText);

    if (!isAddressAnchor && !isAddressDetail) {
      continue;
    }

    const blockIndexes = [index];
    consumedLineIndexes.add(index);
    let blockRect = currentLine.bounds;

    for (
      let nextIndex = index + 1;
      nextIndex < lines.length && blockIndexes.length < MAX_ADDRESS_BLOCK_LINES;
      nextIndex += 1
    ) {
      const nextLine = lines[nextIndex];
      const verticalGap = getVerticalGap(
        lines[blockIndexes[blockIndexes.length - 1]].bounds,
        nextLine.bounds,
      );
      if (verticalGap > ADDRESS_LINE_VERTICAL_GAP) {
        break;
      }

      if (isStandaloneFieldLabel(nextLine.normalizedText) && !isAddressDetailLine(nextLine.normalizedText)) {
        break;
      }

      if (!isAddressDetailLine(nextLine.normalizedText)) {
        if (isAddressAnchor) {
          continue;
        }

        break;
      }

      consumedLineIndexes.add(nextIndex);
      blockIndexes.push(nextIndex);
      blockRect = mergeRects(blockRect, nextLine.bounds);
    }

    blocks.push(expandRect(blockRect, REDACTION_PADDING));
  }

  return blocks;
}

function convertPdfRectToCanvasRect(
  viewport: { convertToViewportRectangle: (rect: [number, number, number, number]) => number[] },
  rect: Rect,
): Rect {
  const [x0, y0, x1, y1] = viewport.convertToViewportRectangle([
    rect.x0,
    rect.y0,
    rect.x1,
    rect.y1,
  ]);
  return createRect(x0, y0, x1, y1);
}

async function renderRedactedPdf(bytes: Uint8Array, redactionBlocksByPage: Rect[][]): Promise<Uint8Array> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const { PDFDocument } = await import("pdf-lib");
  const { getDocument, init } = await getPdfDocumentInit(bytes.slice());
  const loadingTask = getDocument(init);
  const sourcePdf = await loadingTask.promise;
  const targetPdf = await PDFDocument.create();

  try {
    for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
      const page = await sourcePdf.getPage(pageNumber);
      const renderViewport = page.getViewport({ scale: PAGE_RENDER_SCALE });
      const outputViewport = page.getViewport({ scale: 1 });
      const canvas = createCanvas(
        Math.max(1, Math.ceil(renderViewport.width)),
        Math.max(1, Math.ceil(renderViewport.height)),
      );
      const context = canvas.getContext("2d");
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";

      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport: renderViewport,
      }).promise;

      const redactionBlocks = redactionBlocksByPage[pageNumber - 1] ?? [];
      context.fillStyle = "#ffffff";

      for (const block of redactionBlocks) {
        const canvasRect = convertPdfRectToCanvasRect(renderViewport, block);
        context.fillRect(
          canvasRect.x0,
          canvasRect.y0,
          Math.max(1, canvasRect.x1 - canvasRect.x0),
          Math.max(1, canvasRect.y1 - canvasRect.y0),
        );
      }

      const pageImageBytes = await canvas.encode("jpeg", 90);
      const embeddedPageImage = await targetPdf.embedJpg(pageImageBytes);
      const targetPage = targetPdf.addPage([outputViewport.width, outputViewport.height]);

      targetPage.drawImage(embeddedPageImage, {
        x: 0,
        y: 0,
        width: outputViewport.width,
        height: outputViewport.height,
      });
    }

    return await targetPdf.save();
  } finally {
    await sourcePdf.destroy();
  }
}

export async function sanitizeProductAnalysisPdf(
  bytes: Uint8Array,
): Promise<{ bytes: Uint8Array; redactionCount: number }> {
  const { getDocument, init } = await getPdfDocumentInit(bytes.slice());
  let loadingTask: ReturnType<typeof getDocument> | undefined;

  try {
    loadingTask = getDocument(init);

    const pdf = await loadingTask.promise;
    const redactionBlocksByPage: Rect[][] = [];
    let totalTextLines = 0;
    let totalRedactions = 0;

    try {
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const textLines = buildTextLines(textContent.items);
        totalTextLines += textLines.length;

        const redactionBlocks = collectAddressBlocks(textLines);
        redactionBlocksByPage.push(redactionBlocks);
        totalRedactions += redactionBlocks.length;
      }
    } finally {
      await pdf.destroy();
    }

    if (totalTextLines === 0) {
      // Scanned/image-only PDFs are accepted, but cannot be auto-redacted.
      return { bytes, redactionCount: 0 };
    }

    if (totalRedactions === 0) {
      return { bytes, redactionCount: 0 };
    }

    const sanitizedBytes = await renderRedactedPdf(bytes, redactionBlocksByPage);
    return { bytes: sanitizedBytes, redactionCount: totalRedactions };
  } catch (error) {
    throw toRedactionError(error);
  } finally {
    await loadingTask?.destroy();
  }
}
