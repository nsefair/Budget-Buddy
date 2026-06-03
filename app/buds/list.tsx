import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Colors } from "@/constants/colors";
import { BrandHeader } from "@/components/BrandLogo";
import { Icon } from "@/components/Icon";
import type { BudProfile } from "@/mock/buds";
import { budsService } from "@/services/budsService";

type ListType = "following" | "followers";

export default function BudListScreen() {
  const insets = useSafeAreaInsets();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const listType: ListType = type === "followers" ? "followers" : "following";
  const [items, setItems] = useState<BudProfile[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const next =
          listType === "followers"
            ? await budsService.getFollowers()
            : await budsService.getFollowing();
        if (alive) setItems(next);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listType]);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return items;
    return items.filter((bud) => bud.displayName.toLowerCase().includes(value));
  }, [items, query]);

  const title = listType === "followers" ? "Followers" : "Following";
  const subtitle =
    listType === "followers"
      ? "People who keep up with your wins."
      : "Your Buds list, sorted by recent connection.";

  const toggleFollow = async (bud: BudProfile) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const nextIsFollowing = !bud.isFollowing;
    setItems((current) =>
      current.map((item) =>
        item.id === bud.id ? { ...item, isFollowing: nextIsFollowing } : item,
      ),
    );
    try {
      if (nextIsFollowing) {
        await budsService.follow(bud.id);
      } else {
        await budsService.unfollow(bud.id);
      }
    } catch {
      setItems((current) =>
        current.map((item) =>
          item.id === bud.id ? { ...item, isFollowing: bud.isFollowing } : item,
        ),
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.iconBtn}>
          <Icon name="arrow-left" size={18} color={Colors.navy} strokeWidth={2.4} />
        </Pressable>
        <BrandHeader style={styles.brandHeader} />
        <View style={styles.iconBtnGhost} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="users" size={20} color={Colors.accent} strokeWidth={2.5} />
          </View>
          <Text style={styles.eyebrow}>BUDS</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.searchWrap}>
          <Icon name="search" size={17} color={Colors.muted} strokeWidth={2.4} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search Buds"
            placeholderTextColor={Colors.muted}
            style={styles.searchInput}
          />
        </View>

        {loading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={Colors.accent} />
            <Text style={styles.loadingText}>Loading Buds...</Text>
          </View>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="sparkles" size={18} color={Colors.accent} strokeWidth={2.4} />
            <Text style={styles.emptyTitle}>No Buds here yet</Text>
            <Text style={styles.emptyBody}>
              Discover people building similar habits and your list will fill in.
            </Text>
            <Pressable
              style={styles.discoverBtn}
              onPress={() => {
                Haptics.selectionAsync();
                router.push("/(tabs)/buds");
              }}
            >
              <Text style={styles.discoverBtnText}>Find Buds</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.list}>
          {filtered.map((bud) => (
            <BudRow
              key={bud.id}
              bud={bud}
              showFollow={listType === "followers"}
              onFollow={() => toggleFollow(bud)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function BudRow({
  bud,
  showFollow,
  onFollow,
}: {
  bud: BudProfile;
  showFollow: boolean;
  onFollow: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => {
        Haptics.selectionAsync();
        router.push(`/buds/profile/${bud.id}`);
      }}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{bud.initials}</Text>
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowName}>{bud.displayName}</Text>
        <View style={styles.rowStats}>
          <Text style={styles.rowStat}>Lv {bud.level}</Text>
          <Text style={styles.dot}>.</Text>
          <Icon name="flame" size={11} color={Colors.accent} strokeWidth={2.4} />
          <Text style={styles.rowStat}>{bud.streak}d</Text>
          <Text style={styles.dot}>.</Text>
          <Text style={styles.rowStat}>{bud.leagueTier}</Text>
        </View>
      </View>
      {showFollow ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onFollow();
          }}
          style={[styles.followBtn, bud.isFollowing && styles.followBtnActive]}
        >
          <Text
            style={[
              styles.followBtnText,
              bud.isFollowing && styles.followBtnTextActive,
            ]}
          >
            {bud.isFollowing ? "Following" : "Follow"}
          </Text>
        </Pressable>
      ) : (
        <Icon name="chevron-right" size={17} color={Colors.muted} strokeWidth={2.4} />
      )}
    </Pressable>
  );
}

function goBack() {
  Haptics.selectionAsync();
  router.back();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  brandHeader: { marginBottom: 0 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },
  iconBtnGhost: { width: 38, height: 38 },
  scroll: { paddingHorizontal: 20, paddingTop: 8 },
  hero: { alignItems: "center", paddingVertical: 16 },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.greenSurface,
    borderWidth: 1,
    borderColor: Colors.greenBorder,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "900",
    color: Colors.accent,
    letterSpacing: 1.3,
    marginBottom: 7,
  },
  title: { fontSize: 25, fontWeight: "900", color: Colors.navy, letterSpacing: 0 },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 19,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: "700", color: Colors.navy },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 140,
    backgroundColor: Colors.card,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingText: { fontSize: 13, fontWeight: "700", color: Colors.navyMuted },
  emptyCard: {
    alignItems: "center",
    gap: 9,
    padding: 18,
    borderRadius: 17,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: { fontSize: 15, fontWeight: "900", color: Colors.navy },
  emptyBody: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.navyMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  discoverBtn: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  discoverBtnText: { fontSize: 13, fontWeight: "900", color: Colors.onAccent },
  list: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 74,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowPressed: { backgroundColor: Colors.navy50, transform: [{ scale: 0.99 }] },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
  },
  avatarText: { fontSize: 14, fontWeight: "900", color: Colors.navy },
  rowTextWrap: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 14, fontWeight: "900", color: Colors.navy },
  rowStats: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  rowStat: { fontSize: 11, fontWeight: "700", color: Colors.muted },
  dot: { fontSize: 10, fontWeight: "900", color: Colors.muted },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  followBtnActive: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accentAlpha40,
  },
  followBtnText: { fontSize: 12, fontWeight: "900", color: Colors.onAccent },
  followBtnTextActive: { color: Colors.accent },
});
