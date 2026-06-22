/**
 * Icon — single, curated wrapper around Lucide icons.
 *
 * Why this exists:
 *   • One place to swap icon library if we ever change it.
 *   • One place to enforce consistent stroke width + sizing.
 *   • Tree-shaking only the icons we actually use.
 *
 * Usage:
 *   <Icon name="trending-up" size={18} color={Colors.gold} />
 *
 * To add a new icon: import it from lucide-react-native and add to the map.
 * Do NOT import Lucide icons directly anywhere else in the codebase.
 */

import React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CreditCard,
  DollarSign,
  Eye,
  EyeOff,
  Flame,
  Goal,
  Hand,
  Home,
  Info,
  Layers,
  LineChart,
  Lock,
  Menu,
  type LucideIcon,
  Medal,
  MessageCircle,
  Minus,
  MoreHorizontal,
  PiggyBank,
  Plus,
  Receipt,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react-native";

const ICONS = {
  activity: Activity,
  "arrow-down-right": ArrowDownRight,
  "arrow-left": ArrowLeft,
  "arrow-up-right": ArrowUpRight,
  "badge-check": BadgeCheck,
  banknote: Banknote,
  "bar-chart": BarChart3,
  bell: Bell,
  building: Building2,
  calendar: Calendar,
  check: Check,
  "check-circle": CheckCircle2,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  "alert-circle": CircleAlert,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  eye: Eye,
  "eye-off": EyeOff,
  flame: Flame,
  goal: Goal,
  hand: Hand,
  home: Home,
  info: Info,
  layers: Layers,
  "line-chart": LineChart,
  lock: Lock,
  menu: Menu,
  medal: Medal,
  "message-circle": MessageCircle,
  minus: Minus,
  "more-horizontal": MoreHorizontal,
  "piggy-bank": PiggyBank,
  plus: Plus,
  receipt: Receipt,
  search: Search,
  settings: Settings,
  shield: Shield,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  target: Target,
  "trending-down": TrendingDown,
  "trending-up": TrendingUp,
  trophy: Trophy,
  user: User,
  "user-plus": UserPlus,
  users: Users,
  wallet: Wallet,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

interface Props {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 18, color = "#FFFFFF", strokeWidth = 2 }: Props) {
  const Component = ICONS[name];
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}
