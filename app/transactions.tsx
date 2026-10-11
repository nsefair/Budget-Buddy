/**
 * Transactions — a month's bank history in Budget's card language: a calm
 * glow header, rows grouped under quiet date headers, Budget's tinted
 * category tiles, and amounts with muted cents. Month and category filters,
 * search, and pagination behave as before.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { FadeInUp, Shimmer } from "@/animations";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import { CategoryIcon } from "@/features/budget/BudgetVisuals";
import { useUser } from "@/hooks/useAuth";
import type { BudgetCategory, Transaction } from "@/mock/budget";
import { BUDGET_KEYS, budgetService } from "@/services/budgetService";
import { formatCurrency, secureLog } from "@/utils/security";

const PAGE_SIZE = 30;
const SIDE = 18;

type DayGroup = { key: string; transactions: Transaction[] };

function labelForMonth(month?: string) {
  if (!month) return null;
  const parsed = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Same day boundary as the Budget calendar: the date part of the bank date.
function dayLabel(key: string) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (key === localDayKey(today)) return "Today";
  if (key === localDayKey(yesterday)) return "Yesterday";
  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = transaction.date.slice(0, 10);
    const day = groups.get(key);
    if (day) day.push(transaction);
    else groups.set(key, [transaction]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, items]) => ({ key, transactions: items }));
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const user = useUser();
  const params = useLocalSearchParams<{ month?: string | string[]; category?: string | string[] }>();
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const category = Array.isArray(params.category) ? params.category[0] : params.category;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Budget's categories give each row the same icon tile. Keyed by user.
  const categories = useQuery({
    queryKey: [...BUDGET_KEYS.all, "categories", user?.id, month ?? "current"],
    queryFn: () => budgetService.getCategories(month),
    enabled: Boolean(user),
    staleTime: 1000 * 60 * 5,
  });
  const categoryFor = useCallback(
    (key: string): BudgetCategory | undefined =>
      categories.data?.find((item) => item.id === key || item.name === key),
    [categories.data]
  );

  const loadFirstPage = useCallback(async () => {
    const next = await budgetService.getTransactions({
      month,
      category,
      page: 1,
      limit: PAGE_SIZE,
    });
    setTransactions(next);
    setPage(1);
    setHasMore(next.length === PAGE_SIZE);
  }, [month, category]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    budgetService
      .getTransactions({ month, category, page: 1, limit: PAGE_SIZE })
      .then((next) => {
        if (!alive) return;
        setTransactions(next);
        setPage(1);
        setHasMore(next.length === PAGE_SIZE);
      })
      .catch((error) => secureLog.error("transactions.load failed", error))
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [month, category]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadFirstPage();
    } catch (error) {
      secureLog.error("transactions.refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || loadingMore || loading || query.trim()) return;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const next = await budgetService.getTransactions({
        month,
        category,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setTransactions((current) => {
        const known = new Set(current.map((transaction) => transaction.id));
        return [...current, ...next.filter((transaction) => !known.has(transaction.id))];
      });
      setPage(nextPage);
      setHasMore(next.length === PAGE_SIZE);
    } catch (error) {
      secureLog.error("transactions.load-more failed", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return transactions;
    return transactions.filter((transaction) =>
      `${transaction.merchant} ${transaction.category}`.toLowerCase().includes(value)
    );
  }, [query, transactions]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  const monthLabel = labelForMonth(month);
  const title = category
    ? categoryFor(category)?.name ?? transactions[0]?.category ?? "Transactions"
    : "Transactions";
  const searching = Boolean(query.trim());

  return (
    <View style={styles.container}>
      <FlatList
        data={loading ? [] : groups}
        keyExtractor={(group) => group.key}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.navy} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <LinearGradient
              pointerEvents="none"
              colors={[Colors.accentAlpha14, Colors.accentAlpha05, "transparent"]}
              style={styles.glow}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to budget"
              hitSlop={8}
              onPress={() => {
                Haptics.selectionAsync();
                router.back();
              }}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            >
              <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
            </Pressable>
            <Text style={styles.eyebrow}>{(monthLabel ?? "All months").toUpperCase()}</Text>
            <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
              {title}
            </Text>
            <View style={styles.search}>
              <Icon name="search" size={17} color={Colors.muted} strokeWidth={2.4} />
              <TextInput
                accessibilityLabel="Search transactions"
                value={query}
                onChangeText={setQuery}
                placeholder="Search merchant or category"
                placeholderTextColor={Colors.muted}
                returnKeyType="search"
                style={styles.searchInput}
              />
              {searching ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={10}
                  onPress={() => setQuery("")}
                  style={styles.clearBtn}
                >
                  <Icon name="x" size={13} color={Colors.navyMuted} strokeWidth={2.6} />
                </Pressable>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <LoadingDay />
          ) : (
            <View style={[styles.card, styles.stateCard]}>
              <View style={styles.stateTile}>
                <Icon
                  name={searching ? "search" : "receipt"}
                  size={18}
                  color={Colors.navyMuted}
                  strokeWidth={2.3}
                />
              </View>
              <Text style={styles.stateTitle}>
                {searching ? "No matching transactions" : "No transactions yet"}
              </Text>
              <Text style={styles.stateText}>
                {searching
                  ? "Try another merchant or category."
                  : "Transactions will appear after the next bank sync."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={Colors.navyMuted} />
              <Text style={styles.footerText}>Loading more…</Text>
            </View>
          ) : !hasMore && transactions.length > 0 && !searching ? (
            <Text style={styles.endText}>
              {monthLabel ? `That's everything for ${monthLabel}.` : "That's everything."}
            </Text>
          ) : null
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={index < 5 ? index * 60 : 0}>
            <DayCard group={item} categoryFor={categoryFor} />
          </FadeInUp>
        )}
      />
    </View>
  );
}

function DayCard({
  group,
  categoryFor,
}: {
  group: DayGroup;
  categoryFor: (key: string) => BudgetCategory | undefined;
}) {
  return (
    <View style={styles.day}>
      <Text style={styles.dayLabel} accessibilityRole="header">
        {dayLabel(group.key)}
      </Text>
      <View style={styles.card}>
        {group.transactions.map((transaction, index) => (
          <TransactionRow
            key={transaction.id}
            transaction={transaction}
            category={categoryFor(transaction.categoryId)}
            last={index === group.transactions.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

function TransactionRow({
  transaction,
  category,
  last,
}: {
  transaction: Transaction;
  category?: BudgetCategory;
  last: boolean;
}) {
  // Spending is positive in the ledger; money in is negative.
  const incoming = transaction.amount < 0;
  const meta = [
    transaction.category,
    transaction.isPending ? "Pending" : "",
    transaction.isRecurring ? "Recurring" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={`${transaction.merchant}, ${meta}, ${incoming ? "plus" : "minus"} ${formatCurrency(Math.abs(transaction.amount))}`}
      >
        <CategoryIcon category={category} incoming={incoming} size={38} />
        {/* Two lines each so large text wraps instead of clipping names. */}
        <View style={styles.rowCopy}>
          <Text style={styles.merchant} numberOfLines={2}>
            {transaction.merchant}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {meta}
          </Text>
        </View>
        <Amount value={-transaction.amount} incoming={incoming} />
      </View>
      {last ? null : <View style={styles.divider} />}
    </>
  );
}

// Cents sit quieter than dollars, as in Budget's hero numbers. The amount
// grows with Dynamic Type only so far, leaving the merchant room to read.
function Amount({ value, incoming }: { value: number; incoming: boolean }) {
  const text = formatCurrency(value, { sign: true });
  const match = /^(.*)(\.\d{2})$/.exec(text);
  return (
    <Text style={[styles.amount, incoming && styles.amountIncoming]} maxFontSizeMultiplier={1.4}>
      {match ? match[1] : text}
      {match ? (
        <Text style={incoming ? styles.centsIncoming : styles.cents}>{match[2]}</Text>
      ) : null}
    </Text>
  );
}

function LoadingDay() {
  return (
    <View style={styles.day} accessibilityLabel="Loading transactions">
      <Shimmer style={styles.dayLabelSkeleton} radius={5} />
      <View style={styles.card}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.row}>
            <Shimmer style={styles.tileSkeleton} radius={19} />
            <View style={styles.rowCopy}>
              <Shimmer style={styles.lineSkeleton} radius={6} />
              <Shimmer style={styles.lineSkeletonShort} radius={6} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  listContent: { paddingHorizontal: SIDE },
  pressed: { opacity: 0.7 },

  // Header — the tabs' calm glow with back, month, and title.
  header: { paddingBottom: 8 },
  glow: { position: "absolute", top: 0, left: -SIDE, right: -SIDE, height: 360 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  eyebrow: { fontSize: 10, fontWeight: "800", letterSpacing: 1.6, color: Colors.muted },
  title: {
    marginTop: 4,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: Colors.navy,
  },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: "600",
    color: Colors.navy,
  },
  clearBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },

  // Day groups
  day: { marginTop: 18 },
  dayLabel: {
    marginBottom: 8,
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Colors.muted,
  },
  card: {
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  rowCopy: { flex: 1, minWidth: 0 },
  merchant: { fontSize: 15, fontWeight: "700", color: Colors.navy },
  meta: { marginTop: 2, fontSize: 12, fontWeight: "500", color: Colors.muted },
  amount: {
    flexShrink: 0,
    marginLeft: 8,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.navy,
    fontVariant: ["tabular-nums"],
  },
  amountIncoming: { color: Colors.emerald },
  cents: { color: Colors.muted, fontWeight: "600" },
  centsIncoming: { color: `${Colors.emerald}B3`, fontWeight: "600" },
  // Hairlines start under the text, like grouped iOS lists.
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16 + 38 + 12,
    backgroundColor: Colors.border,
  },

  // States
  stateCard: { alignItems: "center", gap: 8, marginTop: 18, paddingVertical: 28, paddingHorizontal: 20 },
  stateTile: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    backgroundColor: Colors.navy50,
  },
  stateTitle: { fontSize: 16, fontWeight: "800", color: Colors.navy },
  stateText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    color: Colors.navyMuted,
    textAlign: "center",
  },
  dayLabelSkeleton: { width: 90, height: 10, marginBottom: 10, marginLeft: 4 },
  tileSkeleton: { width: 38, height: 38 },
  lineSkeleton: { width: "60%", height: 12 },
  lineSkeletonShort: { width: "35%", height: 10, marginTop: 8 },
  footerLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  footerText: { fontSize: 12, fontWeight: "600", color: Colors.navyMuted },
  endText: {
    paddingVertical: 22,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: Colors.muted,
  },
});
