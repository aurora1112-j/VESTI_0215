import type { AstNode, AstRoot, AstTableAlign, AstTableNode } from "../types/ast";
import { astNodeToPlainText } from "./astText";

function fenceCode(code: string, language?: string | null): string {
  const normalized = code.replace(/\r\n?/g, "\n").trimEnd();
  const lang = language?.trim() ?? "";
  return `\`\`\`${lang}\n${normalized}\n\`\`\``;
}

function serializeInline(node: AstNode): string {
  switch (node.type) {
    case "text":
      return node.text;
    case "fragment":
      return node.children.map(serializeInline).join("");
    case "strong":
      return `**${node.children.map(serializeInline).join("")}**`;
    case "em":
      return `*${node.children.map(serializeInline).join("")}*`;
    case "code_inline":
      return `\`${node.text}\``;
    case "math":
      return node.display ? `$$${node.tex}$$` : `$${node.tex}$`;
    case "br":
      return "\n";
    case "attachment":
      return `[Attachment: ${node.name}]`;
    case "p":
    case "h1":
    case "h2":
    case "h3":
    case "li":
    case "blockquote":
    case "ul":
    case "ol":
    case "table":
    case "code_block":
      return astNodeToPlainText(node);
    default:
      return "";
  }
}

function serializeTableAlign(value: AstTableAlign | undefined): string {
  if (value === "left") return ":---";
  if (value === "center") return ":---:";
  if (value === "right") return "---:";
  return "---";
}

function serializeTable(node: AstTableNode): string {
  if (node.kind === "v2") {
    const headers =
      node.columns.length > 0
        ? node.columns.map((column) => column.header.map(serializeInline).join("").trim())
        : ["Column 1"];
    const alignRow =
      node.columns.length > 0
        ? node.columns.map((column) => serializeTableAlign(column.align))
        : ["---"];
    const rows = node.rows.map((row) =>
      row.cells.map((cell) => cell.children.map(serializeInline).join("").trim()),
    );

    return [
      `| ${headers.join(" | ")} |`,
      `| ${alignRow.join(" | ")} |`,
      ...rows.map((row) => `| ${row.join(" | ")} |`),
    ].join("\n");
  }

  const headers = node.headers.length > 0 ? node.headers : ["Column 1"];
  const alignRow = Array.from({ length: headers.length }, () => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${alignRow.join(" | ")} |`,
    ...node.rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function serializeBlock(node: AstNode, depth = 0): string {
  switch (node.type) {
    case "text":
    case "fragment":
    case "strong":
    case "em":
    case "code_inline":
    case "attachment":
      return serializeInline(node);
    case "math":
      return node.display ? `$$\n${node.tex}\n$$` : `$${node.tex}$`;
    case "br":
      return "  \n";
    case "p":
      return node.children.map(serializeInline).join("").trim();
    case "h1":
      return `# ${node.children.map(serializeInline).join("").trim()}`;
    case "h2":
      return `## ${node.children.map(serializeInline).join("").trim()}`;
    case "h3":
      return `### ${node.children.map(serializeInline).join("").trim()}`;
    case "blockquote": {
      const body = node.children.map((child) => serializeBlock(child, depth)).join("\n\n");
      return body
        .split("\n")
        .map((line) => (line.trim() ? `> ${line}` : ">"))
        .join("\n");
    }
    case "code_block":
      return fenceCode(node.code, node.language);
    case "table":
      return serializeTable(node);
    case "ul":
      return node.children
        .map((child) => serializeListItem(child, depth, false))
        .filter(Boolean)
        .join("\n");
    case "ol":
      return node.children
        .map((child, index) => serializeListItem(child, depth, true, index + 1))
        .filter(Boolean)
        .join("\n");
    case "li":
      return serializeListItem(node, depth, false);
    default:
      return "";
  }
}

function serializeListItem(
  node: AstNode,
  depth: number,
  ordered: boolean,
  index = 1,
): string {
  if (node.type !== "li") {
    return serializeBlock(node, depth);
  }

  const indent = "  ".repeat(depth);
  const marker = ordered ? `${index}. ` : "- ";
  const inlineChildren = node.children.filter((child) => child.type !== "ul" && child.type !== "ol");
  const nestedChildren = node.children.filter((child) => child.type === "ul" || child.type === "ol");
  const inlineText = inlineChildren.map(serializeInline).join("").trim();
  const lines = [`${indent}${marker}${inlineText || " "}`];

  for (const child of nestedChildren) {
    lines.push(serializeBlock(child, depth + 1));
  }

  return lines.join("\n");
}

export function serializeAstRootToMarkdown(root: AstRoot): string {
  return root.children
    .map((child) => serializeBlock(child))
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
