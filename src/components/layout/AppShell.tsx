import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { PostGameNotice } from "./PostGameNotice";
import { AuthSync } from "./AuthSync";
import { NotificationBell } from "./NotificationBell";
import { OnboardingTrigger } from "@/components/onboarding/OnboardingTrigger";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AuthSync />
      <OnboardingTrigger />
      <Sidebar />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-10">
          <div className="mb-3 flex items-center justify-end">
            <NotificationBell />
          </div>
          <PostGameNotice className="mb-4" />
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
