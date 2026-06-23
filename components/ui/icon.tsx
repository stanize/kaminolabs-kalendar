import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  X,
  Mail,
  Phone,
  Plus,
  Sparkles,
  Leaf,
  List,
  Grid2x2,
  User,
  Users,
  Clock,
  type LucideIcon,
} from "lucide-react";

export const ICONOS: Record<string, LucideIcon> = {
  calendar: Calendar,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  arrowRight: ArrowRight,
  x: X,
  mail: Mail,
  phone: Phone,
  plus: Plus,
  sparkles: Sparkles,
  leaf: Leaf,
  list: List,
  grid: Grid2x2,
  user: User,
  users: Users,
  clock: Clock,
};

export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  className,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Cmp = ICONOS[name] ?? Calendar;
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} />;
}
