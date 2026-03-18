import type { Platform } from "../../../types";

type MathDomPlatform =
  | "ChatGPT"
  | "Claude"
  | "Gemini"
  | "Qwen"
  | "DeepSeek"
  | "Doubao";

type MathNormalizationMode =
  | "annotation-family"
  | "gemini"
  | "doubao";

const PRIMARY_SELECTOR_BY_PLATFORM: Record<MathDomPlatform, string[]> = {
  ChatGPT: [
    "annotation[encoding='application/x-tex']",
    "script[type='math/tex']",
    "[data-tex]",
  ],
  Claude: [
    ".katex-mathml annotation",
    "annotation[encoding='application/x-tex']",
    "script[type='math/tex']",
  ],
  Gemini: [
    ".math-block[data-math]",
    ".math-inline[data-math]",
    "[data-math]",
    "[data-formula]",
    "script[type='math/tex']",
    "annotation[encoding='application/x-tex']",
  ],
  Qwen: [
    ".qwen-markdown-latex",
    ".katex-mathml annotation",
    "annotation[encoding='application/x-tex']",
    "script[type='math/tex']",
  ],
  DeepSeek: [
    ".ds-markdown-math",
    ".katex-mathml annotation",
    "annotation[encoding='application/x-tex']",
    "script[type='math/tex']",
  ],
  Doubao: [
    ".math-inline[data-custom-copy-text]",
    ".math-block[data-custom-copy-text]",
    "[data-custom-copy-text]",
  ],
};

const FALLBACK_INLINE_PATTERNS = [
  /\$\$([\s\S]+?)\$\$/,
  /\\\[([\s\S]+?)\\\]/,
  /\\\(([\s\S]+?)\\\)/,
];

export interface MathProbeResult {
  tex: string;
  display: boolean;
  source:
    | "annotation"
    | "script"
    | "data-custom-copy-text"
    | "data-math"
    | "data-formula"
    | "data-tex"
    | "regex-fallback";
}

function isSupportedMathPlatform(platform: Platform): platform is MathDomPlatform {
  return Object.prototype.hasOwnProperty.call(PRIMARY_SELECTOR_BY_PLATFORM, platform);
}

const HARD_ANCHOR_SELECTORS_BY_PLATFORM: Partial<Record<MathDomPlatform, string[]>> = {
  ChatGPT: [
    ".katex-mathml annotation[encoding='application/x-tex']",
    "annotation[encoding='application/x-tex']",
  ],
  Claude: [
    ".katex-mathml annotation[encoding='application/x-tex']",
    "annotation[encoding='application/x-tex']",
  ],
  Qwen: [
    ".katex-mathml annotation[encoding='application/x-tex']",
    "annotation[encoding='application/x-tex']",
  ],
  DeepSeek: [
    ".katex-mathml annotation[encoding='application/x-tex']",
    "annotation[encoding='application/x-tex']",
  ],
  Gemini: ["[data-math]"],
  Doubao: ["[data-custom-copy-text]"],
};

function collapseSerializedBackslashes(value: string): string {
  return value.replace(/\\\\(?=[A-Za-z()[\]{}.,;!:=<>|+\-*/_^])/g, "\\");
}

function stripOuterMathDelimiters(value: string): string {
  let tex = value.trim();
  let changed = true;

  while (changed) {
    changed = false;
    if (tex.startsWith("$$") && tex.endsWith("$$")) {
      tex = tex.slice(2, -2).trim();
      changed = true;
      continue;
    }
    if (tex.startsWith("\\[") && tex.endsWith("\\]")) {
      tex = tex.slice(2, -2).trim();
      changed = true;
      continue;
    }
    if (tex.startsWith("\\(") && tex.endsWith("\\)")) {
      tex = tex.slice(2, -2).trim();
      changed = true;
    }
  }

  return tex;
}

function normalizeTex(raw: string, mode: MathNormalizationMode): string {
  let tex = raw.replace(/\u00a0/g, " ").trim();
  if (!tex) return "";

  if (mode === "annotation-family" || mode === "gemini") {
    tex = collapseSerializedBackslashes(tex);
  }

  return stripOuterMathDelimiters(tex);
}

function inferDisplayMode(element: Element, raw: string): boolean {
  const rawTrimmed = raw.trim();
  if (
    (rawTrimmed.startsWith("$$") && rawTrimmed.endsWith("$$")) ||
    (rawTrimmed.startsWith("\\[") && rawTrimmed.endsWith("\\]"))
  ) {
    return true;
  }

  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const cls = element.className?.toString().toLowerCase() ?? "";
  if (cls.includes("katex-display") || cls.includes("math-display") || cls.includes("display")) {
    return true;
  }

  const displayAttr =
    element.getAttribute("data-display") ?? element.getAttribute("display") ?? "";
  if (/^(block|display|true|1)$/i.test(displayAttr)) {
    return true;
  }

  const tag = element.tagName.toLowerCase();
  return tag === "div" || tag === "section" || tag === "figure";
}

function querySelfOrDescendant(root: Element, selector: string): Element | null {
  if (root.matches(selector)) return root;
  return root.querySelector(selector);
}

function readAttrFromSelfOrDescendant(
  root: Element,
  selector: string,
  attributeName: string,
): string | null {
  const node = querySelfOrDescendant(root, selector);
  if (!node) return null;
  const value = node.getAttribute(attributeName);
  return value && value.trim().length > 0 ? value : null;
}

function readTextFromSelfOrDescendant(root: Element, selector: string): string | null {
  const node = querySelfOrDescendant(root, selector);
  if (!node) return null;
  const value = node.textContent ?? "";
  return value.trim().length > 0 ? value : null;
}

function extractRegexTex(rawText: string): string | null {
  for (const pattern of FALLBACK_INLINE_PATTERNS) {
    const match = rawText.match(pattern);
    if (match?.[0]) {
      return match[0];
    }
  }
  return null;
}

function matchesAnyMathMarker(element: Element, selectors: string[]): boolean {
  return selectors.some((selector) => element.matches(selector));
}

export function isLikelyMathElement(element: Element, platform: Platform): boolean {
  const tag = element.tagName.toLowerCase();
  if (tag === "pre" || tag === "code" || tag === "style") {
    return false;
  }

  if (tag === "script") {
    return element.getAttribute("type") === "math/tex";
  }

  if (isSupportedMathPlatform(platform)) {
    const selectors = PRIMARY_SELECTOR_BY_PLATFORM[platform];
    if (matchesAnyMathMarker(element, selectors)) {
      return true;
    }
  }

  const classHint = element.className?.toString().toLowerCase() ?? "";
  if (
    classHint.includes("katex") ||
    classHint.includes("mathjax") ||
    classHint.includes("mjx") ||
    classHint.includes("math")
  ) {
    return true;
  }

  if (
    element.getAttribute("data-math") ||
    element.getAttribute("data-formula") ||
    element.getAttribute("data-tex") ||
    element.getAttribute("data-custom-copy-text")
  ) {
    return true;
  }

  return false;
}

export function hasHardMathAnchor(element: Element, platform: Platform): boolean {
  if (!isSupportedMathPlatform(platform)) {
    return false;
  }

  const selectors = HARD_ANCHOR_SELECTORS_BY_PLATFORM[platform] ?? [];
  return selectors.some(
    (selector) => element.matches(selector) || element.querySelector(selector) !== null,
  );
}

function fromRaw(
  raw: string,
  element: Element,
  source: MathProbeResult["source"],
  mode: MathNormalizationMode,
): MathProbeResult | null {
  const normalizedRaw = mode === "annotation-family" || mode === "gemini"
    ? collapseSerializedBackslashes(raw.replace(/\u00a0/g, " ").trim())
    : raw.replace(/\u00a0/g, " ").trim();
  const tex = normalizeTex(raw, mode);
  if (!tex) return null;

  return {
    tex,
    display: inferDisplayMode(element, normalizedRaw),
    source,
  };
}

function probeAnnotationFamilyMath(
  root: Element,
  options: {
    allowDataTex?: boolean;
    allowRegexFallback?: boolean;
  } = {},
): MathProbeResult | null {
  const katexAnnotation = readTextFromSelfOrDescendant(root, ".katex-mathml annotation");
  if (katexAnnotation) {
    return fromRaw(katexAnnotation, root, "annotation", "annotation-family");
  }

  const annotation = readTextFromSelfOrDescendant(
    root,
    "annotation[encoding='application/x-tex']",
  );
  if (annotation) {
    return fromRaw(annotation, root, "annotation", "annotation-family");
  }

  const scriptTex = readTextFromSelfOrDescendant(root, "script[type='math/tex']");
  if (scriptTex) {
    return fromRaw(scriptTex, root, "script", "annotation-family");
  }

  if (options.allowDataTex) {
    const dataTex = readAttrFromSelfOrDescendant(root, "[data-tex]", "data-tex");
    if (dataTex) {
      return fromRaw(dataTex, root, "data-tex", "annotation-family");
    }
  }

  if (options.allowRegexFallback) {
    const regexTex = extractRegexTex(root.textContent ?? "");
    if (regexTex) {
      return fromRaw(regexTex, root, "regex-fallback", "annotation-family");
    }
  }

  return null;
}

function probeChatGptMath(root: Element): MathProbeResult | null {
  return probeAnnotationFamilyMath(root, { allowDataTex: true });
}

function probeClaudeMath(root: Element): MathProbeResult | null {
  return probeAnnotationFamilyMath(root, { allowRegexFallback: true });
}

function probeGeminiMath(root: Element): MathProbeResult | null {
  const dataMath = readAttrFromSelfOrDescendant(root, "[data-math]", "data-math");
  if (dataMath) {
    return fromRaw(dataMath, root, "data-math", "gemini");
  }

  const dataFormula = readAttrFromSelfOrDescendant(root, "[data-formula]", "data-formula");
  if (dataFormula) {
    return fromRaw(dataFormula, root, "data-formula", "gemini");
  }

  const scriptTex = readTextFromSelfOrDescendant(root, "script[type='math/tex']");
  if (scriptTex) {
    return fromRaw(scriptTex, root, "script", "gemini");
  }

  const annotation = readTextFromSelfOrDescendant(
    root,
    "annotation[encoding='application/x-tex']",
  );
  if (annotation) {
    return fromRaw(annotation, root, "annotation", "gemini");
  }

  const regexTex = extractRegexTex(root.textContent ?? "");
  if (regexTex) {
    return fromRaw(regexTex, root, "regex-fallback", "gemini");
  }

  return null;
}

function probeQwenMath(root: Element): MathProbeResult | null {
  return probeAnnotationFamilyMath(root);
}

function probeDeepSeekMath(root: Element): MathProbeResult | null {
  return probeAnnotationFamilyMath(root);
}

function probeDoubaoMath(root: Element): MathProbeResult | null {
  const copyText = readAttrFromSelfOrDescendant(
    root,
    "[data-custom-copy-text]",
    "data-custom-copy-text",
  );
  if (copyText) {
    return fromRaw(copyText, root, "data-custom-copy-text", "doubao");
  }

  return null;
}

export function probeMathTex(element: Element, platform: Platform): MathProbeResult | null {
  if (platform === "ChatGPT") {
    return probeChatGptMath(element);
  }
  if (platform === "Claude") {
    return probeClaudeMath(element);
  }
  if (platform === "Gemini") {
    return probeGeminiMath(element);
  }
  if (platform === "Qwen") {
    return probeQwenMath(element);
  }
  if (platform === "DeepSeek") {
    return probeDeepSeekMath(element);
  }
  if (platform === "Doubao") {
    return probeDoubaoMath(element);
  }
  return null;
}
