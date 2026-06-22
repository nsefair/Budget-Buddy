import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CachedImage } from "@/components/CachedImage";
import { Icon } from "@/components/Icon";
import { Colors } from "@/constants/colors";
import type { FeedMedia } from "@/mock/buds";

interface PostMediaCarouselProps {
  media: FeedMedia[];
  headers?: Record<string, string>;
}

export const PostMediaCarousel = React.memo(function PostMediaCarousel({
  media,
  headers,
}: PostMediaCarouselProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const first = media[0];
  const aspectRatio = useMemo(() => {
    if (!first?.width || !first.height) return 1;
    return Math.max(0.8, Math.min(1.33, first.width / first.height));
  }, [first?.height, first?.width]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(Math.round(event.nativeEvent.layout.width));
  }, []);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!width) return;
      setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / width));
    },
    [width],
  );

  if (media.length === 0) return null;

  return (
    <View onLayout={handleLayout} style={[styles.frame, { aspectRatio }]}>
      {width > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          data={media}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={handleMomentumEnd}
          showsHorizontalScrollIndicator={false}
          removeClippedSubviews
          initialNumToRender={1}
          windowSize={3}
          renderItem={({ item, index }) => (
            <MediaSlide item={item} index={index} count={media.length} width={width} headers={headers} />
          )}
        />
      ) : null}

      {media.length > 1 ? (
        <>
          <View style={styles.counter}>
            <Text style={styles.counterText}>{activeIndex + 1} / {media.length}</Text>
          </View>
          <View style={styles.dots} pointerEvents="none">
            {media.map((item, index) => (
              <View key={item.id} style={[styles.dot, index === activeIndex && styles.dotActive]} />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
});

function MediaSlide({
  item,
  index,
  count,
  width,
  headers,
}: {
  item: FeedMedia;
  index: number;
  count: number;
  width: number;
  headers?: Record<string, string>;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const source = item.localAsset ?? { uri: item.url, headers };

  return (
    <View style={[styles.slide, { width }]}>
      {!loaded || failed ? (
        <View style={styles.placeholder}>
          <View style={styles.placeholderIcon}>
            <Icon name={failed ? "alert-circle" : "sparkles"} size={22} color={Colors.gold} />
          </View>
          <Text style={styles.placeholderTitle}>{failed ? "Photo unavailable" : "Bringing this win into focus"}</Text>
          {failed ? <Text style={styles.placeholderBody}>Pull to refresh and try again.</Text> : null}
        </View>
      ) : null}
      {!failed ? (
        <CachedImage
          accessibilityLabel={`Post photo ${index + 1} of ${count}`}
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={item.id}
          transition={180}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: "100%",
    minHeight: 260,
    maxHeight: 510,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: Colors.navy50,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slide: { height: "100%", backgroundColor: Colors.navy50 },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.navy50,
  },
  placeholderIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.accentAlpha12,
  },
  placeholderTitle: { fontSize: 13, fontWeight: "800", color: Colors.navy },
  placeholderBody: { fontSize: 12, color: Colors.muted },
  counter: {
    position: "absolute",
    right: 10,
    top: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  counterText: { color: Colors.white, fontSize: 11, fontWeight: "800" },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { width: 18, backgroundColor: Colors.gold },
});
