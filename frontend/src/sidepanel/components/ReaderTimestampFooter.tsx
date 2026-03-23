import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReaderTimestampFooterModel } from "~lib/conversations/timestamps";

interface ReaderTimestampFooterProps {
  model: ReaderTimestampFooterModel;
}

export function ReaderTimestampFooter({ model }: ReaderTimestampFooterProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  return (
    <div className="border-t border-border-subtle px-4 py-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 text-left text-vesti-xs text-text-tertiary transition-colors hover:text-text-secondary"
      >
        <span className="min-w-0 flex-1 truncate">
          Started {model.summaryStarted}
          <span className="px-1 text-text-quaternary" aria-hidden="true">
            |
          </span>
          last updated {model.summaryUpdated}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          strokeWidth={1.75}
        />
      </button>

      <div
        id={detailsId}
        hidden={!open}
        className="mt-3 grid gap-2 text-vesti-xs text-text-secondary sm:grid-cols-2"
      >
        {model.details.map((detail) => (
          <div
            key={detail.key}
            className="rounded-md border border-border-subtle bg-surface-card px-3 py-2"
          >
            <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-text-quaternary">
              {detail.label}
            </div>
            <div className="mt-1 text-vesti-xs text-text-secondary">{detail.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
