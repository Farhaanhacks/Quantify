import { notFound } from "next/navigation";
import { currentUser } from "@/lib/serverSession";
import { isAdminEmail } from "@/lib/access";
import AdminOps from "@/components/quantifi/AdminOps";

// The team's view of the site.
//
// Same deployment, same code, different surface: what the team may see is
// decided by the signed-in email against ADMIN_EMAILS, checked HERE on the
// server. The middleware gate in front of it only knows whether a session
// cookie exists; this is the check that actually decides.
//
// notFound(), not a "you are not authorised" page. Anyone who is not staff gets
// the ordinary 404, which tells them nothing about what lives at this path.

export const dynamic = "force-dynamic";

// Never let this into an index or a link preview, whatever the allowlist says.
export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  const user = currentUser();
  if (!user?.email || !isAdminEmail(user.email)) notFound();

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.2em] text-gold/90">Staff</div>
          <h1 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
            Operations
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            The state of this deployment&apos;s machinery — what a reader never sees.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          Signed in as <span className="text-slate-300">{user.email}</span>
        </div>
      </div>
      <AdminOps />
    </section>
  );
}
