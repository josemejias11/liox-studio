import { ReviewPlayer } from '@/review/ReviewPlayer';
import { loadReviewPlayer } from '@/review/server/review-loaders';

export default async function CourseReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = await loadReviewPlayer(token);

  if (!review) {
    return (
      <main className="bg-muted/40 text-foreground flex min-h-screen items-center justify-center p-6">
        <div className="border-border bg-card max-w-md rounded-2xl border p-8 text-center">
          <h1 className="text-2xl font-semibold">Review unavailable</h1>
          <p className="text-muted-foreground mt-3 text-sm">
            This review link is invalid, expired, or points to content that can no longer be
            rendered. Ask the course team for a new link.
          </p>
        </div>
      </main>
    );
  }

  return <ReviewPlayer {...review} token={token} />;
}
