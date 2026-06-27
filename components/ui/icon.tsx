import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  Home,
  Settings,
  CreditCard,
  FileText,
  Bell,
  BarChart2,
  LogOut,
  ExternalLink,
  Building2,
  LifeBuoy,
  MessageSquare,
  Paperclip,
  Send,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  calendar: Calendar,
  check: Check,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
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
  home: Home,
  settings: Settings,
  creditCard: CreditCard,
  fileText: FileText,
  bell: Bell,
  barChart: BarChart2,
  logOut: LogOut,
  externalLink: ExternalLink,
  building: Building2,
  lifeBuoy: LifeBuoy,
  messageSquare: MessageSquare,
  paperclip: Paperclip,
  send: Send,
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
  const Cmp = ICONS[name] ?? Calendar;
  return <Cmp size={size} strokeWidth={strokeWidth} className={className} />;
}
