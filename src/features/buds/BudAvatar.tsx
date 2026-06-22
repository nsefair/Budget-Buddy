import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { CachedImage } from "@/components/CachedImage";
import { Colors } from "@/constants/colors";

interface BudAvatarProps {
  name: string;
  initials: string;
  avatar?: string;
  avatarAsset?: number;
  size?: number;
  activeRing?: boolean;
}

export const BudAvatar = React.memo(function BudAvatar({
  name,
  initials,
  avatar,
  avatarAsset,
  size = 44,
  activeRing = false,
}: BudAvatarProps) {
  const source = avatarAsset ?? (avatar ? { uri: avatar } : undefined);
  const radius = size / 2;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${name} profile photo`}
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderColor: activeRing ? Colors.gold : Colors.border,
        },
      ]}
    >
      {source ? (
        <CachedImage
          source={source}
          style={[styles.image, { borderRadius: radius - 3 }]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={160}
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.max(11, size * 0.3) }]}>
          {initials}
        </Text>
      )}
      {activeRing ? <View style={styles.activeDot} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  shell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.navy50,
    borderWidth: 2,
    padding: 2,
  },
  image: { width: "100%", height: "100%" },
  initials: { color: Colors.navy, fontWeight: "800" },
  activeDot: {
    position: "absolute",
    right: -1,
    bottom: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.gold,
    borderWidth: 2,
    borderColor: Colors.card,
  },
});
