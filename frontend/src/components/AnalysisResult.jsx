import { Download, RotateCcw } from "lucide-react";
import { useState } from "react";

import { Alert } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

function likelihoodText(value) {
  const lower = String(value || "").toLowerCase();
  if (lower === "high") return "Yüksek";
  if (lower === "medium") return "Orta";
  if (lower === "low") return "Düşük";
  return value;
}

export default function AnalysisResult({ report, onRestart }) {
  const [isExporting, setIsExporting] = useState(false);
  const profile = report.patient_profile || {};
  const evidence = report.evidence || [];
  const generatedAt = report.generated_at ? new Date(report.generated_at) : new Date();

  const exportPdf = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF("p", "mm", "a4");
      buildProfessionalPdf(pdf, report);
      pdf.save(`medgemma-klinik-rapor-${safeFileName(profile.full_name || "hasta")}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-5 bg-background p-1">
        {report.is_emergency && (
          <Alert variant="destructive">
            <strong>Acil değerlendirme uyarısı:</strong> {report.emergency_message || "Acil tıbbi değerlendirme gerekebilir."}
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Klinik Rapor</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
            <Info label="Hasta" value={profile.full_name || "Belirtilmedi"} />
            <Info label="Yaş / Cinsiyet" value={[profile.age, profile.gender].filter(Boolean).join(" / ") || "Belirtilmedi"} />
            <Info label="Boy / Kilo" value={[profile.height_cm ? `${profile.height_cm} cm` : "", profile.weight_kg ? `${profile.weight_kg} kg` : ""].filter(Boolean).join(" / ") || "Belirtilmedi"} />
            <Info label="Rapor tarihi" value={formatDateTime(generatedAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Genel Değerlendirme</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-7">{report.summary}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Klinik Gerekçe</CardTitle>
          </CardHeader>
          <CardContent>
            <BulletList items={report.clinical_reasoning} fallback="Klinik gerekçe üretilemedi." />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Olası Durumlar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.possible_conditions?.length ? (
              report.possible_conditions.map((condition) => (
                <div key={`${condition.name}-${condition.likelihood}`} className="rounded-md border border-border bg-white p-4 dark:bg-slate-900">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{condition.name}</h3>
                    <Badge>{likelihoodText(condition.likelihood)}</Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">{condition.explanation}</p>
                  {condition.evidence?.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-normal text-muted-foreground">Dayanaklar</p>
                      <BulletList items={condition.evidence} />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Model olası durum listesi üretmedi.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Öneriler</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <RecommendationList title="Yaşam tarzı" items={report.recommendations?.lifestyle} />
            <RecommendationList title="Beslenme" items={report.recommendations?.diet} />
            <RecommendationList title="İzlem" items={report.recommendations?.monitoring} />
            <div className="rounded-md border border-border bg-white p-4 dark:bg-slate-900">
              <h3 className="mb-2 font-semibold">Doktora başvurma önerisi</h3>
              <p className="text-sm leading-6 text-muted-foreground">{report.recommendations?.when_to_seek_care}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kaynak ve Dayanaklar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {evidence.length ? (
              evidence.map((item, index) => (
                <div key={`${item.source}-${index}`} className="rounded-md border border-border bg-white p-4 dark:bg-slate-900">
                  <h3 className="font-semibold">{item.source}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.finding}</p>
                  <p className="mt-2 text-sm leading-6">{item.relevance}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Kaynak/dayanak alanı üretilemedi.</p>
            )}
          </CardContent>
        </Card>

        <Alert>{report.disclaimer}</Alert>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={exportPdf} disabled={isExporting}>
          <Download className="h-4 w-4" /> {isExporting ? "Hazırlanıyor..." : "Raporu PDF olarak indir"}
        </Button>
        <Button type="button" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" /> Yeni Analiz Başlat
        </Button>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function RecommendationList({ title, items = [] }) {
  return (
    <div className="rounded-md border border-border bg-white p-4 dark:bg-slate-900">
      <h3 className="mb-2 font-semibold">{title}</h3>
      {items.length ? (
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>- {item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Öneri üretilmedi.</p>
      )}
    </div>
  );
}

function BulletList({ items = [], fallback = "Bilgi üretilmedi." }) {
  return items?.length ? (
    <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-sm text-muted-foreground">{fallback}</p>
  );
}

function formatDateTime(value) {
  if (!value) return "Belirtilmedi";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(value instanceof Date ? value : new Date(value));
}

function safeFileName(value) {
  return String(value || "hasta")
    .toLowerCase()
    .replace(/[^a-z0-9ğüşöçıİĞÜŞÖÇ-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function buildProfessionalPdf(pdf, report) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const profile = report.patient_profile || {};
  let y = 18;

  const addFooter = () => {
    const pageCount = pdf.internal.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      pdf.setPage(page);
      pdf.setDrawColor(220, 230, 232);
      pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(90, 105, 115);
      pdf.text("Bu rapor yapay zeka destekli klinik karar desteğidir; tanı veya tedavi yerine geçmez.", margin, pageHeight - 8);
      pdf.text(`${page}/${pageCount}`, pageWidth - margin - 8, pageHeight - 8);
    }
  };

  const ensureSpace = (needed = 18) => {
    if (y + needed <= pageHeight - 20) return;
    pdf.addPage();
    y = 18;
  };

  const wrappedText = (text, maxWidth = contentWidth) => pdf.splitTextToSize(String(text || ""), maxWidth);

  const sectionTitle = (title) => {
    ensureSpace(16);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(15, 23, 42);
    pdf.text(title, margin, y);
    y += 4;
    pdf.setDrawColor(15, 118, 110);
    pdf.setLineWidth(0.6);
    pdf.line(margin, y, margin + 34, y);
    y += 7;
  };

  const paragraph = (text, options = {}) => {
    const lines = wrappedText(text, options.width || contentWidth);
    ensureSpace(lines.length * 5 + 4);
    pdf.setFont("helvetica", options.bold ? "bold" : "normal");
    pdf.setFontSize(options.size || 10);
    pdf.setTextColor(...(options.color || [45, 55, 72]));
    pdf.text(lines, options.x || margin, y);
    y += lines.length * (options.lineHeight || 5) + (options.after || 4);
  };

  const bulletList = (items = []) => {
    if (!items.length) {
      paragraph("Bilgi üretilmedi.", { color: [100, 116, 139] });
      return;
    }
    items.forEach((item) => {
      const lines = wrappedText(`- ${item}`, contentWidth - 2);
      ensureSpace(lines.length * 5 + 3);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(45, 55, 72);
      pdf.text(lines, margin + 2, y);
      y += lines.length * 5 + 2;
    });
    y += 2;
  };

  const keyValue = (label, value, x, width) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(92, 105, 115);
    pdf.text(label, x, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(15, 23, 42);
    const lines = wrappedText(value || "Belirtilmedi", width);
    pdf.text(lines, x, y + 5);
  };

  pdf.setFillColor(15, 118, 110);
  pdf.rect(0, 0, pageWidth, 30, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(255, 255, 255);
  pdf.text("MedGemma Klinik Karar Destek Raporu", margin, 13);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(formatDateTime(report.generated_at || new Date()), margin, 22);
  y = 42;

  pdf.setDrawColor(220, 230, 232);
  pdf.setFillColor(248, 250, 252);
  pdf.roundedRect(margin, y - 5, contentWidth, 24, 2, 2, "FD");
  const colWidth = contentWidth / 4 - 3;
  keyValue("Hasta", profile.full_name || "Belirtilmedi", margin + 4, colWidth);
  keyValue("Yaş / Cinsiyet", [profile.age, profile.gender].filter(Boolean).join(" / ") || "Belirtilmedi", margin + colWidth + 7, colWidth);
  keyValue("Boy / Kilo", [profile.height_cm ? `${profile.height_cm} cm` : "", profile.weight_kg ? `${profile.weight_kg} kg` : ""].filter(Boolean).join(" / ") || "Belirtilmedi", margin + colWidth * 2 + 10, colWidth);
  keyValue("Hasta No", profile.patient_number || "Belirtilmedi", margin + colWidth * 3 + 13, colWidth);
  y += 30;

  if (report.is_emergency) {
    pdf.setFillColor(254, 226, 226);
    pdf.setDrawColor(239, 68, 68);
    const lines = wrappedText(`Acil değerlendirme uyarısı: ${report.emergency_message || "Acil tıbbi değerlendirme gerekebilir."}`);
    ensureSpace(lines.length * 5 + 12);
    pdf.roundedRect(margin, y - 4, contentWidth, lines.length * 5 + 8, 2, 2, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(127, 29, 29);
    pdf.text(lines, margin + 4, y + 2);
    y += lines.length * 5 + 12;
  }

  sectionTitle("Genel Değerlendirme");
  paragraph(report.summary);

  sectionTitle("Klinik Gerekçe");
  bulletList(report.clinical_reasoning || []);

  sectionTitle("Olası Durumlar");
  (report.possible_conditions || []).forEach((condition, index) => {
    ensureSpace(22);
    paragraph(`${index + 1}. ${condition.name} (${likelihoodText(condition.likelihood)})`, { bold: true, color: [15, 23, 42], after: 1 });
    paragraph(condition.explanation, { after: 1 });
    if (condition.evidence?.length) {
      paragraph("Dayanaklar:", { bold: true, size: 9, after: 1 });
      bulletList(condition.evidence);
    }
  });

  sectionTitle("Öneriler");
  paragraph("Yaşam tarzı", { bold: true, after: 1 });
  bulletList(report.recommendations?.lifestyle || []);
  paragraph("Beslenme", { bold: true, after: 1 });
  bulletList(report.recommendations?.diet || []);
  paragraph("İzlem", { bold: true, after: 1 });
  bulletList(report.recommendations?.monitoring || []);
  paragraph("Doktora başvurma önerisi", { bold: true, after: 1 });
  paragraph(report.recommendations?.when_to_seek_care || "Sağlık profesyoneline danışınız.");

  sectionTitle("Kaynak ve Dayanaklar");
  (report.evidence || []).forEach((item) => {
    paragraph(item.source, { bold: true, after: 1 });
    paragraph(`Bulgu: ${item.finding}`, { after: 1 });
    paragraph(`Klinik önemi: ${item.relevance}`, { color: [71, 85, 105] });
  });

  sectionTitle("Uyarı");
  paragraph(report.disclaimer || "Bu analiz yapay zeka tarafından üretilmiştir ve tıbbi teşhis yerine geçmez. Bir sağlık profesyoneline danışınız.");

  addFooter();
}
