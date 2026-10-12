import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { HTMLAttributes } from "react";
import { CopyHeader } from "./copy-header";

function createHeading(level: 1 | 2 | 3 | 4 | 5 | 6) {
  const Heading = ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => {
    return (
      <CopyHeader level={level} {...props}>
        {children}
      </CopyHeader>
    );
  };

  Heading.displayName = `BlogHeading${level}`;
  return Heading;
}

export function getBlogMdxComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    h1: createHeading(1),
    h2: createHeading(2),
    h3: createHeading(3),
    h4: createHeading(4),
    h5: createHeading(5),
    h6: createHeading(6),
    ...components,
  };
}
