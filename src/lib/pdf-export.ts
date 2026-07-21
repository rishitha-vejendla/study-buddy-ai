import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

function sanitize(name: string) {
  return name.replace(/[^\w\s-]/g, "").trim().slice(0, 60) || "studymate";
}

export function downloadTextPdf(title: string, content: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const marginY = 56;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - marginX * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(title, maxW);
  doc.text(titleLines, marginX, marginY);
  let y = marginY + titleLines.length * 22 + 12;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  const paragraphs = content.split(/\n/);
  for (const raw of paragraphs) {
    const line = raw.trimEnd();
    if (!line) {
      y += 8;
      continue;
    }
    const isHeading = /^#{1,6}\s/.test(line);
    const text = line.replace(/^#{1,6}\s*/, "").replace(/^\s*[-*]\s+/, "• ");
    if (isHeading) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
    }
    const wrapped = doc.splitTextToSize(text, maxW);
    for (const w of wrapped) {
      if (y > pageH - marginY) {
        doc.addPage();
        y = marginY;
      }
      doc.text(w, marginX, y);
      y += isHeading ? 20 : 16;
    }
    if (isHeading) y += 4;
  }
  doc.save(`${sanitize(title)}.pdf`);
}

export async function downloadHandwrittenPdf(elOrId: HTMLElement | string, title: string) {
  const el =
    typeof elOrId === "string"
      ? (document.getElementById(elOrId) as HTMLElement | null)
      : elOrId;
  if (!el) throw new Error("Handwritten notes container not found");

  // Ensure webfonts (Caveat / Patrick Hand) are fully loaded before capture
  if (typeof document !== "undefined" && (document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {}
  }

  const canvas = await html2canvas(el, {
    scale: Math.max(2, window.devicePixelRatio || 2),
    backgroundColor: "#fdfaf1",
    useCORS: true,
    allowTaint: false,
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
  });

  const img = canvas.toDataURL("image/jpeg", 0.95);
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW - 40;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH - 40) {
    pdf.addImage(img, "JPEG", 20, 20, imgW, imgH);
  } else {
    const pageCanvasH = (canvas.width * (pageH - 40)) / imgW;
    let renderedH = 0;
    let first = true;
    while (renderedH < canvas.height) {
      const sliceH = Math.min(pageCanvasH, canvas.height - renderedH);
      const c = document.createElement("canvas");
      c.width = canvas.width;
      c.height = sliceH;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#fdfaf1";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(canvas, 0, renderedH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      const slice = c.toDataURL("image/jpeg", 0.95);
      if (!first) pdf.addPage();
      pdf.addImage(slice, "JPEG", 20, 20, imgW, (sliceH * imgW) / canvas.width);
      renderedH += sliceH;
      first = false;
    }
  }
  pdf.save(`${sanitize(title)}-handwritten.pdf`);
}
