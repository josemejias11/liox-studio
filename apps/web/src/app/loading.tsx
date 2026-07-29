export default function GlobalLoading() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-muted-foreground flex flex-col items-center gap-4">
        <p className="animate-pulse text-sm font-medium tracking-wide">Loading experience...</p>
      </div>
    </div>
  );
}
