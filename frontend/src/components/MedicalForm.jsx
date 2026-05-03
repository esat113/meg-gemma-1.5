import { Clock, Plus, Trash2, UserRound, X } from "lucide-react";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

const symptoms = [
  "Ağrı",
  "Yorgunluk",
  "Nefes darlığı",
  "Baş dönmesi",
  "Bulantı/Kusma",
  "Ateş",
  "Öksürük",
  "Döküntü",
  "Uyku sorunları",
  "İştah değişikliği",
  "Diğer",
];

const diseaseSuggestions = ["Diyabet", "Hipertansiyon", "Astım", "Kalp Hastalığı", "Tiroid"];
const allergySuggestions = ["Penisilin", "Aspirin", "Lateks", "Fıstık", "Deniz ürünleri"];

function ErrorText({ message }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function Field({ label, children, error }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
      <ErrorText message={error?.message} />
    </div>
  );
}

function ChipInput({ label, value, suggestions, onChange, placeholder }) {
  const addValue = (raw) => {
    const next = raw.trim();
    if (!next || value.includes(next)) return;
    onChange([...value, next]);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="rounded-md border border-border bg-white p-2 dark:bg-slate-900">
        <div className="mb-2 flex flex-wrap gap-2">
          {value.map((item) => (
            <span key={item} className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-900">
              {item}
              <button type="button" onClick={() => onChange(value.filter((chip) => chip !== item))} aria-label={`${item} sil`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <input
          className="h-8 w-full bg-transparent text-sm outline-none"
          placeholder={placeholder}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue(event.currentTarget.value);
              event.currentTarget.value = "";
            }
          }}
        />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {suggestions.map((item) => (
          <Button key={item} type="button" variant="secondary" size="sm" onClick={() => addValue(item)}>
            {item}
          </Button>
        ))}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function PatientHistory({ selectedPatient }) {
  const analyses = selectedPatient?.analyses || [];
  if (!selectedPatient) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hasta Geçmişi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-4 w-4" />
            {selectedPatient.full_name || selectedPatient.patient_number || "Seçili hasta"}
          </span>
          <span>{analyses.length} kayıtlı analiz</span>
        </div>
        {analyses.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {analyses.slice(0, 6).map((analysis) => {
              const complaint = analysis.anamnesis?.medical_data?.chief_complaint || "Şikayet metni yok";
              const reportSummary = analysis.final_report?.summary;
              return (
                <div key={analysis.id} className="rounded-md border border-border bg-white p-3 dark:bg-slate-900">
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDate(analysis.created_at)}
                  </div>
                  <p className="text-sm font-medium">{complaint}</p>
                  {reportSummary && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{reportSummary}</p>}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Bu hasta için henüz analiz kaydı yok.</p>
        )}
      </CardContent>
    </Card>
  );
}

export const defaultFormValues = {
  patient_profile: {
    patient_number: "",
    full_name: "",
    phone: "",
    email: "",
    birth_date: "",
    age: "",
    gender: "Kadın",
    height_cm: "",
    weight_kg: "",
    notes: "",
  },
  medical_data: {
    chief_complaint: "",
    complaint_start_date: "",
    complaint_duration: "Günler",
    severity: 5,
    symptoms: [],
    chronic_diseases: [],
    past_surgeries: "",
    family_history: "",
    allergies: [],
    current_medications: [{ name: "", dose: "", frequency: "" }],
    uses_supplements: false,
    smoking: "Hayır",
    alcohol: "Hayır",
    physical_activity: "Hafif",
    extra_notes: "",
  },
};

function cleanPayload(values) {
  return {
    patient_profile: {
      ...values.patient_profile,
      email: values.patient_profile.email || null,
      birth_date: values.patient_profile.birth_date || null,
      age: Number(values.patient_profile.age),
      height_cm: values.patient_profile.height_cm ? Number(values.patient_profile.height_cm) : null,
      weight_kg: values.patient_profile.weight_kg ? Number(values.patient_profile.weight_kg) : null,
      patient_number: values.patient_profile.patient_number || null,
      full_name: values.patient_profile.full_name || null,
      phone: values.patient_profile.phone || null,
      notes: values.patient_profile.notes || null,
    },
    medical_data: {
      ...values.medical_data,
      complaint_start_date: values.medical_data.complaint_start_date || null,
      severity: Number(values.medical_data.severity),
      current_medications: values.medical_data.current_medications.filter((item) => item.name?.trim()),
      past_surgeries: values.medical_data.past_surgeries || null,
      family_history: values.medical_data.family_history || null,
      extra_notes: values.medical_data.extra_notes || null,
    },
  };
}

export default function MedicalForm({
  initialValues = defaultFormValues,
  resetKey = 0,
  patients = [],
  selectedPatient = null,
  isLoadingPatient = false,
  onSelectPatient,
  onClearPatient,
  onDraftChange,
  onSubmit,
}) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: initialValues });
  const { fields, append, remove } = useFieldArray({ control, name: "medical_data.current_medications" });
  const chronicDiseases = watch("medical_data.chronic_diseases");
  const allergies = watch("medical_data.allergies");
  const severity = watch("medical_data.severity");

  useEffect(() => {
    reset(initialValues);
  }, [reset, resetKey]);

  useEffect(() => {
    if (!onDraftChange) return undefined;
    const subscription = watch((values) => onDraftChange(values));
    return () => subscription.unsubscribe();
  }, [onDraftChange, watch]);

  return (
    <form onSubmit={handleSubmit((values) => onSubmit(cleanPayload(values), values))} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Kayıtlı Hasta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div>
            <Label>Profil seç</Label>
            <Select
              value={selectedPatient?.id || ""}
              onChange={(event) => {
                if (event.target.value && onSelectPatient) onSelectPatient(event.target.value);
              }}
              disabled={isLoadingPatient || !patients.length}
            >
              <option value="">{patients.length ? "Kayıtlı hasta seçin" : "Kayıtlı hasta yok"}</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {(patient.full_name || patient.patient_number || "İsimsiz hasta") +
                    (patient.latest_complaint ? ` - ${patient.latest_complaint.slice(0, 70)}` : "")}
                </option>
              ))}
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Hasta numarası yoksa backend aynı Ad Soyad ile gelen analizleri aynı profilde toplar. Test için ad soyadı bir kez “Esat” olarak yazmanız yeterli.
            </p>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" disabled={isLoadingPatient} onClick={onClearPatient}>
              Boş form aç
            </Button>
          </div>
        </CardContent>
      </Card>

      <PatientHistory selectedPatient={selectedPatient} />

      <Card>
        <CardHeader>
          <CardTitle>Klinik Profil</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Hasta No">
            <Input {...register("patient_profile.patient_number")} placeholder="Klinik hasta no" />
          </Field>
          <Field label="Ad Soyad">
            <Input {...register("patient_profile.full_name")} placeholder="Opsiyonel" />
          </Field>
          <Field label="Telefon">
            <Input {...register("patient_profile.phone")} placeholder="+90..." />
          </Field>
          <Field label="E-posta" error={errors.patient_profile?.email}>
            <Input type="email" {...register("patient_profile.email")} placeholder="hasta@example.com" />
          </Field>
          <Field label="Doğum Tarihi">
            <Input type="date" {...register("patient_profile.birth_date")} />
          </Field>
          <Field label="Yaş" error={errors.patient_profile?.age}>
            <Input type="number" min="0" max="120" {...register("patient_profile.age", { required: "Yaş zorunlu", min: 0, max: 120 })} />
          </Field>
          <Field label="Cinsiyet">
            <Select {...register("patient_profile.gender")}>
              <option>Kadın</option>
              <option>Erkek</option>
              <option>Diğer</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kilo (kg)">
              <Input type="number" step="0.1" {...register("patient_profile.weight_kg")} />
            </Field>
            <Field label="Boy (cm)">
              <Input type="number" step="0.1" {...register("patient_profile.height_cm")} />
            </Field>
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <Field label="Klinik notlar">
              <Textarea {...register("patient_profile.notes")} placeholder="Hasta profili için ek notlar" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ana Şikayet</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="Mevcut şikayet/semptomlar" error={errors.medical_data?.chief_complaint}>
              <Textarea
                {...register("medical_data.chief_complaint", { required: "Ana şikayet zorunlu", minLength: { value: 3, message: "En az 3 karakter girin" } })}
                placeholder="Hastanın ana şikayetini klinik dille yazın"
              />
            </Field>
          </div>
          <Field label="Başlangıç tarihi">
            <Input type="date" {...register("medical_data.complaint_start_date")} />
          </Field>
          <Field label="Şikayet süresi">
            <Select {...register("medical_data.complaint_duration")}>
              <option>Saatler</option>
              <option>Günler</option>
              <option>Haftalar</option>
              <option>Aylar</option>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Label>Şiddet: {severity}/10</Label>
            <input type="range" min="1" max="10" className="w-full accent-teal-700" {...register("medical_data.severity")} />
          </div>
          <div className="md:col-span-2">
            <Label>Semptom tipi</Label>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {symptoms.map((symptom) => (
                <label key={symptom} className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm dark:bg-slate-900">
                  <input type="checkbox" value={symptom} className="h-4 w-4 accent-teal-700" {...register("medical_data.symptoms")} />
                  {symptom}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tıbbi Geçmiş ve İlaçlar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChipInput
              label="Kronik hastalıklar"
              value={chronicDiseases}
              suggestions={diseaseSuggestions}
              onChange={(next) => setValue("medical_data.chronic_diseases", next)}
              placeholder="Enter ile ekleyin"
            />
            <ChipInput
              label="Alerjiler"
              value={allergies}
              suggestions={allergySuggestions}
              onChange={(next) => setValue("medical_data.allergies", next)}
              placeholder="İlaç/besin alerjisi ekleyin"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Geçirilmiş ameliyatlar">
              <Textarea {...register("medical_data.past_surgeries")} />
            </Field>
            <Field label="Aile hastalık geçmişi">
              <Textarea {...register("medical_data.family_history")} />
            </Field>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <Label className="mb-0">Mevcut ilaçlar</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", dose: "", frequency: "" })}>
                <Plus className="h-4 w-4" /> İlaç Ekle
              </Button>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="grid gap-3 rounded-md border border-border bg-white p-3 md:grid-cols-[1fr_1fr_1fr_auto] dark:bg-slate-900">
                  <Input placeholder="İlaç adı" {...register(`medical_data.current_medications.${index}.name`)} />
                  <Input placeholder="Doz" {...register(`medical_data.current_medications.${index}.dose`)} />
                  <Input placeholder="Kullanım sıklığı" {...register(`medical_data.current_medications.${index}.frequency`)} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} aria-label="İlaç sil">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-teal-700" {...register("medical_data.uses_supplements")} />
            Vitamin/takviye kullanımı var
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Yaşam Tarzı ve Ek Notlar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <Field label="Sigara kullanımı">
            <Select {...register("medical_data.smoking")}>
              <option>Hayır</option>
              <option>Bıraktım</option>
              <option>Aktif</option>
            </Select>
          </Field>
          <Field label="Alkol kullanımı">
            <Select {...register("medical_data.alcohol")}>
              <option>Hayır</option>
              <option>Ara sıra</option>
              <option>Düzenli</option>
            </Select>
          </Field>
          <Field label="Fiziksel aktivite">
            <Select {...register("medical_data.physical_activity")}>
              <option>Sedanter</option>
              <option>Hafif</option>
              <option>Orta</option>
              <option>Yoğun</option>
            </Select>
          </Field>
          <div className="md:col-span-3">
            <Field label="Ek notlar">
              <Textarea {...register("medical_data.extra_notes")} placeholder="Eklemek istediğiniz başka bilgi var mı?" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">Dosya yükleme adımına geç</Button>
      </div>
    </form>
  );
}
