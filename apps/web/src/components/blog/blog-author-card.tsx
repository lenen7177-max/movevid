interface BlogAuthorCardProps {
  name: string;
  description?: string;
  position?: string;
  avatar?: string;
}

export function BlogAuthorCard({ name, description, position, avatar }: BlogAuthorCardProps) {
  return (
    <div className="flex items-start gap-2">
      {avatar ? (
        <img
          src={avatar}
          alt={name}
          className="h-8 w-8 rounded-full border border-border object-cover"
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold">
          {name.slice(0, 1)}
        </div>
      )}
      <div className="flex-1">
        <h3 className="text-balance text-sm font-semibold tracking-tight">{name}</h3>
        {position ? <p className="text-balance text-xs text-muted-foreground">{position}</p> : null}
        {description ? <p className="sr-only">{description}</p> : null}
      </div>
    </div>
  );
}
