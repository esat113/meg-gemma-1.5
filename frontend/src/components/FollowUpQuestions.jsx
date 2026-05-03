import { useEffect, useMemo, useState } from "react";

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
  const defaults = useMemo(() => {
    const result = {};
    analysis.follow_up_questions.forEach((question) => {
      result[question.id] = "";
    });
    return result;
  }, [analysis.follow_up_questions]);
  const [answers, setAnswers] = useState(value || defaults);

  useEffect(() => {
    const next = value || defaults;
    setAnswers(next);
    if (!value) {
      onChange?.(defaults);
    }
  }, [analysis.session_id, analysis.follow_up_questions, defaults, onChange, value]);

  const updateAnswer = (questionId, answer) => {
    const next = { ...answers, [questionId]: answer };
    setAnswers(next);
    onChange?.(next);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ek Sorular - Tur {round}/{totalRounds}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {analysis.is_emergency && (
          <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
            {analysis.emergency_message || "Acil değerlendirme gerektirebilecek bulgular bildirildi."}
          </div>
        )}

        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">{analysis.initial_assessment}</div>

        <div className="space-y-4">
          {analysis.follow_up_questions.map((question, index) => (
            <fieldset key={question.id} className="rounded-md border border-border bg-white p-4 dark:bg-slate-900">
              <legend className="px-1 text-sm font-semibold">
                {index + 1}. {question.question}
              </legend>
              <div className="mt-3 space-y-3">
                <Textarea
                  value={answers[question.id] || ""}
                  onChange={(event) => updateAnswer(question.id, event.target.value)}
                  placeholder="Yanıtı serbest metin olarak yazın. Emin değilseniz bunu da belirtebilirsiniz."
                  className="min-h-24"
                />
                {question.options?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {question.options.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => updateAnswer(question.id, option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSubmitting}>
            Geri
          </Button>
          <Button
            type="button"
            disabled={isSubmitting}
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
