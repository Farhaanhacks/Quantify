import { notFound } from "next/navigation";
import PlaybookPage from "@/components/quantifi/PlaybookPage";
import { getPlaybook, playbooks } from "@/data/playbooks";

export function generateStaticParams() {
  return playbooks.map((p) => ({ id: p.id }));
}

export function generateMetadata({ params }: { params: { id: string } }) {
  const p = getPlaybook(params.id);
  if (!p) return { title: "Research · Quantifi" };
  return {
    title: `${p.title} · Quantifi Research`,
    description: p.subtitle,
  };
}

export default function ResearchPage({ params }: { params: { id: string } }) {
  const playbook = getPlaybook(params.id);
  if (!playbook) notFound();
  return <PlaybookPage playbook={playbook} />;
}
