import { BookOpen } from 'lucide-react';

interface CourseStudioLoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function CourseStudioLoginPage({ searchParams }: CourseStudioLoginPageProps) {
  const { error } = await searchParams;

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-4">
      <section className="w-full max-w-sm">
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-2xl">
            <BookOpen className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Course Studio</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Authoring workspace</p>
          </div>
        </header>

        <div className="bg-card border-border rounded-2xl border px-6 py-7 shadow-sm">
          <h2 className="mb-5 text-base font-semibold">Sign in to continue</h2>
          {error === '1' && (
            <p className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm" role="alert">
              Incorrect password. Please try again.
            </p>
          )}
          <form method="POST" action="/api/course-studio/login" className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-xs font-medium tracking-wide uppercase">
              Password
              <input
                autoComplete="current-password"
                autoFocus
                className="border-input bg-input/30 text-foreground focus-visible:ring-ring rounded-lg border px-3.5 py-2.5 text-sm normal-case tracking-normal outline-none focus-visible:ring-2"
                id="password"
                name="password"
                required
                type="password"
              />
            </label>
            <button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors" type="submit">
              Sign in
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
