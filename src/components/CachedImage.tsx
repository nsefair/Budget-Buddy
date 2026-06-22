import React from "react";
import {
  Image as NativeImage,
  type ImageProps as NativeImageProps,
  type ImageResizeMode,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
} from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

type ContentFit = "cover" | "contain" | "fill" | "none" | "scale-down";

interface CachedImageProps {
  source: ImageSourcePropType | { uri: string; headers?: Record<string, string> };
  style?: StyleProp<ImageStyle>;
  contentFit?: ContentFit;
  cachePolicy?: "none" | "disk" | "memory" | "memory-disk";
  recyclingKey?: string;
  transition?: number;
  accessibilityLabel?: string;
  onLoad?: NativeImageProps["onLoad"];
  onError?: NativeImageProps["onError"];
}

type ExpoImageProps = CachedImageProps;
type ExpoImageComponent = React.ComponentType<ExpoImageProps>;

let ExpoImage: ExpoImageComponent | undefined;

// Development clients can remain installed while JavaScript changes. Keep the
// feed usable when one predates ExpoImage, then regain disk caching as soon as
// a current native build is installed.
if (requireOptionalNativeModule("ExpoImage")) {
  try {
    ExpoImage = require("expo-image").Image as ExpoImageComponent;
  } catch {
    ExpoImage = undefined;
  }
}

export function CachedImage({
  source,
  style,
  contentFit = "cover",
  cachePolicy = "memory-disk",
  recyclingKey,
  transition = 150,
  ...nativeProps
}: CachedImageProps) {
  if (ExpoImage) {
    return (
      <ExpoImage
        source={source}
        style={style}
        contentFit={contentFit}
        cachePolicy={cachePolicy}
        recyclingKey={recyclingKey}
        transition={transition}
        {...nativeProps}
      />
    );
  }

  return (
    <NativeImage
      source={source}
      style={style}
      resizeMode={nativeResizeMode(contentFit)}
      {...nativeProps}
    />
  );
}

function nativeResizeMode(contentFit: ContentFit): ImageResizeMode {
  switch (contentFit) {
    case "fill":
      return "stretch";
    case "none":
      return "center";
    case "scale-down":
      return "contain";
    default:
      return contentFit;
  }
}
