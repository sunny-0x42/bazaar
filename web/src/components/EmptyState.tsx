import type { ReactNode } from "react";

type Props = {
  title: string;
  body: string;
  children?: ReactNode;
};

export function EmptyState({ title, body, children }: Props) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{body}</p>
      {children ? <div className="empty-actions">{children}</div> : null}
    </div>
  );
}
