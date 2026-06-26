// DEPRECATED — the Famous Takes section was removed. This route is kept only
// as a compiling stub so that extracting a project zip over an older checkout
// overwrites the old, broken page rather than leaving it behind. It simply
// redirects to the Community Research page, where this content now lives.
import { redirect } from "next/navigation";

export default function FamousTakesPage() {
  redirect("/community");
}
