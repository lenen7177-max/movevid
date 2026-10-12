export function LegalProse({ content }: { content: string }) {
  const paragraphs = content.split(/\n\n+/).flatMap((block) => {
    const text = block.trim();
    return text ? [text] : [];
  });

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-muted-foreground leading-7 whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
