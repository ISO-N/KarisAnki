"use client";

import { useParams } from "next/navigation";
import { StudySession } from "@/components/study-session";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  return <StudySession deckId={Number(id)} type="REVIEW" />;
}
