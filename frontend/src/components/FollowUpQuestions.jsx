import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Textarea } from "./ui/textarea";

export default function FollowUpQuestions({
  analysis,
  value,
  onChange,
  isSubmitting,
  onSubmit,
  onBack,
  round = 1,
  totalRounds = 2,
  submitLabel = "Devam et",
}) {
  const questions = analysis.follow_up_questions || [];
  const questionSetKey = useMemo(
    () => `${analysis.session_id}:${round}:${questions.map((question) => question.id).join("|")}`,
    [analysis.session_id, questions, round],
  );
  const defaults = useMemo(() => {
    const result = {};
    questions.forEach((question) => {
      result[question.id] = "";
    });
    return result;
  }, [questions]);
  const [answers, setAnswers] = useState(value || defaults);
  const answersRef = useRef(value || defaults);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((question) => (answers[question.id] || "").trim()).length;
  const emptyCount = Math.max(questions.length - answeredCount, 0);

  useEffect(() => {
    const next = { ...defaults, ...(value || {}) };
    answersRef.current = next;
    setAnswers(next);
    setCurrentIndex(0);
    if (!value) {
      onChange?.(defaults);
    }
  }, [questionSetKey]);

  const updateAnswer = (questionId, answer) => {
    const next = { ...answersRef.current, [questionId]: answer };
    answersRef.current = next;
    setAnswers(next);
    onChange?.(next);
  };

  const goPrevious = () => setCurrentIndex((index) => Math.max(0, index - 1));
  const goNext = () => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1));

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!event.altKey) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [questions.length]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Ek Sorular - Tur {round}/{totalRounds}</CardTitle>
          <div className="text-sm text-muted-foreground">
            {questions.length ? `${currentIndex + 1}/${questions.length} soru - ${answeredCount} yanıtlandı` : "Soru yok"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {analysis.is_emergency && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
            {analysis.emergency_message || "Acil değerlendirme gerektirebilecek bulgular bildirildi."}
          </div>
        )}

        {questions.length > 1 && (
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {questions.map((question, index) => {
              const isActive = index === currentIndex;
              const isAnswered = Boolean((answers[question.id] || "").trim());
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={[
                    "h-2 rounded-full transition",
                    isActive ? "bg-primary" : isAnswered ? "bg-teal-300" : "bg-muted",
                  ].join(" ")}
                  aria-label={`${index + 1}. soruya git`}
                />
              );
            })}
          </div>
        )}

        {currentQuestion && (
          <fieldset className="rounded-md border border-border bg-white p-4 dark:bg-slate-900">
            <legend className="px-1 text-sm font-semibold">
              {currentIndex + 1}. {currentQuestion.question}
            </legend>
            <div className="mt-3 space-y-3">
              <Textarea
                value={answers[currentQuestion.id] || ""}
                onChange={(event) => updateAnswer(currentQuestion.id, event.target.value)}
                placeholder="Yanıtı serbest metin olarak yazın. Emin değilseniz bunu da belirtebilirsiniz."
                className="min-h-36"
              />
              {currentQuestion.options?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentQuestion.options.map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => updateAnswer(currentQuestion.id, option)}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </fieldset>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="outline" onClick={goPrevious} disabled={isSubmitting || currentIndex === 0}>
            <ArrowLeft className="h-4 w-4" /> Önceki soru
          </Button>
          <Button type="button" variant="outline" onClick={goNext} disabled={isSubmitting || currentIndex >= questions.length - 1}>
            Sonraki soru <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {questions.length > 1 && (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={[
                    "rounded-md border px-3 py-2 text-left text-xs transition",
                    index === currentIndex
                      ? "border-primary bg-white text-primary shadow-soft dark:bg-slate-900"
                      : (answers[question.id] || "").trim()
                        ? "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100"
                        : "border-border bg-white text-muted-foreground dark:bg-slate-900",
                  ].join(" ")}
                >
                  {index + 1}. {(answers[question.id] || "").trim() ? "Yanıtlandı" : "Boş"}
                </button>
              ))}
            </div>
          </div>
        )}

        {emptyCount > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {emptyCount} soru henüz boş. İsterseniz boş bırakarak devam edebilirsiniz; cevaplanmayan sorular “Yanıt verilmedi” olarak işlenecek.
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            Dosya adımına dön
          </Button>
          <Button
            type="button"
            disabled={isSubmitting || !questions.length}
            onClick={() =>
              onSubmit(
                Object.entries(answers).map(([question_id, selected_option]) => ({
                  question_id,
                  selected_option: selected_option?.trim() || "Yanıt verilmedi",
                })),
              )
            }
          >
            {isSubmitting ? "İşleniyor..." : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
