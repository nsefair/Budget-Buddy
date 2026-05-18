import React from "react";
import Svg, { Path, Circle, Rect } from "react-native-svg";
import { Colors } from "@/constants/colors";

interface IconProps {
  color: string;
  size?: number;
  filled?: boolean;
}

export function TodayIcon({ color, size = 24, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"
        stroke={color}
        strokeWidth={filled ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : "none"}
        opacity={filled ? 1 : 0.9}
      />
      {filled && (
        <Path
          d="M9 22V12h6v10"
          stroke={Colors.onAccent}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
      {!filled && (
        <Path
          d="M9 22V12h6v10"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
        />
      )}
    </Svg>
  );
}

export function BudgetIcon({ color, size = 24, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="2"
        y="3"
        width="20"
        height="18"
        rx="3"
        stroke={color}
        strokeWidth={filled ? 0 : 2}
        fill={filled ? color : "none"}
      />
      <Path
        d="M8 10h8M8 14h5"
        stroke={filled ? Colors.onAccent : color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="18" cy="14" r="1.5" fill={filled ? Colors.onAccent : color} />
    </Svg>
  );
}

export function BudIcon({ color, size = 24, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"
        stroke={color}
        strokeWidth={filled ? 0 : 2}
        fill={filled ? color : "none"}
      />
      <Path
        d="M8 14s1.5 2 4 2 4-2 4-2"
        stroke={filled ? Colors.onAccent : color}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx="9" cy="10" r="1.2" fill={filled ? Colors.onAccent : color} />
      <Circle cx="15" cy="10" r="1.2" fill={filled ? Colors.onAccent : color} />
    </Svg>
  );
}

export function GoalsIcon({ color, size = 24, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth={filled ? 0 : 2}
        fill={filled ? color : "none"}
      />
      <Circle
        cx="12"
        cy="12"
        r="5"
        stroke={filled ? Colors.onAccent : color}
        strokeWidth={2}
        fill="none"
      />
      <Circle
        cx="12"
        cy="12"
        r="1.6"
        fill={filled ? Colors.onAccent : color}
      />
    </Svg>
  );
}

export function BudsIcon({ color, size = 24, filled }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx="9"
        cy="8"
        r="3.5"
        stroke={color}
        strokeWidth={filled ? 0 : 2}
        fill={filled ? color : "none"}
      />
      <Circle
        cx="16"
        cy="7"
        r="2.5"
        stroke={color}
        strokeWidth={filled ? 0 : 1.5}
        fill={filled ? color : "none"}
        opacity={0.7}
      />
      <Path
        d="M2 20c0-3.31 3.13-6 7-6s7 2.69 7 6"
        stroke={color}
        strokeWidth={filled ? 0 : 2}
        strokeLinecap="round"
        fill={filled ? color : "none"}
      />
      <Path
        d="M19 13c2.21 0 4 1.79 4 4"
        stroke={color}
        strokeWidth={filled ? 0 : 1.5}
        strokeLinecap="round"
        fill={filled ? color : "none"}
        opacity={0.7}
      />
    </Svg>
  );
}
