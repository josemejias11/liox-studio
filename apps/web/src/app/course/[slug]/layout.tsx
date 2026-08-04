import type { ReactNode } from 'react';
export default function CourseLayout({ children }: { children: ReactNode }) {
  return <div className="bg-background min-h-dvh">{children}</div>;
}
