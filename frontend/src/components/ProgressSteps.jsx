import { Check } from "lucide-react";

const steps = ["Anamnez", "Dosyalar", "Analiz", "Ek sorular", "Rapor"];

export default function ProgressSteps({ currentStep }) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-5 gap-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isDone = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          return (
            <div key={step} className="min-w-0">
              <div
                className={[
                  "mb-2 h-2 rounded-full transition-colors",
                  isDone || isActive ? "bg-primary" : "bg-muted",
                ].join(" ")}
              />
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span
                  className={[
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : isActive
                        ? "border-primary text-primary"
                        : "border-border",
                  ].join(" ")}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                </span>
                <span className="truncate">{step}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
