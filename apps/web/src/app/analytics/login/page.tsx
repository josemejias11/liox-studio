import { Bot } from 'lucide-react';

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AnalyticsLoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === '1';

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="bg-primary text-primary-foreground flex h-12 w-12 items-center justify-center rounded-2xl">
            <Bot className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="text-center">
            <h1 className="text-foreground text-xl font-semibold">moto tutor</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Instructor Dashboard</p>
          </div>
        </div>
        <div className="bg-card border-border rounded-2xl border px-6 py-7 shadow-sm">
          <h2 className="text-foreground mb-5 text-base font-semibold">Sign in to continue</h2>

          {hasError && (
            <div
              className="border-destructive/30 bg-destructive/10 text-destructive mb-4 rounded-lg border px-4 py-3 text-sm"
              role="alert"
            >
              Incorrect password. Please try again.
            </div>
          )}

          <form method="POST" action="/api/analytics/login" className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="password"
                className="text-foreground/70 text-xs font-medium tracking-wide uppercase"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                autoFocus
                className="border-input bg-input/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring rounded-lg border px-3.5 py-2.5 text-sm outline-none focus-visible:ring-2"
                placeholder="Enter dashboard password"
              />
            </div>

            <button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 mt-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-150"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="text-muted-foreground mt-6 text-center text-xs">
          Access restricted to Motorola instructors.
        </p>
      </div>
    </div>
  );
}
