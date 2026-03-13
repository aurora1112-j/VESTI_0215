import { SearchLineIcon } from "./ThreadSearchIcons";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search conversations",
}: SearchInputProps) {
  return (
    <div className="relative flex items-center">
      <SearchLineIcon className="pointer-events-none absolute left-3 h-4 w-4 text-text-tertiary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-sm border border-border-default bg-bg-primary pl-9 pr-3 text-vesti-md font-sans text-text-primary placeholder:text-text-tertiary transition-[border-color,box-shadow] [transition-duration:120ms] ease-in-out focus-visible:border-border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-light"
      />
    </div>
  );
}

