"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const katexTags = [
  "math",
  "annotation",
  "semantics",
  "mrow",
  "mstyle",
  "mfrac",
  "msqrt",
  "mroot",
  "msub",
  "msup",
  "msubsup",
  "munder",
  "mover",
  "munderover",
  "mmultiscripts",
  "mprescripts",
  "none",
  "mi",
  "mn",
  "mo",
  "mtext",
  "mspace",
  "ms",
  "mphantom",
  "mpadded",
  "menclose",
  "mtable",
  "mtr",
  "mtd",
  "mlabeledtr",
  "merror",
  "maction",
  "mglyph",
  "mstack",
  "mlongdiv",
  "msgroup",
  "msrow",
  "mscarries",
  "mscarry",
];

const schema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...katexTags],
  attributes: {
    ...defaultSchema.attributes,
    span: [...(defaultSchema.attributes?.span ?? []), "className", "aria-hidden"],
    div: [...(defaultSchema.attributes?.div ?? []), "className"],
    math: ["xmlns", "display"],
    annotation: ["encoding"],
    img: [...(defaultSchema.attributes?.img ?? []), "src", "alt", "title", "width", "height"],
  },
};

export function MarkdownContent({ content }: { content: string }) {
  if (!content?.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeSanitize, schema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
