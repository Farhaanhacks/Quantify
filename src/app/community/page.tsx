import { redirect } from "next/navigation";

// Community is paused for now — its research playbooks live under Ideas.
// Keep the route as a redirect so old links don't 404.
export default function CommunityPage() {
  redirect("/ideas");
}
