export function PostGameNotice({ className }: { className?: string }) {
  return (
    <div
      className={
        "flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-base-muted " +
        (className ?? "")
      }
    >
      <span aria-hidden>ℹ️</span>
      <span>המערכת מיועדת לניתוח ולמידה לאחר משחק בלבד — אין כאן סיוע בזמן משחק חי.</span>
    </div>
  );
}
