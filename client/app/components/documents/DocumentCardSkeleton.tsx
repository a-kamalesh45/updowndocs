export default function DocumentCardSkeleton() {
  return (
    <div className="flex flex-col rounded-[12px] border border-hairline bg-paper-raised p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-8 w-8 rounded-[6px] animate-shimmer" />
      </div>
      <div className="mb-4 h-16 rounded-[8px] animate-shimmer" />
      <div className="mb-3 h-4 w-2/3 rounded-full animate-shimmer" />
      <div className="mt-auto flex items-center justify-between pt-3 border-t border-hairline/70">
        <div className="h-3 w-24 rounded-full animate-shimmer" />
        <div className="h-3 w-12 rounded-full animate-shimmer" />
      </div>
    </div>
  );
}

export function DocumentGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <DocumentCardSkeleton key={i} />
      ))}
    </div>
  );
}
