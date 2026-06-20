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
import * as Haptics from "expo-haptics";

import { BrandHeader } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import type { Transaction } from "@/mock/budget";
import { budgetService } from "@/services/budgetService";
import { formatCurrency, secureLog } from "@/utils/security";

const PAGE_SIZE = 30;

function TransactionDivider() {
  return <View style={styles.divider} />;
}

const CATEGORY_EMOJI: Record<string, string> = {
  food: "🍔",
  transport: "🚗",
  shopping: "🛍️",
  housing: "🏠",
  entertainment: "🎬",
  health: "💊",
  personal: "✂️",
  education: "📚",
  debt: "💳",
};

function emojiForCategory(value: string) {
  const normalized = value.toLowerCase();
  return CATEGORY_EMOJI[normalized] ?? "💸";
}

function labelForMonth(month?: string) {
  if (!month) return "All transactions";
  const parsed = new Date(`${month}-01T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Transactions";
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ month?: string | string[] }>();
  const month = Array.isArray(params.month) ? params.month[0] : params.month;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadFirstPage = useCallback(async () => {
    const next = await budgetService.getTransactions({
      month,
      page: 1,
      limit: PAGE_SIZE,
    });
    setTransactions(next);
    setPage(1);
    setHasMore(next.length === PAGE_SIZE);
  }, [month]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    budgetService
      .getTransactions({ month, page: 1, limit: PAGE_SIZE })
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
  }, [month]);

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

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to budget"
          onPress={() => {
            Haptics.selectionAsync();
            router.back();
          }}
          hitSlop={10}
          style={styles.iconButton}
        >
          <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
        <BrandHeader style={styles.brandHeader} />
        <View style={styles.iconButtonGhost} />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(transaction) => transaction.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
          !loading && filtered.length === 0 ? styles.emptyListContent : null,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={Colors.gold}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        ItemSeparatorComponent={TransactionDivider}
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>MONEY ACTIVITY</Text>
              <Text style={styles.title}>All transactions</Text>
              <Text style={styles.subtitle}>
                {labelForMonth(month)} · {transactions.length} loaded
              </Text>
            </View>
            <View style={styles.searchWrap}>
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
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={Colors.gold} />
              <Text style={styles.stateText}>Loading transactions...</Text>
            </View>
          ) : (
            <View style={styles.stateCard}>
              <Icon name="receipt" size={20} color={Colors.gold} strokeWidth={2.4} />
              <Text style={styles.emptyTitle}>
                {query.trim() ? "No matching transactions" : "No transactions yet"}
              </Text>
              <Text style={styles.stateText}>
                {query.trim()
                  ? "Try another merchant or category."
                  : "Transactions will appear after the next bank sync."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={Colors.gold} />
              <Text style={styles.footerText}>Loading more...</Text>
            </View>
          ) : !hasMore && transactions.length > 0 && !query.trim() ? (
            <Text style={styles.endText}>You reached the end of this month.</Text>
          ) : null
        }
        renderItem={({ item }) => <TransactionHistoryRow transaction={item} />}
      />
    </View>
  );
}

function TransactionHistoryRow({ transaction }: { transaction: Transaction }) {
  const date = new Date(`${transaction.date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowEmoji}>{emojiForCategory(transaction.categoryId)}</Text>
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowMerchant} numberOfLines={1}>
          {transaction.merchant}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {transaction.category} · {date}
          {transaction.isRecurring ? " · Recurring" : ""}
        </Text>
      </View>
      <Text style={styles.rowAmount}>
        {formatCurrency(-transaction.amount, { sign: true })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  brandHeader: { marginBottom: 0 },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: Colors.navy50,
  },
  iconButtonGhost: { width: 38, height: 38 },
  listContent: { paddingHorizontal: 18 },
  emptyListContent: { flexGrow: 1 },
  hero: { paddingTop: 16, paddingBottom: 18 },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.gold,
    letterSpacing: 1.4,
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "900",
    color: Colors.navy,
    letterSpacing: -0.3,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: Colors.navyMuted,
  },
  searchWrap: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "700",
    color: Colors.navy,
  },
  row: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: Colors.navy50,
  },
  rowEmoji: { fontSize: 18, lineHeight: 22 },
  rowCopy: { flex: 1 },
  rowMerchant: { fontSize: 14, fontWeight: "800", color: Colors.navy },
  rowMeta: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "600",
    color: Colors.muted,
  },
  rowAmount: { fontSize: 14, fontWeight: "800", color: Colors.navy },
  divider: { height: 1, backgroundColor: Colors.border },
  stateCard: {
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    padding: 20,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", color: Colors.navy },
  stateText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  footerLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 20,
  },
  footerText: { fontSize: 11, fontWeight: "700", color: Colors.navyMuted },
  endText: {
    paddingVertical: 20,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "700",
    color: Colors.muted,
  },
});
