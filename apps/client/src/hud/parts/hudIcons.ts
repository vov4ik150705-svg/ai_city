/** Central Lucide registry. Semantic map: HUD_DESIGN_SYSTEM.md UI ICON SYSTEM §7. */
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleCheck,
  CircleHelp,
  CircleX,
  ClipboardList,
  Clock,
  ArrowUpRight,
  Coins,
  Cpu,
  Factory,
  FlaskConical,
  Gauge,
  GitBranch,
  GitMerge,
  GraduationCap,
  HardDrive,
  Heart,
  Info,
  Landmark,
  Layers3,
  List,
  LoaderCircle,
  Lock,
  LockOpen,
  Mail,
  Maximize2,
  Plus,
  ScrollText,
  Search,
  Settings,
  Shield,
  SlidersHorizontal,
  Store,
  Sun,
  TrendingUp,
  TriangleAlert,
  Truck,
  User,
  UserRoundCheck,
  Users,
  WalletCards,
  X,
  Zap,
  Wifi,
  type LucideIcon,
} from "lucide-react"

export const HUD_ICON_STROKE = 1.75

export const HUD_ICON_SIZE = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 40,
  display: 48,
} as const

export type HudIconSize = keyof typeof HUD_ICON_SIZE
export type HudIconSemantic = "default" | "active" | "success" | "warning" | "error" | "locked" | "muted"

export type HudGlyph =
  | "coin"
  | "people"
  | "pulse"
  | "heart"
  | "shield"
  | "bolt"
  | "chip"
  | "bank"
  | "agents"
  | "factory"
  | "market"
  | "log"
  | "gear"
  | "bell"
  | "sun"
  | "city"
  | "building"
  | "close"
  | "search"
  | "filter"
  | "help"
  | "back"
  | "forward"
  | "expand"
  | "collapse"
  | "info"
  | "success"
  | "warning"
  | "error"
  | "locked"
  | "unlocked"
  | "loading"
  | "time"
  | "industry"
  | "tier"
  | "merge"
  | "branch"
  | "gauge"
  | "wallet"
  | "plus"
  | "go"
  | "stake"
  | "cost"
  | "requirement"
  | "capacity"
  | "agent"
  | "role"
  | "assignment"
  | "task"
  | "xp"
  | "training"
  | "research"
  | "workshop"
  | "power"
  | "logistics"
  | "retail"
  | "activity"
  | "event"
  | "notify"
  | "message"
  | "wifi"

export const HUD_ICONS: { readonly [K in HudGlyph]: LucideIcon } = {
  coin: Coins,
  people: Users,
  pulse: Activity,
  heart: Heart,
  shield: Shield,
  bolt: Zap,
  chip: Cpu,
  bank: Landmark,
  agents: Users,
  factory: Factory,
  market: ArrowLeftRight,
  log: ScrollText,
  gear: Settings,
  bell: Bell,
  wifi: Wifi,
  sun: Sun,
  city: Building2,
  building: Building2,
  close: X,
  search: Search,
  filter: SlidersHorizontal,
  help: CircleHelp,
  back: ArrowLeft,
  forward: ArrowRight,
  expand: Maximize2,
  collapse: ChevronDown,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleX,
  locked: Lock,
  unlocked: LockOpen,
  loading: LoaderCircle,
  time: Clock,
  industry: Building2,
  tier: Layers3,
  merge: GitMerge,
  branch: GitBranch,
  gauge: Gauge,
  wallet: WalletCards,
  plus: Plus,
  go: ArrowUpRight,
  stake: Landmark,
  cost: Coins,
  requirement: BadgeCheck,
  capacity: HardDrive,
  agent: User,
  role: BriefcaseBusiness,
  assignment: UserRoundCheck,
  task: ClipboardList,
  xp: TrendingUp,
  training: GraduationCap,
  research: FlaskConical,
  workshop: Factory,
  power: Zap,
  logistics: Truck,
  retail: Store,
  activity: Activity,
  event: List,
  notify: Bell,
  message: Mail,
}

export const HUD_LUCIDE: { readonly [K in HudGlyph]: string } = {
  coin: "Coins",
  people: "Users",
  pulse: "Activity",
  heart: "Heart",
  shield: "Shield",
  bolt: "Zap",
  chip: "Cpu",
  bank: "Landmark",
  agents: "Users",
  factory: "Factory",
  market: "ArrowLeftRight",
  log: "ScrollText",
  gear: "Settings",
  bell: "Bell",
  wifi: "Wifi",
  sun: "Sun",
  city: "Building2",
  building: "Building2",
  close: "X",
  search: "Search",
  filter: "SlidersHorizontal",
  help: "CircleHelp",
  back: "ArrowLeft",
  forward: "ArrowRight",
  expand: "Maximize2",
  collapse: "ChevronDown",
  info: "Info",
  success: "CircleCheck",
  warning: "TriangleAlert",
  error: "CircleX",
  locked: "Lock",
  unlocked: "LockOpen",
  loading: "LoaderCircle",
  time: "Clock",
  industry: "Building2",
  tier: "Layers3",
  merge: "GitMerge",
  branch: "GitBranch",
  gauge: "Gauge",
  wallet: "WalletCards",
  plus: "Plus",
  go: "ArrowUpRight",
  stake: "Landmark",
  cost: "Coins",
  requirement: "BadgeCheck",
  capacity: "HardDrive",
  agent: "User",
  role: "BriefcaseBusiness",
  assignment: "UserRoundCheck",
  task: "ClipboardList",
  xp: "TrendingUp",
  training: "GraduationCap",
  research: "FlaskConical",
  workshop: "Factory",
  power: "Zap",
  logistics: "Truck",
  retail: "Store",
  activity: "Activity",
  event: "List",
  notify: "Bell",
  message: "Mail",
}

/** Accessible names for icon-only use. `gear` is registry-only; not a Settings destination. */
export const HUD_ICON_NAME: { readonly [K in HudGlyph]: string } = {
  coin: "Capital",
  people: "Workforce",
  pulse: "Activity",
  heart: "Happiness",
  shield: "Stability",
  bolt: "Energy",
  chip: "Compute",
  bank: "Bank",
  agents: "Agents",
  factory: "Workshop",
  market: "Exchange",
  log: "Journal",
  gear: "Settings",
  bell: "Notifications",
  wifi: "Connection",
  sun: "Daytime",
  city: "City",
  building: "Building",
  close: "Close",
  search: "Search",
  filter: "Filter",
  help: "Help",
  back: "Back",
  forward: "Forward",
  expand: "Expand",
  collapse: "Collapse",
  info: "Info",
  success: "Success",
  warning: "Warning",
  error: "Error",
  locked: "Locked",
  unlocked: "Unlocked",
  loading: "Loading",
  time: "Time",
  industry: "Industry",
  tier: "Tier",
  merge: "Merge",
  branch: "Branch",
  gauge: "Gauge",
  wallet: "Wallet",
  plus: "Add",
  go: "Open",
  stake: "Stake",
  cost: "Cost",
  requirement: "Requirement",
  capacity: "Capacity",
  agent: "Agent",
  role: "Role",
  assignment: "Assignment",
  task: "Task",
  xp: "XP",
  training: "Training",
  research: "Research",
  workshop: "Workshop",
  power: "Power",
  logistics: "Logistics",
  retail: "Retail",
  activity: "Activity",
  event: "Event log",
  notify: "Notifications",
  message: "Message",
}

export function hudIconName(glyph: HudGlyph): string {
  return HUD_ICON_NAME[glyph]
}
