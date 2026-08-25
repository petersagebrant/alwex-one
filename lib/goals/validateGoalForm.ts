import { isGoalKind, parseGoalKind } from "@/lib/goals/kind";
import { isGoalLifecycle, parseGoalLifecycle } from "@/lib/goals/lifecycle";
import type { GoalKind, GoalLifecycle } from "@/types/goal";
import type { StatusTone } from "@/types/status";

export type GoalFormValues = {
  businessAreaId: string;
  title: string;
  description: string;
  ownerId: string;
  goalKind: string;
  lifecycle: string;
  deadline: string;
  targetValue: string;
  currentValue: string;
  statusValue: string;
};

export type ParsedGoalForm = {
  businessAreaId: string;
  title: string;
  description: string;
  ownerId: string;
  goalKind: GoalKind;
  lifecycle: GoalLifecycle;
  deadline: string | undefined;
  targetValue: string | undefined;
  currentValue: string | undefined;
  status: StatusTone;
};

export type ParseGoalFormResult =
  | { ok: true; value: ParsedGoalForm }
  | { ok: false; error: string };

function isStatusTone(value: string): value is StatusTone {
  return value === "Grön" || value === "Gul" || value === "Röd";
}

function trim(value: string): string {
  return value.trim();
}

export function parseGoalFormValues(input: GoalFormValues): ParseGoalFormResult {
  const businessAreaId = trim(input.businessAreaId);
  if (!businessAreaId) {
    return { ok: false, error: "Välj ett affärsområde." };
  }

  const title = trim(input.title);
  if (!title) {
    return { ok: false, error: "Titel är obligatorisk." };
  }

  if (!isGoalKind(trim(input.goalKind))) {
    return { ok: false, error: "Ogiltig måltyp." };
  }
  const goalKind = parseGoalKind(trim(input.goalKind));

  const lifecycleRaw = trim(input.lifecycle);
  if (lifecycleRaw && !isGoalLifecycle(lifecycleRaw)) {
    return { ok: false, error: "Ogiltigt tillstånd (Aktivt/Klart)." };
  }
  const lifecycle = parseGoalLifecycle(lifecycleRaw || "ACTIVE");

  if (goalKind === "ACTIVITY") {
    const statusRaw = trim(input.statusValue);
    if (statusRaw && !isStatusTone(statusRaw)) {
      return { ok: false, error: "Ogiltig status." };
    }
    return {
      ok: true,
      value: {
        businessAreaId,
        title,
        description: trim(input.description),
        ownerId: trim(input.ownerId),
        goalKind,
        lifecycle,
        deadline: undefined,
        targetValue: undefined,
        currentValue: undefined,
        status: statusRaw && isStatusTone(statusRaw) ? statusRaw : "Gul",
      },
    };
  }

  return {
    ok: true,
    value: {
      businessAreaId,
      title,
      description: trim(input.description),
      ownerId: trim(input.ownerId),
      goalKind,
      lifecycle,
      deadline: trim(input.deadline) || undefined,
      targetValue: trim(input.targetValue) || undefined,
      currentValue: trim(input.currentValue) || undefined,
      status: "Gul",
    },
  };
}
