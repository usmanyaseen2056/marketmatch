import { ReactNode, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { router } from 'expo-router';
import { colors, fonts, radius } from '@/lib/theme';
import { mmss, secondsLeft } from '@/lib/format';

/* ---------- Text ---------- */

type TProps = { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number };

export function H1({ children, style }: TProps) {
  return <Text style={[s.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: TProps) {
  return <Text style={[s.h2, style]}>{children}</Text>;
}
export function Body({ children, style, numberOfLines }: TProps) {
  return (
    <Text style={[s.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function Muted({ children, style, numberOfLines }: TProps) {
  return (
    <Text style={[s.muted, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}
export function Label({ children, style }: TProps) {
  return <Text style={[s.label, style]}>{children}</Text>;
}
export function Overline({ children, style }: TProps) {
  return <Text style={[s.overline, style]}>{children}</Text>;
}

/* ---------- Icons (simple stroke icons, matching the design) ---------- */

const ICONS: Record<string, string> = {
  back: 'M19 12H5M11 6l-6 6 6 6',
  forward: 'M5 12h14M13 6l6 6-6 6',
  search: 'M20 20l-3.5-3.5M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z',
  clock: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  message: 'M4 5h16v11H9l-5 4z',
  check: 'M5 12l5 5 9-10',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2',
  smartphone: 'M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM11 18h2',
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M10 20v-5h4v5',
  bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  box: 'M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
};

export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 2 }: { name: keyof typeof ICONS | string; size?: number; color?: string; strokeWidth?: number }) {
  if (name === 'star') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill={color} />
      </Svg>
    );
  }
  if (name === 'dot') {
    return (
      <Svg width={size} height={size} viewBox="0 0 10 10">
        <Circle cx="5" cy="5" r="4" fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d={ICONS[name] ?? ''} />
    </Svg>
  );
}

/* ---------- Layout ---------- */

export function Screen({
  children,
  footer,
  scroll = true,
  background = colors.surface,
  padded = true,
  header,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  background?: string;
  padded?: boolean;
  header?: ReactNode;
}) {
  const content = padded ? <View style={s.padded}>{children}</View> : children;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: background }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {header}
        {scroll ? (
          <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>{content}</View>
        )}
        {footer ? (
          <SafeAreaView edges={['bottom']} style={s.footer}>
            {footer}
          </SafeAreaView>
        ) : (
          <SafeAreaView edges={['bottom']} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function TopBar({ title, subtitle, right, onBack }: { title?: string; subtitle?: string; right?: ReactNode; onBack?: () => void }) {
  return (
    <View style={s.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={s.iconBtn}
        hitSlop={8}
      >
        <Icon name="back" size={24} strokeWidth={2.2} />
      </Pressable>
      <View style={{ flex: 1 }}>
        {title ? <Text style={s.topTitle} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Muted numberOfLines={1} style={{ fontSize: 13 }}>{subtitle}</Muted> : null}
      </View>
      {right}
    </View>
  );
}

export function Row({ children, gap = 8, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Stack({ children, gap = 12, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Card({ children, style, onPress, strong }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; strong?: boolean }) {
  const cardStyle = [s.card, strong && { borderColor: colors.ink, borderWidth: 1.5 }, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [cardStyle, pressed && { opacity: 0.85 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.lineSoft }} />;
}

/* ---------- Controls ---------- */

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  subtitle,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'green' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = {
    primary: colors.ink,
    green: colors.green,
    secondary: colors.surface,
    ghost: colors.soft,
    danger: colors.soft,
  }[variant];
  const fg = { primary: '#fff', green: '#fff', secondary: colors.ink, ghost: colors.ink, danger: colors.red }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        s.btn,
        { backgroundColor: bg, opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'secondary' && { borderWidth: 1.5, borderColor: colors.line },
        subtitle ? { height: 60 } : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ alignItems: 'center' }}>
          <Row gap={8}>
            {icon ? <Icon name={icon} size={18} color={fg} /> : null}
            <Text style={[s.btnText, { color: fg }]}>{title}</Text>
          </Row>
          {subtitle ? <Text style={[s.btnSub, { color: fg }]}>{subtitle}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, swatch }: { label: string; active: boolean; onPress: () => void; swatch?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[s.chip, active ? s.chipOn : s.chipOff]}
    >
      {swatch ? <View style={[s.swatch, { backgroundColor: swatch }]} /> : null}
      <Text style={[s.chipText, { color: active ? '#fff' : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipGroup<T extends string | number>({
  options,
  value,
  onChange,
  swatches,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  swatches?: Record<string, string>;
}) {
  return (
    <Row wrap gap={8}>
      {options.map((o) => (
        <Chip key={String(o.value)} label={o.label} active={o.value === value} onPress={() => onChange(o.value)} swatch={swatches?.[String(o.value)]} />
      ))}
    </Row>
  );
}

export function Field({ label, hint, error, big, ...props }: TextInputProps & { label: string; hint?: string; error?: string | null; big?: boolean }) {
  return (
    <View style={{ gap: 6, flex: props.style ? undefined : undefined }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        accessibilityLabel={label}
        style={[s.input, big && s.inputBig, error ? { borderColor: colors.red } : null, props.style]}
      />
      {error ? <Text style={s.error}>{error}</Text> : hint ? <Muted style={{ fontSize: 13 }}>{hint}</Muted> : null}
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Label>{title}</Label>
        {right}
      </Row>
      {children}
    </View>
  );
}

/* ---------- Badges & status ---------- */

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'green' | 'amber' | 'dark' | 'red' }) {
  const map = {
    neutral: [colors.soft, colors.ink],
    green: [colors.greenSoft, colors.greenDark],
    amber: [colors.amberSoft, colors.amberText],
    dark: [colors.ink, '#fff'],
    red: [colors.redSoft, colors.red],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/** Live countdown pill. Shows "Expired" at zero. */
export function Countdown({ until, prefix = '', tone = 'amber' }: { until: string | null | undefined; prefix?: string; tone?: 'amber' | 'dark' }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = secondsLeft(until, now);
  const bg = tone === 'dark' ? '#1F1F1E' : colors.amberSoft;
  const fg = tone === 'dark' ? '#7FE0A8' : colors.amberText;
  return (
    <View style={[s.pill, { backgroundColor: left === 0 ? colors.soft : bg }]}>
      <Icon name="clock" size={14} color={left === 0 ? colors.muted : fg} strokeWidth={2.4} />
      <Text style={[s.pillText, { color: left === 0 ? colors.muted : fg }]}>{left === 0 ? 'Expired' : `${prefix}${mmss(left)}`}</Text>
    </View>
  );
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function Rating({ value, count }: { value: number; count?: number }) {
  return (
    <Row gap={4}>
      <Icon name="star" size={13} />
      <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.ink }}>{count ? value.toFixed(1) : 'New'}</Text>
      {count ? <Muted style={{ fontSize: 13 }}>({count})</Muted> : null}
    </Row>
  );
}

export function PhotoBox({ uri, size = 96, height, label }: { uri?: string | null; size?: number | '100%'; height?: number; label?: string }) {
  const iconSize = typeof size === 'number' ? Math.min(30, size / 3) : 64;
  return (
    <View style={{ width: size, height: height ?? (typeof size === 'number' ? size : 300), borderRadius: size === '100%' ? 0 : radius.md, backgroundColor: colors.photoTint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Icon name="smartphone" size={iconSize} color="#4A3D5A" strokeWidth={1.4} />}
      {label ? (
        <View style={{ position: 'absolute', left: 6, bottom: 6, backgroundColor: colors.ink, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: '#fff', fontSize: 11, fontFamily: fonts.semibold }}>{label}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator color={colors.ink} />
    </View>
  );
}

export function Empty({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 8 }}>
      <Text style={[s.h2, { textAlign: 'center' }]}>{title}</Text>
      {text ? <Muted style={{ textAlign: 'center' }}>{text}</Muted> : null}
      {action ? <View style={{ marginTop: 8, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <Text style={s.error}>{children}</Text>;
}

/* ---------- Styles ---------- */

const s = StyleSheet.create({
  h1: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 34, color: colors.ink, letterSpacing: -0.5 },
  h2: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  label: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  overline: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.muted },
  padded: { paddingHorizontal: 20, paddingTop: 8, gap: 22 },
  footer: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.lineSoft, backgroundColor: colors.surface, gap: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 },
  topTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineSoft, padding: 16, gap: 12 },
  btn: { height: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexGrow: 1 },
  btnText: { fontFamily: fonts.bold, fontSize: 16 },
  btnSub: { fontFamily: fonts.regular, fontSize: 12, opacity: 0.8, marginTop: 1 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5 },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipOff: { backgroundColor: colors.surface, borderColor: colors.line },
  chipText: { fontFamily: fonts.semibold, fontSize: 14 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.2)' },
  input: { height: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 14, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  inputBig: { height: 60, borderWidth: 2, borderColor: colors.ink, fontSize: 24, fontFamily: fonts.bold },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: colors.red },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.bold, fontSize: 13 },
});
