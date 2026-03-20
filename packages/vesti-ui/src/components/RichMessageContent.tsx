import { Fragment, type ReactNode } from "react";
import type { AstNode, AstRoot, AstTableNode, Message } from "../types";

interface RichMessageContentProps {
  message: Message;
}

function hasRenderableAst(root: AstRoot | null | undefined): root is AstRoot {
  return !!root && root.type === "root" && Array.isArray(root.children) && root.children.length > 0;
}

function renderNodes(nodes: AstNode[], keyPrefix: string): ReactNode {
  return nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`));
}

function renderTable(node: AstTableNode, key: string): ReactNode {
  if (node.kind === "v2") {
    const headers =
      node.columns.length > 0
        ? node.columns
        : [{ header: [{ type: "text", text: "Column 1" }], align: null }];

    return (
      <div key={key} className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-primary/70">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-bg-surface-card/70">
            <tr>
              {headers.map((column, index) => (
                <th
                  key={`${key}-head-${index}`}
                  className="border-b border-border-subtle px-3 py-2 font-sans text-[12px] font-semibold text-text-primary"
                  style={column.align ? { textAlign: column.align } : undefined}
                >
                  {renderNodes(column.header, `${key}-head-${index}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {node.rows.map((row, rowIndex) => (
              <tr key={`${key}-row-${rowIndex}`} className="border-b border-border-subtle/60 last:border-b-0">
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`${key}-cell-${rowIndex}-${cellIndex}`}
                    className="align-top px-3 py-2 text-[13px] text-text-secondary"
                    style={cell.align ? { textAlign: cell.align } : undefined}
                  >
                    {renderNodes(cell.children, `${key}-cell-${rowIndex}-${cellIndex}`)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div key={key} className="overflow-x-auto rounded-xl border border-border-subtle bg-bg-primary/70">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-bg-surface-card/70">
          <tr>
            {(node.headers.length > 0 ? node.headers : ["Column 1"]).map((header, index) => (
              <th
                key={`${key}-legacy-head-${index}`}
                className="border-b border-border-subtle px-3 py-2 text-left font-sans text-[12px] font-semibold text-text-primary"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {node.rows.map((row, rowIndex) => (
            <tr key={`${key}-legacy-row-${rowIndex}`} className="border-b border-border-subtle/60 last:border-b-0">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${key}-legacy-cell-${rowIndex}-${cellIndex}`}
                  className="align-top px-3 py-2 text-[13px] text-text-secondary"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderNode(node: AstNode, key: string): ReactNode {
  switch (node.type) {
    case "text":
      return <Fragment key={key}>{node.text}</Fragment>;
    case "fragment":
      return <Fragment key={key}>{renderNodes(node.children, key)}</Fragment>;
    case "p":
      return (
        <p key={key} className="mb-3 whitespace-pre-wrap leading-relaxed last:mb-0">
          {renderNodes(node.children, key)}
        </p>
      );
    case "h1":
      return (
        <h1 key={key} className="mb-3 mt-1 text-xl font-serif font-semibold text-text-primary">
          {renderNodes(node.children, key)}
        </h1>
      );
    case "h2":
      return (
        <h2 key={key} className="mb-3 mt-1 text-lg font-serif font-semibold text-text-primary">
          {renderNodes(node.children, key)}
        </h2>
      );
    case "h3":
      return (
        <h3 key={key} className="mb-2 mt-1 text-base font-serif font-semibold text-text-primary">
          {renderNodes(node.children, key)}
        </h3>
      );
    case "br":
      return <br key={key} />;
    case "strong":
      return (
        <strong key={key} className="font-semibold text-text-primary">
          {renderNodes(node.children, key)}
        </strong>
      );
    case "em":
      return (
        <em key={key} className="italic">
          {renderNodes(node.children, key)}
        </em>
      );
    case "code_inline":
      return (
        <code
          key={key}
          className="rounded bg-bg-surface-card px-1.5 py-0.5 font-mono text-[12px] text-text-primary"
        >
          {node.text}
        </code>
      );
    case "code_block":
      return (
        <pre
          key={key}
          className="mb-3 overflow-x-auto rounded-xl border border-border-subtle bg-[#10131a] p-3 font-mono text-[12px] leading-6 text-slate-100"
        >
          <code>{node.code}</code>
        </pre>
      );
    case "ul":
      return (
        <ul key={key} className="mb-3 list-disc space-y-1 pl-5">
          {renderNodes(node.children, key)}
        </ul>
      );
    case "ol":
      return (
        <ol key={key} className="mb-3 list-decimal space-y-1 pl-5">
          {renderNodes(node.children, key)}
        </ol>
      );
    case "li":
      return <li key={key}>{renderNodes(node.children, key)}</li>;
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="mb-3 border-l-4 border-border-subtle pl-4 italic text-text-secondary"
        >
          {renderNodes(node.children, key)}
        </blockquote>
      );
    case "table":
      return renderTable(node, key);
    case "math":
      if (node.display) {
        return (
          <div
            key={key}
            className="mb-3 overflow-x-auto rounded-xl border border-border-subtle bg-bg-surface-card/70 px-3 py-2 font-mono text-[12px] text-text-primary"
          >
            {`$$ ${node.tex} $$`}
          </div>
        );
      }
      return (
        <code
          key={key}
          className="rounded bg-bg-surface-card px-1.5 py-0.5 font-mono text-[12px] text-text-primary"
        >
          {node.tex}
        </code>
      );
    case "attachment":
      return (
        <span
          key={key}
          className="inline-flex items-center rounded-full border border-border-subtle px-2 py-1 text-[12px] text-text-secondary"
        >
          {node.name}
        </span>
      );
    default:
      return null;
  }
}

function renderArtifactMeta(message: Message): ReactNode {
  if ((message.artifacts ?? []).length === 0) {
    return null;
  }

  return (
    <details className="mt-3 rounded-xl border border-border-subtle bg-bg-primary/60">
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium text-text-primary">
        Artifacts ({message.artifacts?.length ?? 0})
      </summary>
      <div className="space-y-2 border-t border-border-subtle px-3 py-3">
        {(message.artifacts ?? []).map((artifact, index) => (
          <div
            key={`${artifact.kind}-${artifact.label ?? index}`}
            className="rounded-lg border border-border-subtle bg-bg-surface-card/60 px-3 py-2"
          >
            <div className="text-[12px] font-medium text-text-primary">
              {artifact.label || artifact.kind}
            </div>
            <div className="mt-1 text-[11px] text-text-tertiary">
              kind: {artifact.kind}
              {artifact.captureMode ? ` | mode: ${artifact.captureMode}` : ""}
              {artifact.renderDimensions
                ? ` | ${artifact.renderDimensions.width}x${artifact.renderDimensions.height}`
                : ""}
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}

function renderSourceMeta(message: Message): ReactNode {
  if ((message.citations ?? []).length === 0) {
    return null;
  }

  return (
    <details className="mt-3 rounded-xl border border-border-subtle bg-bg-primary/60">
      <summary className="cursor-pointer list-none px-3 py-2 text-[12px] font-medium text-text-primary">
        Sources ({message.citations?.length ?? 0})
      </summary>
      <div className="space-y-2 border-t border-border-subtle px-3 py-3">
        {(message.citations ?? []).map((citation, index) => (
          <a
            key={`${citation.href}-${index}`}
            href={citation.href}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-border-subtle bg-bg-surface-card/60 px-3 py-2 transition-colors hover:bg-bg-surface-card"
          >
            <div className="text-[12px] font-medium text-text-primary">{citation.label}</div>
            <div className="mt-1 text-[11px] text-text-tertiary">{citation.host}</div>
          </a>
        ))}
      </div>
    </details>
  );
}

export function RichMessageContent({ message }: RichMessageContentProps) {
  const body = hasRenderableAst(message.content_ast)
    ? renderNodes(message.content_ast.children, `msg-${message.id}`)
    : message.content_text;

  return (
    <>
      <div className="text-[13px] leading-relaxed text-inherit">{body}</div>
      {renderSourceMeta(message)}
      {renderArtifactMeta(message)}
    </>
  );
}
