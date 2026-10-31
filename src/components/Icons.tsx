import { Circle, CircleCheck, CircleQuestionMark } from 'lucide-solid';

export function HelpIcon() {
  return <CircleQuestionMark size={14} />;
}

export function CircleIcon() {
  return <Circle size={14} />;
}

export function CircleCheckIcon() {
  return <CircleCheck size={14} />;
}

export function LidoraMark(props: { size: number; class?: string }) {
  return (
    <svg class={props.class} width={props.size} height={props.size} viewBox="36 36 120 120" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round">
        <path d="M140 48 a92 92 0 0 0 -92 92" />
        <path d="M140 92 a48 48 0 0 0 -48 48" />
      </g>
      <circle cx="140" cy="140" r="14" fill="currentColor" />
    </svg>
  );
}
