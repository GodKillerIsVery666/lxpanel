import type { ReactNode } from "react";

export interface WizardStep {
  id: string;
  title: string;
  detail: string;
  content: ReactNode;
}

interface StepWizardProps {
  steps: WizardStep[];
  activeStep: number;
  onStepChange: (step: number) => void;
}

export function StepWizard({ steps, activeStep, onStepChange }: StepWizardProps): JSX.Element {
  if (steps.length === 0) {
    return <div className="step-wizard" />;
  }
  const step = steps[Math.min(activeStep, steps.length - 1)]!;
  return (
    <div className="step-wizard">
      <div className="step-track" role="tablist">
        {steps.map((item, index) => (
          <button key={item.id} type="button" role="tab" aria-selected={activeStep === index} className={activeStep === index ? "active" : ""} onClick={() => onStepChange(index)}>
            <span>{index + 1}</span>
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>
      <div className="step-content">
        <p className="muted-text">{step.detail}</p>
        {step.content}
      </div>
    </div>
  );
}
