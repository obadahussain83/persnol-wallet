/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://unistyl.es/), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B1220',
    background: '#F3F4F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7ECEF',
    textSecondary: '#5B6573',
    border: 'rgba(11,18,32,0.09)',
    primary: '#0F766E',
    primaryText: '#FFFFFF',
    danger: '#C62828',
    income: '#15803D',
    expense: '#B42318',
    warning: '#B45309',
  },
  dark: {
    text: '#F2F4F7',
    background: '#06080C',
    backgroundElement: '#0F141B',
    backgroundSelected: '#1A222D',
    textSecondary: '#9AA4B2',
    border: 'rgba(255,255,255,0.09)',
    primary: '#2DD4BF',
    primaryText: '#04201D',
    danger: '#F87171',
    income: '#4ADE80',
    expense: '#F87171',
    warning: '#FBBF24',
  },
} as const;

// User-selectable replacement for `primary`. Light shades sit under white text, dark shades under near-black text.
export const Accents = {
  teal: { light: '#0F766E', dark: '#2DD4BF' },
  blue: { light: '#1D4ED8', dark: '#60A5FA' },
  purple: { light: '#7C3AED', dark: '#A78BFA' },
  pink: { light: '#BE185D', dark: '#F472B6' },
  orange: { light: '#C2410C', dark: '#FB923C' },
} as const;
export type Accent = keyof typeof Accents;

export type ThemeColor =keyof typeof Colors.light & keyof typeof Colors.dark;

// Non-color surface treatment per scheme: the outer "tray" tint, the ambient glow strength, and the card
// shadow (a soft tray ring, a top inner highlight, and a diffused drop) that makes surfaces read as machined.
export const Surface = {
  light: {
    shell: 'rgba(11,18,32,0.035)', glow: 0.16,
    cardShadow: '0 0 0 5px rgba(11,18,32,0.03), inset 0 1px 0 rgba(255,255,255,0.9), 0 28px 48px -32px rgba(11,18,32,0.25)',
  },
  dark: {
    shell: 'rgba(255,255,255,0.035)', glow: 0.24,
    cardShadow: '0 0 0 5px rgba(255,255,255,0.025), inset 0 1px 0 rgba(255,255,255,0.08), 0 28px 48px -28px rgba(0,0,0,0.7)',
  },
} as const;

export const Fonts =Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 960;
export const Radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;
/** Width at which the layout switches from bottom tabs to a sidebar. */
export const DesktopBreakpoint = 900;
