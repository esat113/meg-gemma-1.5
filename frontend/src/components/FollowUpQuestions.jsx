import { useMemo, useState } from "react";

import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

export default function FollowUpQuestions({ analysis, isSubmitting, onSubmit, onBack }) {
  const defaults = useMemo(() => {
    const result = {};
    analysis.follow_up_questions.forEach((question) => {
      result[question.id] = question.options.find((option) => option.includes("Bilmiyorum") || option.includes("know")) || question.options[0];
    });
    return result;
  }, [analysis.follow_up_questions]);
  const [answers, setAnswers] = useState(defaults);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ek Sorular</CardTitle>
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
              <div className="mt-3 grid gap-2">
                {question.options.map((option) => (
                  <label key={option} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                    <input
                      type="radio"
                      name={question.id}
                      value={option}
                      checked={answers[question.id] === option}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                      className="h-4 w-4 accent-teal-700"
                    />
                    {option}
                  </label>
                ))}
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
                  selected_option,
                })),
              )
            }
          >
            {isSubmitting ? "Tamamlanıyor..." : "Analizi Tamamla"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
