'use client';

import DocumentCard, { DocumentItem } from './DocumentCard';

interface DocumentGridProps {
  documents: DocumentItem[];
  view: 'grid' | 'list';
  editingId: string | null;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartRename: (doc: DocumentItem) => void;
  onSubmitRename: (id: string) => void;
  onCancelRename: () => void;
  onRequestDelete: (doc: DocumentItem) => void;
}

export default function DocumentGrid({
  documents,
  view,
  editingId,
  editValue,
  onEditValueChange,
  onStartRename,
  onSubmitRename,
  onCancelRename,
  onRequestDelete,
}: DocumentGridProps) {
  if (view === 'list') {
    return (
      <div className="flex flex-col gap-2.5">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            doc={doc}
            view="list"
            isEditing={editingId === doc.id}
            editValue={editValue}
            onEditValueChange={onEditValueChange}
            onStartRename={() => onStartRename(doc)}
            onSubmitRename={() => onSubmitRename(doc.id)}
            onCancelRename={onCancelRename}
            onRequestDelete={() => onRequestDelete(doc)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          doc={doc}
          view="grid"
          isEditing={editingId === doc.id}
          editValue={editValue}
          onEditValueChange={onEditValueChange}
          onStartRename={() => onStartRename(doc)}
          onSubmitRename={() => onSubmitRename(doc.id)}
          onCancelRename={onCancelRename}
          onRequestDelete={() => onRequestDelete(doc)}
        />
      ))}
    </div>
  );
}
