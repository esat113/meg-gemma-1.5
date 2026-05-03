import { ChevronDown, ClipboardList, RotateCcw } from "lucide-react";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

function answerValue(answers, questionId) {
  return answers?.[questionId] || "";
}

function answeredCount(answers, questions) {
  return questions.filter((question) => answerValue(answers, question.id).trim()).length;
}

function QuestionInput({ question, register }) {
  const name = `static_question_answers.${question.id}`;
  if (question.answer_type === "select" || question.answer_type === "yes_no") {
    const options = question.options?.length ? question.options : ["Evet", "Hayır", "Emin değilim"];
    return (
      <Select {...register(name)}>
        <option value="">Boş bırak</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    );
  }

  if (question.answer_type === "text") {
    return <Input {...register(name)} placeholder={question.placeholder || "İsteğe bağlı yanıt"} />;
  }

  return <Textarea {...register(name)} placeholder={question.placeholder || "İsteğe bağlı yanıt"} className="min-h-24" />;
}

export default function StaticQuestionBank({ questionBank, answers, isLoading, error, register, setValue }) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Klinik tarama soruları yükleniyor...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Klinik tarama soruları yüklenemedi. Temel anamnez formuyla devam edebilirsiniz.
      </div>
    );
  }

  const sections = questionBank?.sections || [];
  if (!sections.length) {
    return (
      <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Klinik tarama soru bankasında soru bulunamadı.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const answered = answeredCount(answers, section.questions || []);
        return (
          <details key={section.id} defaultOpen={index === 0} className="group rounded-md border border-border bg-white dark:bg-slate-900">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{section.title}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {answered}/{section.questions?.length || 0} yanıtlandı
                  </span>
                </div>
                {section.description && <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>}
              </div>
              <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>

            <div className="border-t border-border px-4 py-4">
              <div className="mb-4 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    (section.questions || []).forEach((question) => {
                      setValue(`static_question_answers.${question.id}`, "", { shouldDirty: true });
                    });
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Bu kategoriyi temizle
                </Button>
              </div>

              <div className="grid gap-4">
                {(section.questions || []).map((question) => (
                  <div key={question.id} className="rounded-md border border-border bg-muted/20 p-3">
                    <Label className="text-sm font-medium">{question.question}</Label>
                    <div className="mt-2">
                      <QuestionInput question={question} register={register} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
