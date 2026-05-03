import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Database, Loader2, Moon, Stethoscope, Sun } from "lucide-react";
import { Component, useEffect, useMemo, useState } from "react";

import AnalysisResult from "./components/AnalysisResult";
import FileUpload from "./components/FileUpload";
import FollowUpQuestions from "./components/FollowUpQuestions";
import MedicalForm, { defaultFormValues } from "./components/MedicalForm";
import ProgressSteps from "./components/ProgressSteps";
import { Alert } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import { analyze, completeAnalysis, getApiErrorMessage, getHealth, getPatient, getPatients, requestFollowUp, savePatientProfile } from "./lib/api";

const FORM_DRAFT_KEY = "medgemma-form-draft-v1";

function loadStoredDraft() {
  try {
    const stored = window.localStorage.getItem(FORM_DRAFT_KEY);
    if (!stored) return defaultFormValues;
    const parsed = JSON.parse(stored);
    return {
      patient_profile: { ...defaultFormValues.patient_profile, ...parsed.patient_profile },
      medical_data: { ...defaultFormValues.medical_data, ...parsed.medical_data },
    };
  } catch {
    return defaultFormValues;
  }
}

function ensureMedicationRows(items) {
  return Array.isArray(items) && items.length ? items : [{ name: "", dose: "", frequency: "" }];
}

function valuesFromPatientDetail(patient) {
  return valuesFromPatientAnalysis(patient, patient.analyses?.[0]);
}

function valuesFromPatientAnalysis(patient, analysis) {
  const latestAnamnesis = analysis?.anamnesis || {};
  const latestProfile = latestAnamnesis.patient_profile || {};
  const latestMedicalData = latestAnamnesis.medical_data || {};

  return {
    patient_profile: {
      ...defaultFormValues.patient_profile,
      patient_number: latestProfile.patient_number || patient.patient_number || "",
      full_name: latestProfile.full_name || patient.full_name || "",
      phone: latestProfile.phone || patient.phone || "",
      email: latestProfile.email || patient.email || "",
      birth_date: latestProfile.birth_date || patient.birth_date || "",
      age: latestProfile.age ?? patient.age ?? "",
      gender: latestProfile.gender || patient.gender || defaultFormValues.patient_profile.gender,
      height_cm: latestProfile.height_cm ?? patient.height_cm ?? "",
      weight_kg: latestProfile.weight_kg ?? patient.weight_kg ?? "",
      notes: latestProfile.notes || patient.notes || "",
    },
    medical_data: {
      ...defaultFormValues.medical_data,
      ...latestMedicalData,
      chief_complaint: latestMedicalData.chief_complaint || "",
      complaint_start_date: latestMedicalData.complaint_start_date || "",
      symptoms: latestMedicalData.symptoms || [],
      chronic_diseases: latestMedicalData.chronic_diseases || [],
      allergies: latestMedicalData.allergies || [],
      current_medications: ensureMedicationRows(latestMedicalData.current_medications),
      past_surgeries: latestMedicalData.past_surgeries || "",
      family_history: latestMedicalData.family_history || "",
      extra_notes: latestMedicalData.extra_notes || "",
    },
  };
}

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

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="medical-grid min-h-screen px-4 py-5 md:px-8">
          <div className="mx-auto max-w-3xl space-y-4">
            <Alert variant="destructive">
              <strong>Uygulama hatası:</strong> Sayfa beklenmeyen bir hata nedeniyle durdu. Lütfen sayfayı yenileyin.
            </Alert>
            <pre className="overflow-auto rounded-md border border-border bg-white p-4 text-xs text-muted-foreground dark:bg-slate-900">
              {this.state.error?.message || String(this.state.error)}
            </pre>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [darkMode, setDarkMode] = useState(false);
  const [formDraft, setFormDraft] = useState(loadStoredDraft);
  const [formPayload, setFormPayload] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [followUpAnswers, setFollowUpAnswers] = useState(null);
  const [followUpRound, setFollowUpRound] = useState(1);
  const [allFollowUpAnswers, setAllFollowUpAnswers] = useState([]);
  const [finalReport, setFinalReport] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    window.localStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(formDraft));
  }, [formDraft]);

  const { data: patients = [] } = useQuery({ queryKey: ["patients"], queryFn: getPatients });

  const patientMutation = useMutation({
    mutationFn: getPatient,
    onMutate: () => setError(""),
    onSuccess: (patient) => {
      setSelectedPatient(patient);
      const nextValues = valuesFromPatientDetail(patient);
      setFormDraft(nextValues);
      setFormVersion((value) => value + 1);
      setFormPayload(null);
      setUploadedFiles([]);
      setAnalysisResult(null);
      setFollowUpAnswers(null);
      setFollowUpRound(1);
      setAllFollowUpAnswers([]);
      setFinalReport(null);
      setStep(1);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Hasta profili yüklenemedi."));
    },
  });

  const fileIds = useMemo(() => uploadedFiles.map((file) => file.file_id), [uploadedFiles]);

  const analyzeMutation = useMutation({
    mutationFn: analyze,
    onMutate: () => {
      setError("");
      setNotice("");
      setStep(3);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setAnalysisResult(data);
      setFollowUpAnswers(null);
      setFollowUpRound(1);
      setAllFollowUpAnswers([]);
      setStep(4);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Analiz başlatılamadı."));
      setStep(2);
    },
  });

  const completeMutation = useMutation({
    mutationFn: completeAnalysis,
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      setFinalReport(data);
      setStep(5);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Final analiz tamamlanamadı."));
    },
  });

  const followUpMutation = useMutation({
    mutationFn: requestFollowUp,
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: (data, variables) => {
      setAllFollowUpAnswers((current) => [...current, ...variables.answers]);
      setAnalysisResult(data);
      setFollowUpAnswers(null);
      setFollowUpRound(2);
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Ek sorular işlenemedi."));
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: savePatientProfile,
    onMutate: () => {
      setError("");
      setNotice("");
    },
    onSuccess: (data) => {
      setNotice(data.message || "Profil kaydedildi.");
      queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, "Profil kaydedilemedi."));
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
    setFormVersion((value) => value + 1);
    window.localStorage.removeItem(FORM_DRAFT_KEY);
    setFormPayload(null);
    setUploadedFiles([]);
    setAnalysisResult(null);
    setFollowUpAnswers(null);
    setFollowUpRound(1);
    setAllFollowUpAnswers([]);
    setFinalReport(null);
    setSelectedPatient(null);
    setError("");
    setNotice("");
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

        {notice && <Alert>{notice}</Alert>}

        {step === 1 && (
          <MedicalForm
            initialValues={formDraft}
            resetKey={formVersion}
            patients={patients}
            selectedPatient={selectedPatient}
            isLoadingPatient={patientMutation.isPending}
            isSavingProfile={saveProfileMutation.isPending}
            onSelectPatient={(patientId) => patientMutation.mutate(patientId)}
            onClearPatient={() => {
              setSelectedPatient(null);
              setFormDraft(defaultFormValues);
              setFormVersion((value) => value + 1);
              setFormPayload(null);
              setUploadedFiles([]);
            }}
            onUseAnalysis={(analysis) => {
              if (!selectedPatient) return;
              setFormDraft(valuesFromPatientAnalysis(selectedPatient, analysis));
              setFormVersion((value) => value + 1);
              setFormPayload(null);
              setUploadedFiles([]);
              setAnalysisResult(null);
              setFollowUpAnswers(null);
              setFollowUpRound(1);
              setAllFollowUpAnswers([]);
              setFinalReport(null);
              setStep(1);
            }}
            onSaveProfile={(payload, draft) => {
              setFormDraft(draft);
              setFormPayload(payload);
              saveProfileMutation.mutate({
                ...payload,
                file_ids: [],
                extra_notes: payload.medical_data.extra_notes || null,
              });
            }}
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

        {step === 4 && analysisResult && followUpMutation.isPending && <LoadingAnalysis title="Cevaplar işleniyor, hedefli ikinci tur sorular hazırlanıyor..." />}

        {step === 4 && analysisResult && completeMutation.isPending && <LoadingAnalysis title="Final rapor hazırlanıyor..." />}

        {step === 4 && analysisResult && !completeMutation.isPending && !followUpMutation.isPending && (
          <FollowUpQuestions
            analysis={analysisResult}
            value={followUpAnswers}
            onChange={setFollowUpAnswers}
            isSubmitting={completeMutation.isPending || followUpMutation.isPending}
            onBack={() => setStep(2)}
            round={followUpRound}
            totalRounds={2}
            submitLabel={followUpRound === 1 ? "Cevapları işle ve yeni sorular üret" : "Final raporu hazırla"}
            onSubmit={(answers) => {
              if (followUpRound === 1) {
                followUpMutation.mutate({ session_id: analysisResult.session_id, answers });
                return;
              }
              completeMutation.mutate({
                session_id: analysisResult.session_id,
                answers: [...allFollowUpAnswers, ...answers],
              });
            }}
          />
        )}

        {step === 5 && finalReport && <AnalysisResult report={finalReport} onRestart={restart} />}
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
