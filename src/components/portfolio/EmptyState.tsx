type EmptyStateProps = {
  message: string;
  title?: string;
};

export function EmptyState({ message, title = "Content coming soon" }: EmptyStateProps) {
  return (
    <div className="empty-state" role="status">
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}