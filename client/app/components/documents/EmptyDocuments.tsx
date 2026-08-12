import { FileText, Plus } from 'lucide-react';

interface EmptyDocumentsProps {
  onCreate: () => void;
  filtered?: boolean;
}

export default function EmptyDocuments({ onCreate, filtered = false }: EmptyDocumentsProps) {
  if (filtered) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-hairline py-24 text-center">
        <h3 className="font-serif text-lg text-ink">No documents found</h3>
        <p className="mt-2 text-[13px] text-taupe">Try a different search.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-[12px] border border-dashed border-hairline py-24 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-paper text-taupe">
        <FileText size={20} strokeWidth={1.75} />
      </div>
      <h3 className="font-serif text-lg text-ink">No documents yet</h3>
      <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-taupe">
        Create your first document and start collaborating in real time.
      </p>
      <button
        onClick={onCreate}
        className="group mt-6 inline-flex items-center gap-2 rounded-[6px] bg-ink px-5 py-2.5 text-[13px] font-medium text-paper transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#33312e]"
      >
        <Plus size={14} strokeWidth={2.25} />
        Create Document
      </button>
    </div>
  );
}
