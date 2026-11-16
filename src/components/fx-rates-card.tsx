import { useQuery } from '@powersync/react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/app-icon';
import { Button, Card, TextField } from '@/components/ui/primitives';
import { Spacing } from '@/constants/theme';
import { CURRENCIES } from '@/data/accounts';
import { clearManualRate, crossRate, type FxRow, ratesOf, refreshRates, setManualRate } from '@/data/fx';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/session/session-provider';

/** "1 X = N primary" for each other currency; typing a value pins it as a manual rate. */
export function FxRatesCard({ primary }: { primary: string }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { db } = useUser();
  const { data: rows } = useQuery<FxRow>('SELECT id, per_usd, base, fetched_at, manual FROM fx_rates');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; ok: boolean } | null>(null);
  const rates = ratesOf(rows);
  const updated = rows.filter((r) => !r.manual).map((r) => r.fetched_at).sort().at(-1);
  const when = updated ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(updated)) : null;

  const refresh = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await refreshRates(db, fetch, new Date(), true);
      setStatus({ text: t('fx.refreshed'), ok: true });
    } catch {
      setStatus({ text: t('fx.offline'), ok: false });
    } finally {
      setBusy(false);
    }
  };
  const save = async (code: string) => {
    const raw = drafts[code];
    if (raw === undefined) return;
    const value = Number(raw.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace('٫', '.').trim());
    if (!(value > 0)) { setStatus({ text: t('errors.invalidAmount'), ok: false }); return; }
    await setManualRate(db, code, primary, value);
    setDrafts(({ [code]: _, ...rest }) => rest);
  };

  return (
    <Card>
      <ThemedText type="small" themeColor="textSecondary">{t('fx.hint', { currency: primary })}</ThemedText>
      {CURRENCIES.filter((c) => c !== primary).map((code) => {
        const rate = crossRate(rates, code, primary);
        const manual = rows.some((r) => r.id === code && r.manual);
        return (
          <View key={code} style={styles.row}>
            <View style={styles.flex}>
              <TextField label={t('fx.oneUnit', { code, primary })} value={drafts[code] ?? (rate ? String(Number(Number(rate).toFixed(4))) : '')}
                placeholder="—" keyboardType="decimal-pad" inputMode="decimal"
                onChangeText={(v) => setDrafts((d) => ({ ...d, [code]: v }))} onBlur={() => save(code)} onSubmitEditing={() => save(code)}
                hint={manual ? t('fx.manual') : undefined} />
            </View>
            {manual ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('fx.useAuto')} hitSlop={10} onPress={() => clearManualRate(db, code).then(refresh)}>
                <AppIcon name="refresh-cw" size={18} color={theme.textSecondary} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <ThemedText type="small" themeColor="textSecondary">{when ? t('fx.updated', { when }) : t('fx.never')}</ThemedText>
      <Button variant="secondary" icon="refresh-cw" label={t('fx.refresh')} onPress={refresh} loading={busy} />
      {status ? <ThemedText type="small" style={{ color: status.ok ? theme.income : theme.danger }} accessibilityLiveRegion="polite">{status.text}</ThemedText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
});
