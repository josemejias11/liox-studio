import { ReviewPlayer } from '@/review/ReviewPlayer';
import { loadReviewPlayer } from '@/review/server/review-loaders';

export default async function CourseReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const review = await loadReviewPlayer(token);

  if (!review) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6 text-foreground">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-semibold">Review unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">This review link is invalid, expired, or points to content that can no longer be rendered. Ask the course team for a new link.</p>
        </div>
      </main>
    );
  }

  return <ReviewPlayer {...review} token={token} />;
}
