export interface BudInsight {
  id: string;
  message: string;
  generatedAt: string;
  type: "spending" | "goal" | "streak" | "motivation" | "achievement";
}

export interface BudSession {
  id: string;
  title: string;
  category: string;
  duration: string;
  xpReward: number;
  completed: boolean;
  completedAt?: string;
  whyItMattersNow: string;
}

export interface BudMessage {
  id: string;
  role: "user" | "bud";
  content: string;
  timestamp: string;
}

export const MOCK_BUD_INSIGHT: BudInsight = {
  id: "insight_today",
  message:
    "You spent 18% less on dining this week compared to last week — that's $34 saved. At this pace, your Emergency Fund goal moves up by 3 weeks.",
  generatedAt: new Date().toISOString(),
  type: "spending",
};

export const MOCK_BUD_GREETING = (firstName: string, streak: number): string => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return `Good morning, ${firstName}. You're on a ${streak}-day streak — let's make today count.`;
  } else if (hour < 17) {
    return `Hey ${firstName}. You've got ${streak} days running — stay sharp this afternoon.`;
  } else {
    return `Good evening, ${firstName}. ${streak} days strong. Tonight's a good time to check your spending.`;
  }
};

export const MOCK_SESSIONS: BudSession[] = [
  {
    id: "session_1",
    title: "The 50/30/20 Rule — Does It Actually Work?",
    category: "Budgeting Foundations",
    duration: "4 min",
    xpReward: 75,
    completed: true,
    completedAt: "2026-04-28T00:00:00Z",
    whyItMattersNow: "You're building your first real budget — knowing the frameworks makes it click faster.",
  },
  {
    id: "session_2",
    title: "Why Your Emergency Fund is Your Most Important Asset",
    category: "Saving & Emergency Funds",
    duration: "5 min",
    xpReward: 75,
    completed: false,
    whyItMattersNow: "You're 22% into your Emergency Fund goal — this session explains exactly why 3 months matters.",
  },
  {
    id: "session_3",
    title: "How Compound Interest Works (and Why Starting Now Is Insane)",
    category: "Investing Basics",
    duration: "5 min",
    xpReward: 75,
    completed: false,
    whyItMattersNow: "At your savings rate, starting to invest even $50/month now makes a massive difference by 35.",
  },
  {
    id: "session_4",
    title: "The Psychology of Impulse Spending",
    category: "Behavioral Finance",
    duration: "3 min",
    xpReward: 75,
    completed: false,
    whyItMattersNow: "Your Shopping category is $37 over budget — this session breaks down why it keeps happening.",
  },
];

export const MOCK_CHAT_HISTORY: BudMessage[] = [
  {
    id: "m1",
    role: "user",
    content: "How do I build an emergency fund faster?",
    timestamp: "2026-05-05T14:30:00Z",
  },
  {
    id: "m2",
    role: "bud",
    content:
      "A lot of people in your situation find that automating a small, fixed transfer right after payday is the most consistent approach. Even $50/paycheck adds up to $1,200 a year without feeling it. Based on your current spending, you have about $340 unallocated this month — funneling half of that to savings would put you ahead of pace for your Emergency Fund goal.",
    timestamp: "2026-05-05T14:30:45Z",
  },
];
