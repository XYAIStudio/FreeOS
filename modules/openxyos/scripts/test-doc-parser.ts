import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph } from "docx";
import ExcelJS from "exceljs";
import { extractText } from "../backend/services/doc-parser";

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "freeos-doc-parser-"));
  try {
    const text = "FreeOS document import acceptance";
    const pdf = new PDFDocument();
    const chunks: Buffer[] = [];
    const finished = new Promise<Buffer>((resolve, reject) => {
      pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.on("error", reject);
    });
    pdf.text(text);
    pdf.end();
    const pdfPath = path.join(root, "sample.pdf");
    await fs.writeFile(pdfPath, await finished);
    assert.ok((await extractText(pdfPath, ".pdf")).includes(text));

    const docxPath = path.join(root, "sample.docx");
    const docx = new Document({ sections: [{ children: [new Paragraph(text)] }] });
    await fs.writeFile(docxPath, await Packer.toBuffer(docx));
    assert.equal(await extractText(docxPath, ".docx"), text);

    // Exercise ExcelJS with the patched, CommonJS-compatible UUID dependency.
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet("Import").addRow([text]);
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await workbook.xlsx.writeBuffer());
    assert.equal(restored.getWorksheet("Import")?.getCell("A1").value, text);
    console.log("PDF, DOCX and XLSX import/export acceptance passed");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
