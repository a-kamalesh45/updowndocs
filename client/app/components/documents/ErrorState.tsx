import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  onRetry: () => void;
}

export default function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-hairline bg-paper-raised py-24 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#A33A3A]/10 text-[#A33A3A]">
        <AlertTriangle size={20} strokeWidth={1.75} />
      </div>
      <h3 className="font-serif text-lg text-ink">Unable to load documents</h3>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-taupe">
        Something went wrong while loading your workspace.
      </p>
      <button
        onClick={onRetry}
        className="mt-6 inline-flex items-center gap-2 rounded-[6px] border border-hairline bg-paper-raised px-5 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-[#c7bda6]"
      >
        Try Again
      </button>
    </div>
  );
}
