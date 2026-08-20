"use client";

import { useParams } from "next/navigation";
import { StudySession } from "@/components/study-session";

export default function LearnPage() {
  const { id } = useParams<{ id: string }>();
  return <StudySession deckId={Number(id)} type="LEARN" />;
}
