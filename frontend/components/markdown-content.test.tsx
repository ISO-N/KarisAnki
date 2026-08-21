// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  it("renders markdown structure safely", () => {
    render(<MarkdownContent content={"# Title\n\nThis is **bold** text."} />);

    expect(screen.getByRole("heading", { level: 1, name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("This is", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("bold")).toBeInTheDocument();
  });

  it("renders KaTeX math", () => {
    const { container } = render(<MarkdownContent content={"Inline $E=mc^2$ and $$\\frac{1}{2}$$"} />);

    expect(container.querySelector("math")).not.toBeNull();
  });

  it("allows external image URLs", () => {
    render(<MarkdownContent content={"![card image](https://example.com/card.png)"} />);

    const image = screen.getByRole("img", { name: "card image" });
    expect(image).toHaveAttribute("src", "https://example.com/card.png");
  });

  it("keeps long content intact without executing scripts", () => {
    const longContent = "long ".repeat(1000).trimEnd();
    const { container } = render(<MarkdownContent content={longContent} />);

    expect(container.textContent).toContain(longContent);
    expect(container.querySelector(".markdown-body")).not.toBeNull();
  });

  it("does not execute script tags or inline event handlers", () => {
    (window as unknown as { __xss?: boolean }).__xss = false;
    const { container } = render(
      <MarkdownContent
        content={'<script>window.__xss = true</script><img src="x" onerror="window.__xss = true">'}
      />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect((window as unknown as { __xss?: boolean }).__xss).toBe(false);
  });
});
