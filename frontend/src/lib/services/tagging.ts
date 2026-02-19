export const TECH_KEYWORDS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\breact\b/i, label: "React" },
  { pattern: /typescript|\bts\b/i, label: "TypeScript" },
  { pattern: /plasmo/i, label: "Plasmo" },
  { pattern: /tailwind/i, label: "Tailwind CSS" },
  { pattern: /dexie|indexeddb/i, label: "IndexedDB" },
  { pattern: /chrome extension|mv3|manifest/i, label: "Chrome Extension" },
  { pattern: /modelscope|qwen|deepseek/i, label: "ModelScope" },
  { pattern: /python/i, label: "Python" },
  { pattern: /node\.js|nodejs|node /i, label: "Node.js" },
  { pattern: /zod/i, label: "Zod" },
  { pattern: /parser|selector/i, label: "Parser" },
  { pattern: /prompt|schema/i, label: "Prompt Engineering" },
];

function normalizeTag(tag: string): string {
  return tag.replace(/\s+/g, " ").trim();
}

export function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

export function inferTechTagsFromText(text: string): string[] {
  const tags: string[] = [];
  for (const item of TECH_KEYWORDS) {
    if (item.pattern.test(text)) {
      tags.push(item.label);
    }
    if (tags.length >= 3) break;
  }
  return dedupeTags(tags);
}

export function resolveTechTags(
  explicitTags: string[] | undefined,
  fallbackText: string
): string[] {
  const explicit = dedupeTags(explicitTags ?? []).slice(0, 6);
  if (explicit.length > 0) return explicit;

  const inferred = inferTechTagsFromText(fallbackText);
  if (inferred.length > 0) return inferred;

  return ["General"];
}
