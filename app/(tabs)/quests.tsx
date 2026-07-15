import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientHeader } from "@/components/ui";
import { Colors } from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/tokens";
import { QuestHub } from "@/features/quests/QuestHub";

export default function QuestsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <GradientHeader
          eyebrow="QUESTS"
          title="Quests"
          subtitle="Three focused moves for this week."
        />

        <View style={styles.body}>
          <QuestHub />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  scroll: { flexGrow: 1, backgroundColor: Colors.surface },
  body: { paddingHorizontal: 18, paddingTop: 14 },
});
