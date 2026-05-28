/**
 * Stagger — wraps children in FadeInUp with auto-increasing delays.
 *
 * Drop in around any list/section and rows appear in cascade:
 *
 *   <Stagger gap={70}>
 *     <Card>…</Card>
 *     <Card>…</Card>
 *     <Card>…</Card>
 *   </Stagger>
 *
 * Children that are not real elements are passed through unchanged.
 */

import React from "react";
import { StyleProp, ViewStyle } from "react-native";

import { FadeInUp } from "@/animations/FadeInUp";

interface StaggerProps {
  /** Delay (ms) added per child. Defaults to 70. */
  gap?: number;
  /** Initial delay before the first child animates. */
  initialDelay?: number;
  /** Distance the children rise from. */
  distance?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Stagger({
  gap = 70,
  initialDelay = 0,
  distance,
  children,
}: StaggerProps) {
  let index = 0;
  return (
    <>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const delay = initialDelay + index * gap;
        index += 1;
        return (
          <FadeInUp key={child.key ?? index} delay={delay} distance={distance}>
            {child}
          </FadeInUp>
        );
      })}
    </>
  );
}
