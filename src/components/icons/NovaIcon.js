import React from 'react';
import Svg, { Circle, G, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

const glyphColor = {
  glow: '#00FFD1',
  cyan: '#58E7FF',
  emerald: '#36FF8F',
};

function Frame({ color, active }) {
  const opacity = active ? 0.72 : 0.38;
  return (
    <G stroke={color} strokeWidth={1.6} opacity={opacity} strokeLinecap="square" strokeLinejoin="miter">
      <Path d="M9 19V10H19" />
      <Path d="M45 10H55V20" />
      <Path d="M55 45V54H45" />
      <Path d="M19 54H9V44" />
      <Line x1="32" y1="5" x2="32" y2="11" />
      <Line x1="32" y1="53" x2="32" y2="59" />
      <Line x1="5" y1="32" x2="11" y2="32" />
      <Line x1="53" y1="32" x2="59" y2="32" />
    </G>
  );
}

function Glow({ children, active }) {
  return (
    <G opacity={active ? 0.28 : 0.1} stroke={glyphColor.glow} strokeWidth={5.4}>
      {children}
    </G>
  );
}

function DashboardGlyph({ color, secondary, emerald, detailOpacity, active }) {
  const core = (
    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="32" cy="32" r="9" />
      <Circle cx="32" cy="32" r="18" strokeDasharray="6 5" />
      <Path d="M32 14L48 42H16Z" />
      <Line x1="32" y1="19" x2="32" y2="45" />
      <Line x1="19" y1="39" x2="45" y2="25" />
      <Line x1="45" y1="39" x2="19" y2="25" />
    </G>
  );

  return (
    <>
      <Glow active={active}>{core}</Glow>
      <G stroke={color} strokeWidth={2.2}>{core}</G>
      <G stroke={secondary} strokeWidth={1.45} opacity={detailOpacity} fill="none" strokeLinecap="round">
        <Path d="M13 32C13 21.5 21.5 13 32 13" />
        <Path d="M51 32C51 42.5 42.5 51 32 51" />
        <Circle cx="32" cy="32" r="2.6" fill={emerald} stroke="none" />
        <Circle cx="17" cy="25" r="2.1" fill={secondary} stroke="none" />
        <Circle cx="47" cy="40" r="2.1" fill={secondary} stroke="none" />
      </G>
    </>
  );
}

function HouseholdGlyph({ color, secondary, emerald, detailOpacity, active }) {
  const core = (
    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M16 35L32 20L48 35" />
      <Path d="M21 33V47H43V33" />
      <Path d="M26 47V38H38V47" />
      <Polygon points="32,11 51,22 51,43 32,54 13,43 13,22" />
      <Line x1="16" y1="24" x2="9" y2="19" />
      <Line x1="48" y1="24" x2="55" y2="19" />
      <Line x1="16" y1="43" x2="9" y2="48" />
      <Line x1="48" y1="43" x2="55" y2="48" />
    </G>
  );

  return (
    <>
      <Glow active={active}>{core}</Glow>
      <G stroke={color} strokeWidth={2.2}>{core}</G>
      <G opacity={detailOpacity}>
        <Circle cx="9" cy="19" r="2.2" fill={secondary} />
        <Circle cx="55" cy="19" r="2.2" fill={secondary} />
        <Circle cx="9" cy="48" r="2.2" fill={emerald} />
        <Circle cx="55" cy="48" r="2.2" fill={emerald} />
        <Path d="M24 28H40" stroke={secondary} strokeWidth={1.3} strokeLinecap="round" />
      </G>
    </>
  );
}

function PersonalGlyph({ color, secondary, emerald, detailOpacity, active }) {
  const core = (
    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="32,9 45,24 39,48 32,55 25,48 19,24" />
      <Path d="M32 17V47" />
      <Path d="M23 27H41" />
      <Path d="M25 46L32 36L39 46" />
      <Circle cx="32" cy="27" r="5" />
    </G>
  );

  return (
    <>
      <Glow active={active}>{core}</Glow>
      <G stroke={color} strokeWidth={2.2}>{core}</G>
      <G stroke={secondary} strokeWidth={1.45} opacity={detailOpacity} fill="none" strokeLinecap="round">
        <Path d="M15 33C19 19 45 19 49 33" />
        <Path d="M19 43C25 51 39 51 45 43" />
        <Circle cx="32" cy="27" r="2.1" fill={emerald} stroke="none" />
        <Line x1="32" y1="5" x2="32" y2="10" />
        <Line x1="32" y1="55" x2="32" y2="60" />
      </G>
    </>
  );
}

function BusinessGlyph({ color, secondary, emerald, detailOpacity, active }) {
  const core = (
    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="19" y="15" width="26" height="34" />
      <Path d="M24 22H40" />
      <Path d="M24 30H40" />
      <Path d="M24 38H40" />
      <Path d="M28 49V42H36V49" />
      <Line x1="19" y1="25" x2="10" y2="20" />
      <Line x1="45" y1="25" x2="54" y2="20" />
      <Line x1="19" y1="42" x2="10" y2="47" />
      <Line x1="45" y1="42" x2="54" y2="47" />
    </G>
  );

  return (
    <>
      <Glow active={active}>{core}</Glow>
      <G stroke={color} strokeWidth={2.2}>{core}</G>
      <G opacity={detailOpacity}>
        <Circle cx="10" cy="20" r="2.3" fill={secondary} />
        <Circle cx="54" cy="20" r="2.3" fill={secondary} />
        <Circle cx="10" cy="47" r="2.3" fill={emerald} />
        <Circle cx="54" cy="47" r="2.3" fill={emerald} />
        <Polyline points="24,30 29,25 35,35 40,30" stroke={secondary} strokeWidth={1.35} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </>
  );
}

function SettingsGlyph({ color, secondary, emerald, detailOpacity, active }) {
  const core = (
    <G fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="32" cy="32" r="8" />
      <Circle cx="32" cy="32" r="19" strokeDasharray="5 4" />
      <Polygon points="32,13 41,18 51,17 46,27 49,36 39,39 32,51 25,39 15,36 18,27 13,17 23,18" />
      <Line x1="32" y1="13" x2="32" y2="24" />
      <Line x1="47" y1="23" x2="38" y2="29" />
      <Line x1="47" y1="41" x2="38" y2="35" />
      <Line x1="32" y1="51" x2="32" y2="40" />
      <Line x1="17" y1="41" x2="26" y2="35" />
      <Line x1="17" y1="23" x2="26" y2="29" />
    </G>
  );

  return (
    <>
      <Glow active={active}>{core}</Glow>
      <G stroke={color} strokeWidth={2.2}>{core}</G>
      <G stroke={secondary} strokeWidth={1.45} opacity={detailOpacity} fill="none" strokeLinecap="round">
        <Path d="M21 10L17 6" />
        <Path d="M43 10L47 6" />
        <Path d="M21 54L17 58" />
        <Path d="M43 54L47 58" />
        <Circle cx="32" cy="32" r="2.5" fill={emerald} stroke="none" />
      </G>
    </>
  );
}

const glyphs = {
  dashboard: DashboardGlyph,
  household: HouseholdGlyph,
  personal: PersonalGlyph,
  business: BusinessGlyph,
  settings: SettingsGlyph,
};

export default function NovaIcon({ name, size = 28, color = glyphColor.glow, focused = false }) {
  const Glyph = glyphs[name] || DashboardGlyph;
  const secondary = focused ? glyphColor.cyan : color;
  const emerald = focused ? glyphColor.emerald : color;
  const detailOpacity = focused ? 0.85 : 0.46;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Frame color={color} active={focused} />
      <Glyph
        color={color}
        secondary={secondary}
        emerald={emerald}
        detailOpacity={detailOpacity}
        active={focused}
      />
    </Svg>
  );
}
