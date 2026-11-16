import {
  Archive, ArchiveRestore, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, ChevronDown, List, Search, Baby, Banknote, BookOpen, Briefcase, Building2, Bus, Car, Check, ChefHat, ChevronRight,
  CircleEllipsis, CirclePlus, Clapperboard, Cloud, CloudOff, Coffee, Coins, CreditCard, Droplet, Dumbbell, Ellipsis, Fuel,
  Gamepad2, Gift, GraduationCap, HeartPulse, House, Landmark, Laptop, LayoutDashboard, LogOut, type LucideIcon, Music,
  PawPrint, Pencil, PiggyBank, Plane, Plus, Receipt, RefreshCw, Repeat, Settings, Shirt, ShoppingBag, Smartphone, Tag, Tags,
  Trash2, TrendingUp, User, Utensils, Wallet, Wifi, X, Zap,
} from 'lucide-react-native';

import { usePreferences } from '@/preferences/preferences-provider';

// Icon names are stored in the DB (accounts.icon, categories.icon), so this map is the contract.
const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet, landmark: Landmark, smartphone: Smartphone, 'piggy-bank': PiggyBank, 'credit-card': CreditCard,
  banknote: Banknote, coins: Coins,
  utensils: Utensils, 'chef-hat': ChefHat, bus: Bus, fuel: Fuel, 'shopping-bag': ShoppingBag, shirt: Shirt, receipt: Receipt,
  house: House, 'heart-pulse': HeartPulse, clapperboard: Clapperboard, repeat: Repeat, plane: Plane,
  'graduation-cap': GraduationCap, user: User, 'circle-ellipsis': CircleEllipsis, briefcase: Briefcase, laptop: Laptop,
  'building-2': Building2, 'trending-up': TrendingUp, gift: Gift, 'circle-plus': CirclePlus, tag: Tag, car: Car,
  coffee: Coffee, dumbbell: Dumbbell, baby: Baby, 'paw-print': PawPrint, wifi: Wifi, zap: Zap, droplet: Droplet,
  'book-open': BookOpen, music: Music, 'gamepad-2': Gamepad2,
  // UI
  'layout-dashboard': LayoutDashboard, tags: Tags, settings: Settings, ellipsis: Ellipsis, plus: Plus, archive: Archive,
  'archive-restore': ArchiveRestore, trash: Trash2, 'chevron-right': ChevronRight, check: Check, cloud: Cloud,
  'cloud-off': CloudOff, 'refresh-cw': RefreshCw, 'log-out': LogOut, x: X, pencil: Pencil,
  'arrow-left-right': ArrowLeftRight, 'arrow-down-left': ArrowDownLeft, 'arrow-up-right': ArrowUpRight,
  'chevron-down': ChevronDown, list: List, search: Search,
};

export const ACCOUNT_ICONS = ['wallet', 'landmark', 'smartphone', 'piggy-bank', 'credit-card', 'banknote', 'coins'];
export const CATEGORY_ICONS = [
  'utensils', 'chef-hat', 'bus', 'car', 'fuel', 'shopping-bag', 'shirt', 'receipt', 'house', 'zap', 'droplet', 'wifi',
  'heart-pulse', 'clapperboard', 'gamepad-2', 'music', 'repeat', 'plane', 'graduation-cap', 'book-open', 'coffee',
  'dumbbell', 'baby', 'paw-print', 'user', 'gift', 'briefcase', 'laptop', 'building-2', 'trending-up', 'coins', 'tag',
  'circle-plus', 'circle-ellipsis',
];
export const SWATCHES = [
  '#0F766E', '#2E9E6A', '#3D85C6', '#5C6BC0', '#7E57C2', '#C2185B', '#E07A5F', '#E0A030', '#8D6E63', '#78909C', '#D64545', '#26A69A',
];

const DIRECTIONAL = new Set(['chevron-right', 'log-out']);

export function AppIcon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const { isRTL } = usePreferences();
  const Icon = ICONS[name] ?? Tag;
  const flip = isRTL && DIRECTIONAL.has(name);
  // Thin strokes: the default 2px reads heavy next to the light type.
  return <Icon size={size} color={color} strokeWidth={1.6} style={flip ? { transform: [{ scaleX: -1 }] } : undefined} />;
}
