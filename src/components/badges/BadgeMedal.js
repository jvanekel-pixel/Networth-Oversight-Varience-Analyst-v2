import React from 'react';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  Rect,
  Stop,
} from 'react-native-svg';

export const BADGE_TIER_STYLES = {
  locked: {
    label: 'Locked',
    shell: '#141821',
    inner: '#05070D',
    trim: '#1C6B72',
    trim2: '#2F3D4C',
    accent: '#2B7781',
    secondary: '#1A3A44',
    glowOpacity: 0.04,
    iconOpacity: 0.16,
  },
  bronze: {
    label: 'Bronze',
    shell: '#7A4B2D',
    inner: '#17100C',
    trim: '#B8753E',
    trim2: '#F0A35A',
    accent: '#FFB15D',
    secondary: '#00FFD1',
    glowOpacity: 0.18,
    iconOpacity: 0.92,
  },
  silver: {
    label: 'Silver',
    shell: '#8E99A6',
    inner: '#101720',
    trim: '#D7E4F2',
    trim2: '#6BA9C7',
    accent: '#8EEBFF',
    secondary: '#00FFD1',
    glowOpacity: 0.22,
    iconOpacity: 0.96,
  },
  gold: {
    label: 'Gold',
    shell: '#A77922',
    inner: '#1B1508',
    trim: '#FFD76A',
    trim2: '#FFF2B3',
    accent: '#FFE39A',
    secondary: '#00FFD1',
    glowOpacity: 0.26,
    iconOpacity: 1,
  },
  platinum: {
    label: 'Platinum',
    shell: '#263747',
    inner: '#070D16',
    trim: '#F4FBFF',
    trim2: '#72BFFF',
    accent: '#DFF8FF',
    secondary: '#58E7FF',
    glowOpacity: 0.32,
    iconOpacity: 1,
  },
  onyx: {
    label: 'Onyx',
    shell: '#050509',
    inner: '#020207',
    trim: '#00FFD1',
    trim2: '#B36CFF',
    accent: '#00FFD1',
    secondary: '#B36CFF',
    glowOpacity: 0.42,
    iconOpacity: 1,
  },
};

const HEX = '32,4 56,18 56,46 32,60 8,46 8,18';
const INNER_HEX = '32,10 50,21 50,43 32,54 14,43 14,21';
const RING_CIRCUMFERENCE = 2 * Math.PI * 30;

function PaydayOracleIcon(props) {
  return (
    <G {...props}>
      <Circle cx="32" cy="32" r="17" />
      <Circle cx="32" cy="32" r="10" strokeDasharray="4 4" />
      <Line x1="32" y1="17" x2="32" y2="47" />
      <Path d="M22 35C27 30 37 30 42 35" />
      <Path d="M18 26L32 32L47 20" />
      <Circle cx="32" cy="32" r="3" />
    </G>
  );
}

function VaultGuardianIcon(props) {
  return (
    <G {...props}>
      <Path d="M32 15L45 21V32C45 41 39 47 32 50C25 47 19 41 19 32V21Z" />
      <Path d="M25 32L32 24L39 32" />
      <Path d="M25 39H39" />
      <Circle cx="32" cy="34" r="6" />
      <Line x1="24" y1="45" x2="24" y2="39" />
      <Line x1="32" y1="47" x2="32" y2="40" />
      <Line x1="40" y1="45" x2="40" y2="39" />
    </G>
  );
}

function BillSlayerIcon(props) {
  return (
    <G {...props}>
      <Path d="M22 15H40L44 20V48H20V15Z" />
      <Path d="M40 15V21H44" />
      <Line x1="24" y1="27" x2="40" y2="27" />
      <Line x1="24" y1="34" x2="38" y2="34" />
      <Path d="M17 46L47 18" />
      <Path d="M24 41L29 46L42 32" />
    </G>
  );
}

function GrocerySentinelIcon(props) {
  return (
    <G {...props}>
      <Circle cx="32" cy="32" r="19" />
      <Path d="M16 32C20 24 26 21 32 21C38 21 44 24 48 32C44 40 38 43 32 43C26 43 20 40 16 32Z" />
      <Circle cx="32" cy="32" r="6" />
      <Line x1="32" y1="13" x2="32" y2="18" />
      <Line x1="32" y1="46" x2="32" y2="51" />
      <Line x1="13" y1="32" x2="18" y2="32" />
      <Line x1="46" y1="32" x2="51" y2="32" />
    </G>
  );
}

function LedgerKeeperIcon(props) {
  return (
    <G {...props}>
      <Circle cx="32" cy="32" r="18" />
      <Polygon points="32,14 39,32 32,50 25,32" />
      <Line x1="16" y1="32" x2="48" y2="32" />
      <Line x1="32" y1="16" x2="32" y2="48" />
      <Circle cx="32" cy="32" r="4" />
      <Path d="M22 22L42 42" />
    </G>
  );
}

function CycleCloserIcon(props) {
  return (
    <G {...props}>
      <Path d="M19 24C23 17 32 14 40 18" />
      <Path d="M40 18L39 27L47 23" />
      <Path d="M45 40C41 47 32 50 24 46" />
      <Path d="M24 46L25 37L17 41" />
      <Circle cx="32" cy="32" r="8" />
      <Line x1="26" y1="32" x2="38" y2="32" />
    </G>
  );
}

function IncomeArchitectIcon(props) {
  return (
    <G {...props}>
      <Circle cx="32" cy="17" r="4" />
      <Circle cx="20" cy="44" r="4" />
      <Circle cx="32" cy="47" r="4" />
      <Circle cx="44" cy="44" r="4" />
      <Path d="M32 21V31" />
      <Path d="M32 31L20 40" />
      <Path d="M32 31V43" />
      <Path d="M32 31L44 40" />
      <Path d="M20 27H44" strokeDasharray="3 4" />
    </G>
  );
}

function VarianceAnalystIcon(props) {
  return (
    <G {...props}>
      <Polyline points="15,40 22,31 28,36 35,23 42,31 49,22" />
      <Path d="M16 48H48" />
      <Path d="M18 18V48" />
      <Path d="M37 23L49 22L47 34" />
      <Line x1="23" y1="20" x2="46" y2="20" strokeDasharray="4 4" />
      <Line x1="23" y1="32" x2="46" y2="32" strokeDasharray="4 4" />
    </G>
  );
}

function EntrepreneurIcon(props) {
  return (
    <G {...props}>
      <Rect x="18" y="18" width="11" height="11" />
      <Rect x="35" y="18" width="11" height="11" />
      <Rect x="18" y="35" width="11" height="11" />
      <Rect x="35" y="35" width="11" height="11" />
      <Line x1="29" y1="23.5" x2="35" y2="23.5" />
      <Line x1="23.5" y1="29" x2="23.5" y2="35" />
      <Line x1="40.5" y1="29" x2="40.5" y2="35" />
      <Line x1="29" y1="40.5" x2="35" y2="40.5" />
      <Circle cx="32" cy="32" r="3" />
    </G>
  );
}

function NovaAgentIcon(props) {
  return (
    <G {...props}>
      <Circle cx="32" cy="32" r="18" />
      <Circle cx="32" cy="32" r="9" strokeDasharray="5 4" />
      <Polygon points="32,13 37,27 52,27 40,36 45,50 32,41 19,50 24,36 12,27 27,27" />
      <Line x1="32" y1="8" x2="32" y2="14" />
      <Line x1="32" y1="50" x2="32" y2="56" />
      <Line x1="8" y1="32" x2="14" y2="32" />
      <Line x1="50" y1="32" x2="56" y2="32" />
    </G>
  );
}

const ICONS = {
  payday_oracle: PaydayOracleIcon,
  vault_guardian: VaultGuardianIcon,
  bill_slayer: BillSlayerIcon,
  grocery_sentinel: GrocerySentinelIcon,
  ledger_keeper: LedgerKeeperIcon,
  cycle_closer: CycleCloserIcon,
  income_architect: IncomeArchitectIcon,
  variance_analyst: VarianceAnalystIcon,
  entrepreneur: EntrepreneurIcon,
  nova_agent: NovaAgentIcon,
};

function LockGlyph({ color }) {
  return (
    <G fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="25" y="31" width="14" height="12" rx="2" />
      <Path d="M28 31V27C28 24 30 22 32 22C35 22 36 24 36 27V31" />
      <Line x1="32" y1="36" x2="32" y2="39" />
    </G>
  );
}

export default function BadgeMedal({
  badgeId,
  tier = null,
  size = 72,
  progress = 0,
  completed = false,
  showLock = true,
}) {
  const palette = BADGE_TIER_STYLES[tier || 'locked'] || BADGE_TIER_STYLES.locked;
  const Icon = ICONS[badgeId] || NovaAgentIcon;
  const clampedProgress = Math.max(0, Math.min(1, progress || 0));
  const dash = `${RING_CIRCUMFERENCE * clampedProgress} ${RING_CIRCUMFERENCE}`;
  const gradId = `badgeGrad_${badgeId}_${tier || 'locked'}`;

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id={gradId} x1="10" y1="8" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={palette.trim2} stopOpacity="0.95" />
          <Stop offset="0.45" stopColor={palette.shell} stopOpacity="0.9" />
          <Stop offset="1" stopColor={palette.trim} stopOpacity="0.95" />
        </LinearGradient>
      </Defs>

      <Circle cx="32" cy="32" r="30" stroke={palette.accent} strokeWidth={completed ? 2.8 : 2} opacity={palette.glowOpacity} />
      <Circle
        cx="32"
        cy="32"
        r="30"
        stroke={palette.accent}
        strokeWidth={2.2}
        strokeDasharray={dash}
        strokeLinecap="round"
        opacity={tier ? 0.75 : 0.2}
        transform="rotate(-90 32 32)"
      />

      <Polygon points={HEX} fill={`url(#${gradId})`} stroke={palette.trim} strokeWidth="1.6" />
      <Polygon points="32,7 53,20 53,44 32,57 11,44 11,20" fill="none" stroke={palette.trim2} strokeWidth="0.9" opacity={tier ? 0.72 : 0.28} />
      <Polygon points={INNER_HEX} fill={palette.inner} stroke={palette.accent} strokeWidth="0.9" opacity={tier ? 0.92 : 0.72} />

      <G stroke={palette.secondary} strokeWidth="1" opacity={tier ? 0.62 : 0.2} strokeLinecap="round">
        <Line x1="18" y1="21" x2="27" y2="16" />
        <Line x1="37" y1="16" x2="46" y2="21" />
        <Line x1="46" y1="43" x2="37" y2="48" />
        <Line x1="27" y1="48" x2="18" y2="43" />
      </G>

      <G
        fill="none"
        stroke={palette.accent}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={palette.iconOpacity}
      >
        <Icon />
      </G>

      {!tier && showLock ? <LockGlyph color={palette.accent} /> : null}
    </Svg>
  );
}
