import { Download, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";

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
  const reportRef = useRef(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPdf = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const width = pdf.internal.pageSize.getWidth();
      const height = (canvas.height * width) / canvas.width;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, width, height);
      let remainingHeight = height - pdf.internal.pageSize.getHeight();
      while (remainingHeight > 0) {
        position -= pdf.internal.pageSize.getHeight();
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, width, height);
        remainingHeight -= pdf.internal.pageSize.getHeight();
      }
      pdf.save("medgemma-rapor.pdf");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div ref={reportRef} className="space-y-5 bg-background p-1">
        {report.is_emergency && (
          <Alert variant="destructive">
            <strong>Acil değerlendirme uyarısı:</strong> {report.emergency_message || "Acil tıbbi değerlendirme gerekebilir."}
          </Alert>
        )}

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
