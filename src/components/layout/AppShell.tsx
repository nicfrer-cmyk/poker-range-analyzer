import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { PostGameNotice } from "./PostGameNotice";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
          <PostGameNotice className="mb-4" />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
