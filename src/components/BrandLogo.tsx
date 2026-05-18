import React from "react";
import {
  Image,
  ImageSourcePropType,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

import { ACTIVE_BRAND_PALETTE, Colors } from "@/constants/colors";

const BRAND_MARK_SOURCES = {
  orange: require("../../assets/brand/budget-buddy-mark-orange.png"),
  green: require("../../assets/brand/budget-buddy-mark-green.png"),
} satisfies Record<typeof ACTIVE_BRAND_PALETTE, ImageSourcePropType>;

export const BRAND_MARK_SOURCE = BRAND_MARK_SOURCES[ACTIVE_BRAND_PALETTE];

type BrandLogoVariant = "mark" | "lockup";
type BrandLogoDirection = "row" | "column";

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  direction?: BrandLogoDirection;
  markSize?: number;
  textColor?: string;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  markStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export function BrandLogo({
  variant = "lockup",
  direction = "row",
  markSize = 28,
  textColor = Colors.navy,
  muted = false,
  style,
  markStyle,
  textStyle,
}: BrandLogoProps) {
  const showText = variant === "lockup";

  return (
    <View
      style={[
        styles.logo,
        direction === "column" ? styles.column : styles.row,
        style,
      ]}
    >
      <Image
        source={BRAND_MARK_SOURCE}
        resizeMode="contain"
        style={[
          styles.mark,
          {
            width: markSize,
            height: markSize,
            opacity: muted ? 0.88 : 1,
          },
          markStyle,
        ]}
      />
      {showText && (
        <Text
          style={[
            styles.wordmark,
            {
              color: textColor,
              fontSize: direction === "column" ? 15 : 13,
            },
            textStyle,
          ]}
        >
          Budget Buddy
        </Text>
      )}
    </View>
  );
}

interface BrandHeaderProps {
  dark?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function BrandHeader({ dark, style }: BrandHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <BrandLogo
        markSize={24}
        textColor={dark ? Colors.brandOnDarkMuted : Colors.navy}
        textStyle={dark ? styles.darkHeaderText : styles.lightHeaderText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", gap: 8 },
  column: { gap: 10 },
  mark: {
    shadowColor: Colors.teal,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  wordmark: {
    fontWeight: "800",
    letterSpacing: 0,
  },
  header: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  darkHeaderText: {
    fontWeight: "800",
  },
  lightHeaderText: {
    fontWeight: "800",
  },
});
