/**
 * Bud's conversation content while the AI backend is still being built.
 *
 * Honest by design: the goal answer is plain arithmetic on the user's own goal
 * settings, learning topics are general education, and anything else says
 * plainly that open questions aren't supported yet. Nothing here claims to
 * have analyzed spending it hasn't seen.
 */

import type { IconName } from "@/components/Icon";
import type { Goal } from "@/mock/goals";
import { formatCurrency } from "@/utils/security";

export type StarterId = "goal" | "budget" | "emergency" | "debt";

export interface Starter {
  id: StarterId;
  icon: IconName;
  eyebrow: string;
  title: string;
  prompt: string;
}

export interface BudAction {
  label: string;
  route: "/(tabs)/budget" | "/(tabs)/goals";
}

export interface BudReply {
  text: string;
  /** Where the answer comes from, shown under the reply. */
  source?: string;
  action?: BudAction;
  /** Show the starters again so the user has somewhere to go. */
  offerStarters?: boolean;
}

const EDUCATION = "General education, not financial advice.";

export function startersFor(goal: Goal | null): Starter[] {
  const starters: Starter[] = [];
  if (goal && goal.targetAmount > 0) {
    starters.push({
      id: "goal",
      icon: "target",
      eyebrow: "Your goal",
      title: `Pace for ${goal.name}`,
      prompt: `How long until ${goal.name} is done?`,
    });
  }
  starters.push(
    {
      id: "budget",
      icon: "wallet",
      eyebrow: "Your budget",
      title: "Check this month calmly",
      prompt: "How should I check my budget this month?",
    },
    {
      id: "emergency",
      icon: "shield",
      eyebrow: "Learn",
      title: "Emergency fund basics",
      prompt: "How big should an emergency fund be?",
    },
    {
      id: "debt",
      icon: "layers",
      eyebrow: "Learn",
      title: "Snowball or avalanche?",
      prompt: "Should I pay debt with the snowball or avalanche method?",
    }
  );
  return starters;
}

/** Match free text to a topic Bud can answer today. */
export function topicFor(text: string, hasGoal: boolean): StarterId | null {
  const value = text.toLowerCase();
  if (/emergency|rainy day|safety net/.test(value)) return "emergency";
  if (/debt|snowball|avalanche|credit card|loan/.test(value)) return "debt";
  if (hasGoal && /goal|saving for|save for|how long/.test(value)) return "goal";
  if (/budget|spend|spent|categor/.test(value)) return "budget";
  return null;
}

export function goalPaceReply(goal: Goal, now = new Date()): BudReply {
  const action: BudAction = { label: "Open Goals", route: "/(tabs)/goals" };
  const source = "Calculated from your goal settings.";
  const remaining = Math.max(0, goal.targetAmount - goal.alreadySaved);

  if (remaining === 0) {
    return {
      text: `${goal.name} is fully funded: ${formatCurrency(goal.alreadySaved)} of ${formatCurrency(goal.targetAmount)}. That's a finished goal.`,
      source,
      action,
    };
  }
  if (goal.monthlyCommit <= 0) {
    return {
      text: `${goal.name} has ${formatCurrency(remaining)} to go. Add a monthly amount in Goals and I can show how long it takes.`,
      source,
      action,
    };
  }

  const months = Math.ceil(remaining / goal.monthlyCommit);
  const finish = new Date(now.getFullYear(), now.getMonth() + months, 1);
  const finishLabel = finish.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  let text = `${goal.name} has ${formatCurrency(remaining)} to go. At your planned ${formatCurrency(goal.monthlyCommit)} a month, that's about ${months} ${months === 1 ? "month" : "months"}, around ${finishLabel}.`;

  // Show what a modest bump would change, only when it actually helps.
  const step = Math.max(25, Math.round((goal.monthlyCommit * 0.1) / 5) * 5);
  const faster = Math.ceil(remaining / (goal.monthlyCommit + step));
  if (faster < months) {
    text += ` Adding ${formatCurrency(step)} a month would bring it to about ${faster} ${faster === 1 ? "month" : "months"}.`;
  }
  return { text, source, action };
}

export function replyTo(text: string, goal: Goal | null, starterId?: StarterId): BudReply {
  const topic = starterId ?? topicFor(text, Boolean(goal));

  switch (topic) {
    case "goal":
      if (goal) return goalPaceReply(goal);
      break;
    case "budget":
      return {
        text: "Your Budget tab shows this month's posted bank spending by category against each limit. A calm way to check it: find the one category closest to its limit, then pick a single small change for the week instead of fixing everything at once.",
        source: "General guide to your Budget tab.",
        action: { label: "Open Budget", route: "/(tabs)/budget" },
      };
    case "emergency":
      return {
        text: "A common starting point is one month of essential costs, like rent, utilities, groceries, and minimum payments, then building toward three to six months. Keep it separate from everyday spending and easy to reach. Small automatic transfers after payday are usually easier to keep up than big one-off deposits.",
        source: EDUCATION,
      };
    case "debt":
      return {
        text: "Both methods pay every minimum first, then put any extra toward one debt. The avalanche targets the highest interest rate first, which usually costs less overall. The snowball targets the smallest balance first, which gives quicker wins. The better one is the method you'll actually keep doing.",
        source: EDUCATION,
      };
  }

  return {
    text: "I can't answer open questions yet. Bud's full conversations are still being built. These are ready today:",
    offerStarters: true,
  };
}
