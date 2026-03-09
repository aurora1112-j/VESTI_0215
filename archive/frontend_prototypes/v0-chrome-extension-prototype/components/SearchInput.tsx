// ============================================================
// --- components/SearchInput.tsx ---
// Search box with icon, focus ring, and optional filter button
// ============================================================
"use client";

import { Search, SlidersHorizontal } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "搜索对话标题或内容...",
}: SearchInputProps) {
  return (
    <div className="relative flex items-center">
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-text-tertiary"
        strokeWidth={1.75}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-sm border border-border-default bg-bg-primary pl-9 pr-9 text-vesti-md font-sans text-text-primary placeholder:text-text-tertiary transition-[border-color,box-shadow] duration-[120ms] ease-in-out focus-visible:border-border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-light"
      />
      <button
        type="button"
        aria-label="筛选"
        className="absolute right-2 flex h-6 w-6 items-center justify-center rounded-sm text-text-tertiary transition-colors duration-[120ms] hover:bg-accent-primary-light hover:text-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
      >
        <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
