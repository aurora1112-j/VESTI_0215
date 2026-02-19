import { inferTechTagsFromText, resolveTechTags } from "~lib/services/tagging";

export { inferTechTagsFromText, resolveTechTags };

export function formatRange(rangeStart: number, rangeEnd: number): string {
  const start = new Date(rangeStart).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const end = new Date(rangeEnd).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${start} - ${end}`;
}
