import { ChevronLeft } from 'lucide-react';

export function BackButton(props: { label: string; onBack: () => void }) {
  return (
    <button type="button" className="back" onClick={props.onBack}>
      <ChevronLeft size={24} strokeWidth={2} aria-hidden="true" />
      <span>{props.label}</span>
    </button>
  );
}
