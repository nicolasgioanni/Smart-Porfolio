import type { DetailMode } from "@/lib/content/detailNarratives";

type DetailLevelControlProps = {
  contextLabel: string;
  mode: DetailMode;
  onChange: (mode: DetailMode) => void;
};

const detailModes: Array<{ label: string; value: DetailMode }> = [
  { label: "Overview", value: "overview" },
  { label: "Technical", value: "technical" }
];

export function DetailLevelControl({ contextLabel, mode, onChange }: DetailLevelControlProps) {
  return (
    <div className="detail-mode-control">
      <span aria-hidden="true" className="detail-mode-control__label">
        Detail
      </span>
      <div aria-label={`${contextLabel} detail level`} className="detail-mode-switch" data-mode={mode} role="group">
        <span aria-hidden="true" className="detail-mode-switch__lens" />
        {detailModes.map((option) => (
          <button
            aria-pressed={mode === option.value}
            className="detail-mode-switch__button"
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <span aria-live="polite" className="visually-hidden">
        {mode === "overview" ? "Showing overview details." : "Showing technical details."}
      </span>
    </div>
  );
}
