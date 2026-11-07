import { Check, Circle, CircleDot, LockKeyhole } from "lucide-react";
import type { QuestionStatus } from "@/lib/capstone/types";

export function StatusIcon({ status, size = 14 }: { status: QuestionStatus; size?: number }) {
  const Icon = status === "completed" ? Check : status === "current" ? CircleDot : status === "locked" ? LockKeyhole : Circle;
  return <Icon size={size} aria-hidden="true" strokeWidth={status === "completed" ? 2.5 : 1.7} />;
}
