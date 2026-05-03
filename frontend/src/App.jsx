import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Database, Loader2, Moon, Stethoscope, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import AnalysisResult from "./components/AnalysisResult";
import FileUpload from "./components/FileUpload";
import FollowUpQuestions from "./components/FollowUpQuestions";
import MedicalForm, { defaultFormValues } from "./components/MedicalForm";
import ProgressSteps from "./components/ProgressSteps";
import { Alert } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { analyze, completeAnalysis, getHealth } from "./lib/api";

function LoadingAnalysis({ title = "MedGemma tıbbi geçmişinizi analiz ediyor..." }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card>
      <CardContent className="flex min-h-80 flex-col items-center justify-center text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 text-primary">
          <Loader2 className="h-9 w-9 animate-spin" />
        </div>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Geçen süre: {seconds} sn</p>
        <div className="mt-6 h-2 w-full max-w-sm overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function HealthBadge() {
  const { data } = useQuery({ queryKey: ["health"], queryFn: getHealth, refetchInterval: 30000 });
  if (!data) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge variant={data.model_loaded ? "default" : "destructive"}>{data.mock_model ? "Mock model" : data.model_loaded ? "Model hazır" : "Model kapalı"}</Badge>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        {data.gpu_available ? data.gpu_name || "GPU aktif" : "GPU görünmüyor"}
      </span>
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Database className="h-3.5 w-3.5" />
        {data.model_id}
      </span>
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [formDraft, setFormDraft] = useState(defaultFormValues);
  const [formPayload, setFormPayload] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [followUpAnswers, setFollowUpAnswers] = useState(null);
  const [finalReport, setFinalReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const fileIds = useMemo(() => uploadedFiles.map((file) => file.file_id), [uploadedFiles]);

  const analyzeMutation = useMutation({
    mutationFn: analyze,
    onMutate: () => {
      setError("");
      setStep(3);
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      setFollowUpAnswers(null);
      setStep(4);
    },
    onError: (err) => {
      setError(err?.response?.data?.detail || "Analiz başlatılamadı.");
      setStep(2);
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeAnalysis,
    onMutate: () => setError(""),
    onSuccess: (data) => {
      setFinalReport(data);
      setStep(5);
    },
    onError: (err) => {
      setError(err?.response?.data?.detail || "Final analiz tamamlanamadı.");
    },
  });

  const startAnalyze = () => {
    if (!formPayload) return;
    analyzeMutation.mutate({
      ...formPayload,
      file_ids: fileIds,
      extra_notes: formPayload.medical_data.extra_notes || null,
    });
  };

  const restart = () => {
    setStep(1);
    setFormDraft(defaultFormValues);
    setFormPayload(null);
    setUploadedFiles([]);
    setAnalysisResult(null);
    setFollowUpAnswers(null);
    setFinalReport(null);
    setError("");
  };

  return (
    <main className="medical-grid min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-col gap-4 rounded-lg border border-border bg-white/90 p-5 shadow-soft backdrop-blur dark:bg-slate-950/90 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-normal">MedGemma Anamnez</h1>
              <HealthBadge />
            </div>
          </div>
          <Button type="button" variant="outline" size="icon" onClick={() => setDarkMode((value) => !value)} aria-label="Tema değiştir">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </header>

        <Alert>Bu uygulama tıbbi teşhis koymaz; doktor gözetiminde klinik karar destek amacıyla kullanılır.</Alert>

        <Card>
          <CardContent>
            <ProgressSteps currentStep={step} />
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <strong>Hata:</strong> {error}
          </Alert>
        )}

        {step === 1 && (
          <MedicalForm
            initialValues={formDraft}
            onDraftChange={setFormDraft}
            onSubmit={(payload, draft) => {
              setFormDraft(draft);
              setFormPayload(payload);
              setStep(2);
            }}
          />
        )}

        {step === 2 && (
          <FileUpload
            uploadedFiles={uploadedFiles}
            onChange={setUploadedFiles}
            onBack={() => setStep(1)}
            onContinue={startAnalyze}
          />
        )}

        {step === 3 && <LoadingAnalysis />}

        {step === 4 && analysisResult && completeMutation.isPending && <LoadingAnalysis title="Final rapor hazırlanıyor..." />}

        {step === 4 && analysisResult && !completeMutation.isPending && (
          <FollowUpQuestions
            analysis={analysisResult}
            value={followUpAnswers}
            onChange={setFollowUpAnswers}
            isSubmitting={completeMutation.isPending}
            onBack={() => setStep(2)}
            onSubmit={(answers) => completeMutation.mutate({ session_id: analysisResult.session_id, answers })}
          />
        )}

        {step === 5 && finalReport && <AnalysisResult report={finalReport} onRestart={restart} />}
      </div>
    </main>
  );
}
