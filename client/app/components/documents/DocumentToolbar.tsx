'use client';

import { Search, Grid2x2, List, ChevronDown } from 'lucide-react';

export type SortOption = 'updated' | 'title';

interface DocumentToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortOption;
  onSortChange: (value: SortOption) => void;
  view: 'grid' | 'list';
  onViewChange: (value: 'grid' | 'list') => void;
}

export default function DocumentToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: DocumentToolbarProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search
          size={15}
          strokeWidth={2}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-taupe"
        />
        <input
          id="document-search-input"
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return;
            if (query) {
              onQueryChange('');
            } else {
              e.currentTarget.blur();
            }
          }}
          placeholder="Search documents... (⌘K)"
          aria-label="Search documents"
          className="w-full rounded-[7px] border border-hairline bg-paper-raised py-2 pl-9 pr-3 text-[13px] text-ink outline-none transition-colors placeholder:text-taupe focus:border-[#c7bda6]"
        />
      </div>

      <div className="flex items-center gap-3 self-end sm:self-auto">
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            aria-label="Sort documents"
            className="appearance-none rounded-[7px] border border-hairline bg-paper-raised py-2 pl-3 pr-8 text-[13px] text-ink outline-none transition-colors focus:border-[#c7bda6]"
          >
            <option value="updated">Recently updated</option>
            <option value="title">Title A–Z</option>
          </select>
          <ChevronDown
            size={13}
            strokeWidth={2}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-taupe"
          />
        </div>

        <div className="flex items-center rounded-[7px] border border-hairline bg-paper-raised p-0.5">
          <button
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
            onClick={() => onViewChange('grid')}
            className={`rounded-[5px] p-1.5 transition-colors ${
              view === 'grid' ? 'bg-ink text-paper' : 'text-taupe hover:text-ink'
            }`}
          >
            <Grid2x2 size={14} strokeWidth={2} />
          </button>
          <button
            aria-label="List view"
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
            className={`rounded-[5px] p-1.5 transition-colors ${
              view === 'list' ? 'bg-ink text-paper' : 'text-taupe hover:text-ink'
            }`}
          >
            <List size={14} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
