export function queryFirst(selectors: string[]): Element | null {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

export function queryAll(selectors: string[]): Element[] {
  for (const selector of selectors) {
    const nodes = Array.from(document.querySelectorAll(selector));
    if (nodes.length > 0) return nodes;
  }
  return [];
}

export function queryFirstWithin(root: Element, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }
  return null;
}

export function hasAnySelector(root: Element, selectors: string[]): boolean {
  return selectors.some((selector) => root.querySelector(selector) !== null);
}

export function safeTextContent(el: Element | null): string {
  return (el?.textContent || "").trim();
}
