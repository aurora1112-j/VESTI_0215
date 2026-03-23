import { safeTextContent } from "./selectorUtils";

interface AppShellTextOptions {
  excludeWithinSelectors?: string[];
}

function getDomDepth(node: Element): number {
  let depth = 0;
  let current: Element | null = node;
  while (current) {
    depth += 1;
    current = current.parentElement;
  }
  return depth;
}

export function queryShallowestAppShellText(
  selectors: string[],
  options: AppShellTextOptions = {},
): string | null {
  const excludeWithinSelectors = options.excludeWithinSelectors ?? [];
  const candidates: Element[] = [];

  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((node) => {
      if (!(node instanceof Element)) {
        return;
      }

      const inExcludedArea = excludeWithinSelectors.some(
        (excludeSelector) => node.closest(excludeSelector) !== null,
      );
      if (inExcludedArea) {
        return;
      }

      const text = safeTextContent(node);
      if (!text) {
        return;
      }

      candidates.push(node);
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => {
    const depthDiff = getDomDepth(left) - getDomDepth(right);
    if (depthDiff !== 0) {
      return depthDiff;
    }
    const leftLen = safeTextContent(left).length;
    const rightLen = safeTextContent(right).length;
    return leftLen - rightLen;
  });

  const winner = candidates[0];
  return winner ? safeTextContent(winner) : null;
}
