import { useEffect, useMemo, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxTree } from "@codemirror/language";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, type Extension, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  WidgetType,
  keymap,
  placeholder,
  ViewPlugin,
  type DecorationSet,
} from "@codemirror/view";
import katex from "katex";

type MarkdownNoteEditorProps = {
  value: string;
  onChange: (value: string) => void;
  onSaveRequest?: () => void | Promise<void>;
  placeholderText?: string;
  minHeight?: number;
  className?: string;
  ariaLabel?: string;
};

type TextRange = {
  from: number;
  to: number;
};

type MathRange = TextRange & {
  tex: string;
  display: boolean;
};

class LinkWidget extends WidgetType {
  constructor(
    private readonly label: string,
    private readonly href: string,
  ) {
    super();
  }

  eq(other: LinkWidget) {
    return other.label === this.label && other.href === this.href;
  }

  toDOM() {
    const element = document.createElement("span");
    element.className = "cm-note-link-widget";
    element.textContent = this.label || this.href;
    element.setAttribute("title", this.href);
    return element;
  }

  ignoreEvent() {
    return false;
  }
}

class TaskMarkerWidget extends WidgetType {
  constructor(private readonly checked: boolean) {
    super();
  }

  eq(other: TaskMarkerWidget) {
    return other.checked === this.checked;
  }

  toDOM() {
    const element = document.createElement("span");
    element.className = "cm-note-task-widget";
    element.textContent = this.checked ? "☑ " : "☐ ";
    return element;
  }

  ignoreEvent() {
    return false;
  }
}

class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly display: boolean,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return (
      other.tex === this.tex &&
      other.display === this.display
    );
  }

  toDOM() {
    const wrapper = document.createElement(this.display ? "div" : "span");
    wrapper.className = this.display
      ? "cm-note-math-block"
      : "cm-note-math-inline";

    try {
      wrapper.innerHTML = katex.renderToString(this.tex, {
        throwOnError: false,
        displayMode: this.display,
      });
    } catch {
      wrapper.textContent = this.tex;
    }

    return wrapper;
  }

  ignoreEvent() {
    return false;
  }
}

function selectionTouchesRange(view: EditorView, from: number, to: number): boolean {
  const selection = view.state.selection.main;
  return selection.from <= to && selection.to >= from;
}

function lineTouchesSelection(view: EditorView, from: number, to: number): boolean {
  const selection = view.state.selection.main;
  const startLine = view.state.doc.lineAt(selection.from);
  const endLine = view.state.doc.lineAt(selection.to);
  return from <= endLine.to && to >= startLine.from;
}

function normalizeHeadingLevel(nodeName: string): string | null {
  if (nodeName.startsWith("ATXHeading")) {
    return nodeName.replace("ATXHeading", "") || "1";
  }

  if (nodeName === "SetextHeading1") return "1";
  if (nodeName === "SetextHeading2") return "2";
  return null;
}

function getFrontmatterRange(doc: string): TextRange | null {
  const match = doc.match(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/);
  if (!match) {
    return null;
  }

  return {
    from: 0,
    to: match[0].length,
  };
}

function rangeIsWithin(rawRanges: TextRange[], from: number, to: number): boolean {
  return rawRanges.some((range) => from >= range.from && to <= range.to);
}

function rangeIntersects(rawRanges: TextRange[], from: number, to: number): boolean {
  return rawRanges.some((range) => from < range.to && to > range.from);
}

function parseMarkdownLink(source: string): { label: string; href: string } | null {
  const match = source.match(/^\[([^\]]+)\]\(([^)]+)\)$/s);
  if (!match) return null;

  const label = match[1]?.trim() ?? "";
  const href = match[2]?.trim() ?? "";
  if (!href) return null;

  return {
    label: label || href,
    href,
  };
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  let cursor = index - 1;

  while (cursor >= 0 && text[cursor] === "\\") {
    slashCount += 1;
    cursor -= 1;
  }

  return slashCount % 2 === 1;
}

function findBlockMathRanges(view: EditorView, rawRanges: TextRange[]): MathRange[] {
  const ranges: MathRange[] = [];
  let lineNumber = 1;

  while (lineNumber <= view.state.doc.lines) {
    const line = view.state.doc.line(lineNumber);
    if (rangeIntersects(rawRanges, line.from, line.to)) {
      lineNumber += 1;
      continue;
    }

    if (!/^\s*\$\$\s*$/.test(line.text)) {
      lineNumber += 1;
      continue;
    }

    let closingLineNumber = lineNumber + 1;
    while (closingLineNumber <= view.state.doc.lines) {
      const candidate = view.state.doc.line(closingLineNumber);
      if (rangeIntersects(rawRanges, candidate.from, candidate.to)) {
        break;
      }

      if (/^\s*\$\$\s*$/.test(candidate.text)) {
        const texLines: string[] = [];
        for (let inner = lineNumber + 1; inner < closingLineNumber; inner += 1) {
          texLines.push(view.state.doc.line(inner).text);
        }

        const tex = texLines.join("\n").trim();
        if (tex) {
          ranges.push({
            from: line.from,
            to: candidate.to,
            tex,
            display: true,
          });
        }

        lineNumber = closingLineNumber + 1;
        break;
      }

      closingLineNumber += 1;
    }

    if (closingLineNumber > view.state.doc.lines) {
      lineNumber += 1;
    }
  }

  return ranges;
}

function findInlineMathRanges(
  view: EditorView,
  rawRanges: TextRange[],
  blockMathRanges: MathRange[],
): MathRange[] {
  const ranges: MathRange[] = [];
  const blockedRanges = [...rawRanges, ...blockMathRanges];

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    if (rangeIntersects(blockedRanges, line.from, line.to)) {
      continue;
    }

    const text = line.text;
    let cursor = 0;
    while (cursor < text.length) {
      const openIndex = text.indexOf("$", cursor);
      if (openIndex < 0) break;

      if (text[openIndex + 1] === "$" || isEscaped(text, openIndex)) {
        cursor = openIndex + 1;
        continue;
      }

      let closeIndex = openIndex + 1;
      while (closeIndex < text.length) {
        const next = text.indexOf("$", closeIndex);
        if (next < 0) {
          closeIndex = -1;
          break;
        }

        if (text[next + 1] === "$" || isEscaped(text, next)) {
          closeIndex = next + 1;
          continue;
        }

        closeIndex = next;
        break;
      }

      if (closeIndex < 0) {
        break;
      }

      const tex = text.slice(openIndex + 1, closeIndex).trim();
      if (tex) {
        ranges.push({
          from: line.from + openIndex,
          to: line.from + closeIndex + 1,
          tex,
          display: false,
        });
      }

      cursor = closeIndex + 1;
    }
  }

  return ranges;
}

function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc.toString();
  const tree = syntaxTree(view.state);
  const frontmatterRange = getFrontmatterRange(doc);
  const rawRanges: TextRange[] = [];
  const lineClassNames = new Map<number, Set<string>>();

  const addLineClass = (position: number, className: string) => {
    const existing = lineClassNames.get(position) ?? new Set<string>();
    existing.add(className);
    lineClassNames.set(position, existing);
  };

  if (frontmatterRange) {
    rawRanges.push(frontmatterRange);
    let cursor = frontmatterRange.from;
    while (cursor <= frontmatterRange.to) {
      const line = view.state.doc.lineAt(cursor);
      addLineClass(line.from, "cm-note-frontmatter-line");
      cursor = line.to + 1;
    }
  }

  tree.iterate({
    enter(node) {
      if (node.name !== "FencedCode") {
        return;
      }

      rawRanges.push({ from: node.from, to: node.to });
      let cursor = node.from;
      while (cursor <= node.to) {
        const line = view.state.doc.lineAt(cursor);
        addLineClass(line.from, "cm-note-code-line");
        if (line.from === node.from) {
          addLineClass(line.from, "cm-note-code-line-start");
        }
        if (line.to === node.to) {
          addLineClass(line.from, "cm-note-code-line-end");
        }
        cursor = line.to + 1;
      }
      return false;
    },
  });

  const blockMathRanges = findBlockMathRanges(view, rawRanges);
  const inlineMathRanges = findInlineMathRanges(view, rawRanges, blockMathRanges);

  tree.iterate({
    enter(node) {
      if (rangeIsWithin(rawRanges, node.from, node.to)) {
        return false;
      }

      const isNodeActive = selectionTouchesRange(view, node.from, node.to);
      const isLineActive = lineTouchesSelection(view, node.from, node.to);
      const headingLevel = normalizeHeadingLevel(node.name);

      if (headingLevel) {
        const line = view.state.doc.lineAt(node.from);
        addLineClass(line.from, "cm-note-heading");
        addLineClass(line.from, `cm-note-heading-${headingLevel}`);
      }

      if (node.name === "HeaderMark" && !isLineActive) {
        builder.add(node.from, node.to, Decoration.replace({}));
      }

      if (node.name === "StrongEmphasis") {
        builder.add(node.from, node.to, Decoration.mark({ class: "cm-note-strong" }));
      }

      if (node.name === "Emphasis") {
        builder.add(node.from, node.to, Decoration.mark({ class: "cm-note-emphasis" }));
      }

      if (node.name === "EmphasisMark" && !isNodeActive) {
        builder.add(node.from, node.to, Decoration.replace({}));
      }

      if (node.name === "InlineCode") {
        builder.add(
          node.from,
          node.to,
          Decoration.mark({ class: "cm-note-inline-code" }),
        );
      }

      if (node.name === "CodeMark" && !isNodeActive) {
        builder.add(node.from, node.to, Decoration.replace({}));
      }

      if (node.name === "Link") {
        if (isNodeActive) {
          return;
        }

        const parsed = parseMarkdownLink(doc.slice(node.from, node.to));
        if (!parsed) {
          return;
        }

        builder.add(
          node.from,
          node.to,
          Decoration.replace({
            widget: new LinkWidget(parsed.label, parsed.href),
          }),
        );
        return false;
      }

      if (node.name === "CodeInfo") {
        builder.add(
          node.from,
          node.to,
          Decoration.mark({ class: "cm-note-code-info" }),
        );
      }
    },
  });

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    if (rangeIntersects(rawRanges, line.from, line.to)) {
      continue;
    }

    const taskMatch = line.text.match(/^(\s*)([-*+]\s+)(\[[ xX]\])\s+/);
    if (!taskMatch || lineTouchesSelection(view, line.from, line.to)) {
      continue;
    }

    const indentLength = taskMatch[1]?.length ?? 0;
    const markerLength = (taskMatch[2]?.length ?? 0) + (taskMatch[3]?.length ?? 0) + 1;
    const checked = /\[[xX]\]/.test(taskMatch[3] ?? "");

    builder.add(
      line.from + indentLength,
      line.from + indentLength + markerLength,
      Decoration.replace({
        widget: new TaskMarkerWidget(checked),
      }),
    );
  }

  for (const range of blockMathRanges) {
    if (selectionTouchesRange(view, range.from, range.to)) {
      continue;
    }

    builder.add(
      range.from,
      range.to,
      Decoration.replace({
        widget: new MathWidget(range.tex, true),
        block: true,
      }),
    );
  }

  for (const range of inlineMathRanges) {
    if (selectionTouchesRange(view, range.from, range.to)) {
      continue;
    }

    builder.add(
      range.from,
      range.to,
      Decoration.replace({
        widget: new MathWidget(range.tex, false),
      }),
    );
  }

  for (const [lineFrom, classNames] of lineClassNames.entries()) {
    builder.add(
      lineFrom,
      lineFrom,
      Decoration.line({
        attributes: { class: [...classNames].join(" ") },
      }),
    );
  }

  return builder.finish();
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildLivePreviewDecorations(view);
    }

    update(update: {
      docChanged: boolean;
      selectionSet: boolean;
      viewportChanged: boolean;
      view: EditorView;
    }) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildLivePreviewDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

function buildEditorTheme(minHeight: number): Extension {
  return EditorView.theme({
    "&": {
      width: "100%",
      backgroundColor: "transparent",
      color: "hsl(var(--text-primary))",
      fontSize: "15px",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      maxWidth: "100%",
      fontFamily: "var(--font-ui)",
      lineHeight: "1.85",
    },
    ".cm-content": {
      minHeight: `${minHeight}px`,
      maxWidth: "100%",
      padding: "1.25rem 1.35rem 1.5rem",
      caretColor: "hsl(var(--text-primary))",
    },
    ".cm-line": {
      padding: "0",
      whiteSpace: "pre-wrap",
      overflowWrap: "anywhere",
      wordBreak: "break-word",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "hsl(var(--text-primary))",
    },
    ".cm-selectionBackground": {
      backgroundColor: "hsl(var(--accent-primary-light)) !important",
    },
    ".cm-placeholder": {
      color: "hsl(var(--text-tertiary))",
    },
    ".cm-note-heading": {
      color: "hsl(var(--text-primary))",
      fontFamily: "var(--font-serif)",
      fontWeight: "500",
      letterSpacing: "-0.01em",
    },
    ".cm-note-heading-1": {
      fontSize: "1.75rem",
      lineHeight: "2.35rem",
    },
    ".cm-note-heading-2": {
      fontSize: "1.45rem",
      lineHeight: "2rem",
    },
    ".cm-note-heading-3, .cm-note-heading-4, .cm-note-heading-5, .cm-note-heading-6": {
      fontSize: "1.1rem",
      lineHeight: "1.8rem",
    },
    ".cm-note-strong": {
      fontWeight: "700",
      color: "hsl(var(--text-primary))",
    },
    ".cm-note-emphasis": {
      fontStyle: "italic",
      color: "hsl(var(--text-primary))",
    },
    ".cm-note-inline-code": {
      borderRadius: "0.45rem",
      backgroundColor: "hsl(var(--bg-surface-card))",
      color: "hsl(var(--text-primary))",
      fontFamily: "var(--font-mono)",
      padding: "0 0.2rem",
    },
    ".cm-note-link-widget": {
      color: "hsl(var(--accent-primary))",
      textDecoration: "underline",
      textDecorationColor: "hsl(var(--accent-primary-muted))",
      textUnderlineOffset: "0.16em",
      cursor: "text",
    },
    ".cm-note-task-widget": {
      color: "hsl(var(--accent-primary))",
      fontFamily: "var(--font-ui)",
    },
    ".cm-note-frontmatter-line": {
      color: "hsl(var(--text-secondary))",
      backgroundColor: "hsl(var(--bg-surface-card) / 0.6)",
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
    },
    ".cm-note-code-line": {
      backgroundColor: "rgba(16, 19, 26, 0.96)",
      color: "#F8FAFC",
      fontFamily: "var(--font-mono)",
      fontSize: "13px",
      lineHeight: "1.8",
      paddingLeft: "0.95rem",
      paddingRight: "0.95rem",
    },
    ".cm-note-code-line-start": {
      borderTopLeftRadius: "0.9rem",
      borderTopRightRadius: "0.9rem",
      paddingTop: "0.75rem",
    },
    ".cm-note-code-line-end": {
      borderBottomLeftRadius: "0.9rem",
      borderBottomRightRadius: "0.9rem",
      paddingBottom: "0.75rem",
      marginBottom: "0.35rem",
    },
    ".cm-note-code-info": {
      color: "#CBD5E1",
      fontSize: "12px",
      fontWeight: "600",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    },
    ".cm-note-math-inline": {
      display: "inline-flex",
      alignItems: "center",
      borderRadius: "0.45rem",
      backgroundColor: "hsl(var(--bg-surface-card) / 0.9)",
      padding: "0.08rem 0.35rem",
      color: "hsl(var(--text-primary))",
      maxWidth: "100%",
      overflowX: "auto",
      verticalAlign: "middle",
    },
    ".cm-note-math-block": {
      margin: "0.45rem 0",
      borderRadius: "0.95rem",
      border: "1px solid hsl(var(--border-subtle))",
      backgroundColor: "hsl(var(--bg-surface-card) / 0.82)",
      padding: "0.95rem 1rem",
      color: "hsl(var(--text-primary))",
      overflowX: "auto",
    },
  });
}

export function MarkdownNoteEditor({
  value,
  onChange,
  onSaveRequest,
  placeholderText = "Start writing...",
  minHeight = 240,
  className,
  ariaLabel = "Markdown note editor",
}: MarkdownNoteEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRequestRef = useRef(onSaveRequest);
  const isSyncingRef = useRef(false);
  const themeExtension = useMemo(() => buildEditorTheme(minHeight), [minHeight]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRequestRef.current = onSaveRequest;
  }, [onSaveRequest]);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        history(),
        markdown(),
        EditorView.lineWrapping,
        themeExtension,
        placeholder(placeholderText),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              void onSaveRequestRef.current?.();
              return true;
            },
          },
          indentWithTab,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged || isSyncingRef.current) {
            return;
          }

          onChangeRef.current(update.state.doc.toString());
        }),
        livePreviewPlugin,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    view.dom.setAttribute("aria-label", ariaLabel);
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel, placeholderText, themeExtension]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    isSyncingRef.current = true;
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
    isSyncingRef.current = false;
  }, [value]);

  return <div ref={containerRef} className={className} />;
}
