import type { AstRoot } from "../../../types/ast";
import {
  extractAstPlainText,
  shouldPreferAstCanonicalText,
} from "../../../utils/astText";

export function resolveCanonicalMessageText(params: {
  fallbackText: string;
  ast: AstRoot | null | undefined;
  normalizeAstText: (value: string) => string;
}): string {
  const { ast, fallbackText, normalizeAstText } = params;
  if (
    !ast ||
    !shouldPreferAstCanonicalText({
      root: ast,
      fallbackText,
    })
  ) {
    return fallbackText;
  }

  const canonicalAstText = normalizeAstText(extractAstPlainText(ast));
  return canonicalAstText.trim().length > 0 ? canonicalAstText : fallbackText;
}
