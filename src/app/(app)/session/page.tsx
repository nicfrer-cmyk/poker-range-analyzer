import { redirect } from "next/navigation";

/** The old Session Review page has been folded into /leaks (the new Leak Tracker), which is
 *  no longer Pro-gated — see src/lib/plan.ts and the "personal coach" redesign. */
export default function SessionReviewRedirect() {
  redirect("/leaks");
}
