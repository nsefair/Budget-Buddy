/**
 * Custom Tab Bar
 *
 * Uses React Native's built-in Animated API so it works in Expo Go.
 * When you move to a dev build, you can swap to react-native-reanimated
 * for spring physics — the logic is identical, just different import names.
 *
 * ANIMATION PATTERN:
 *   Animated.Value  ←→  useSharedValue
 *   Animated.spring ←→  withSpring
 *   Animated.timing ←→  withTiming
 *   animStyle obj   ←→  useAnimatedStyle
 */

import React, { useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
} from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors } from "@/constants/colors";
import {
  TodayIcon,
  BudgetIcon,
  BudIcon,
  GoalsIcon,
  BudsIcon,
} from "@/components/TabIcons";

// ─── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<
  string,
  {
    label: string;
    Icon: React.ComponentType<{ color: string; size?: number; filled?: boolean }>;
  }
> = {
  today: { label: "Today", Icon: TodayIcon },
  budget: { label: "Budget", Icon: BudgetIcon },
  bud: { label: "Bud", Icon: BudIcon },
  goals: { label: "Goals", Icon: GoalsIcon },
  buds: { label: "Buds", Icon: BudsIcon },
};

// ─── Single Tab Item ──────────────────────────────────────────────────────────
interface TabItemProps {
  routeName: string;
  label: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  isBudTab?: boolean;
}

function TabItem({ routeName, label, isFocused, onPress, onLongPress, isBudTab }: TabItemProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const dotScale = useRef(new Animated.Value(isFocused ? 1 : 0)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0.45)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isFocused ? 1.05 : 1,
        damping: 14,
        stiffness: 220,
        useNativeDriver: true,
      }),
      Animated.spring(dotScale, {
        toValue: isFocused ? 1 : 0,
        damping: 15,
        stiffness: 300,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        toValue: isFocused ? 1 : 0.45,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: isFocused ? -2 : 0,
        damping: 12,
        stiffness: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused]);

  const config = ICON_MAP[routeName] ?? ICON_MAP["today"];
  const { Icon } = config;
  const iconColor = isFocused ? Colors.gold : Colors.tabBarInactive;

  // ── Center Bud tab ────────────────────────────────────────────────────────
  if (isBudTab) {
    return (
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.budWrapper}
        activeOpacity={0.85}
      >
        <Animated.View style={[styles.budContainer, { transform: [{ scale }] }]}>
          <View style={[styles.budButton, isFocused && styles.budButtonActive]}>
            <Icon
              color={isFocused ? Colors.navy : Colors.tabBarInactive}
              size={24}
              filled={isFocused}
            />
          </View>
          <Animated.Text style={[styles.tabLabel, { color: iconColor, opacity: labelOpacity }]}>
            {config.label}
          </Animated.Text>
        </Animated.View>
      </TouchableOpacity>
    );
  }

  // ── Regular tab ───────────────────────────────────────────────────────────
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabItem}
      activeOpacity={0.7}
    >
      <Animated.View style={[styles.tabItemInner, { transform: [{ scale }] }]}>
        <Animated.View style={{ transform: [{ translateY }] }}>
          <Icon color={iconColor} size={22} filled={isFocused} />
        </Animated.View>
        <Animated.Text style={[styles.tabLabel, { color: iconColor, opacity: labelOpacity }]}>
          {label}
        </Animated.Text>
        <Animated.View
          style={[styles.activeDot, { transform: [{ scale: dotScale }], opacity: dotScale }]}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Main Tab Bar ─────────────────────────────────────────────────────────────
export function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={85} tint="dark" style={StyleSheet.absoluteFillObject} />
      ) : (
        <View style={[StyleSheet.absoluteFillObject, styles.androidBg]} />
      )}
      <View style={styles.topBorder} />

      <View style={styles.tabRow}>
        {state.routes.map((route: { key: string; name: string }, index: number) => {
          const { options } = descriptors[route.key];
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : options.title ?? route.name;
          const isFocused = state.index === index;
          const isBudTab = route.name === "bud";

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabItem
              key={route.key}
              routeName={route.name}
              label={label}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
              isBudTab={isBudTab}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  androidBg: {
    backgroundColor: Colors.tabBarBackground,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  topBorder: {
    height: 1,
    backgroundColor: Colors.accentAlpha22,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 6,
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  tabItemInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    minWidth: 54,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.15,
    marginTop: 1,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
    marginTop: 3,
  },
  budWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  budContainer: {
    alignItems: "center",
    gap: 4,
  },
  budButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.accentAlpha10,
    borderWidth: 1.5,
    borderColor: Colors.accentAlpha35,
    alignItems: "center",
    justifyContent: "center",
  },
  budButtonActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
});
