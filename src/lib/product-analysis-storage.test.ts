import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveProductAnalysisUpload } from "@/lib/product-analysis-storage";
import { ProductAnalysisRedactionError } from "@/lib/product-analysis-redaction";

const {
  FIXED_UUID,
  MockProductAnalysisRedactionError,
  createSupabaseServiceClientMock,
  fromMock,
  getPublicUrlMock,
  sanitizeProductAnalysisPdfMock,
  uploadMock,
} = vi.hoisted(() => {
  return {
    FIXED_UUID: "00000000-0000-0000-0000-000000000000",
    MockProductAnalysisRedactionError: class extends Error {
      constructor(message: string) {
        super(message);
        this.name = "ProductAnalysisRedactionError";
      }
    },
    sanitizeProductAnalysisPdfMock: vi.fn(),
    uploadMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
    fromMock: vi.fn(),
    createSupabaseServiceClientMock: vi.fn(),
  };
});

vi.mock("node:crypto", () => {
  return {
    randomUUID: () => FIXED_UUID,
  };
});

vi.mock("@/lib/product-analysis-redaction", () => {
  return {
    ProductAnalysisRedactionError: MockProductAnalysisRedactionError,
    sanitizeProductAnalysisPdf: sanitizeProductAnalysisPdfMock,
  };
});

vi.mock("@/lib/supabase/admin", () => {
  return {
    createSupabaseServiceClient: createSupabaseServiceClientMock,
  };
});

function createPdfFile(bytes: Uint8Array, type = "application/pdf"): File {
  return new File([bytes], "analysis.pdf", { type });
}

describe("product-analysis-storage", () => {
  beforeEach(() => {
    sanitizeProductAnalysisPdfMock.mockReset();
    uploadMock.mockReset();
    getPublicUrlMock.mockReset();
    fromMock.mockReset();
    createSupabaseServiceClientMock.mockReset();

    fromMock.mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
      list: vi.fn(),
      remove: vi.fn(),
    });

    createSupabaseServiceClientMock.mockReturnValue({
      storage: {
        from: fromMock,
      },
    });

    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: {
        publicUrl: `https://example.test/storage/v1/object/public/product-analyses/${FIXED_UUID}.pdf`,
      },
    });
  });

  it("accepts a PDF without extractable text when sanitization returns it unchanged", async () => {
    const originalBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

    sanitizeProductAnalysisPdfMock.mockResolvedValue({
      bytes: originalBytes,
      redactionCount: 0,
    });

    const analysisPath = await saveProductAnalysisUpload(createPdfFile(originalBytes));

    expect(analysisPath).toBe(
      `https://example.test/storage/v1/object/public/product-analyses/${FIXED_UUID}.pdf`,
    );
    expect(sanitizeProductAnalysisPdfMock).toHaveBeenCalledWith(originalBytes);
    expect(uploadMock).toHaveBeenCalledWith(
      `${FIXED_UUID}.pdf`,
      Buffer.from(originalBytes),
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
  });

  it("uploads redacted bytes when sanitization rewrites the PDF", async () => {
    const originalBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32]);
    const sanitizedBytes = Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x39]);

    sanitizeProductAnalysisPdfMock.mockResolvedValue({
      bytes: sanitizedBytes,
      redactionCount: 2,
    });

    await saveProductAnalysisUpload(createPdfFile(originalBytes));

    expect(uploadMock).toHaveBeenCalledWith(
      `${FIXED_UUID}.pdf`,
      Buffer.from(sanitizedBytes),
      expect.objectContaining({ contentType: "application/pdf", upsert: false }),
    );
  });

  it("maps sanitizer redaction errors to a 422 upload error", async () => {
    sanitizeProductAnalysisPdfMock.mockRejectedValue(
      new ProductAnalysisRedactionError("Le fichier PDF est invalide ou corrompu."),
    );

    await expect(
      saveProductAnalysisUpload(
        createPdfFile(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x33])),
      ),
    ).rejects.toMatchObject({
      message: "Le fichier PDF est invalide ou corrompu.",
      status: 422,
    });
  });
});
