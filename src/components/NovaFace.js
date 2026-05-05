import React from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import theme from '../config/theme.config';

const BASE_FACE = '#020712';
const DIM_STROKE = '#00FFD1';

const BASE_NOVA_FACE_VARIANTS = {
  neutral: {
    accent: theme.faceColor,
    glow: 0.16,
    eye: 'calm',
    eyeY: 54,
    mouth: 'M 45 75 Q 60 81 75 75',
    browLeft: 'M 36 43 Q 44 40 52 43',
    browRight: 'M 68 43 Q 76 40 84 43',
    glyph: 'standby',
    scan: 0.55,
  },
  green_smug: {
    accent: theme.statusPositive,
    glow: 0.2,
    eye: 'smug',
    eyeY: 54,
    mouth: 'M 43 74 Q 60 84 77 74',
    browLeft: 'M 36 43 Q 44 41 52 43',
    browRight: 'M 68 43 Q 76 41 84 43',
    glyph: 'stable',
    scan: 0.7,
  },
  yellow_calculating: {
    accent: theme.statusWarning,
    glow: 0.18,
    eye: 'narrow',
    eyeY: 54,
    mouth: 'M 47 77 L 73 77',
    browLeft: 'M 35 40 L 53 45',
    browRight: 'M 67 45 L 85 40',
    glyph: 'calculating',
    scan: 0.86,
  },
  red_alert: {
    accent: theme.statusDanger,
    glow: 0.28,
    eye: 'alert',
    eyeY: 54,
    mouth: 'M 45 79 L 75 79',
    browLeft: 'M 35 39 L 53 47',
    browRight: 'M 67 47 L 85 39',
    glyph: 'alert',
    scan: 1,
  },
  comma_elated: {
    accent: '#2fffd4',
    glow: 0.27,
    eye: 'bright',
    eyeY: 53,
    mouth: 'M 41 73 Q 60 88 79 73',
    browLeft: 'M 35 42 Q 44 37 53 42',
    browRight: 'M 67 42 Q 76 37 85 42',
    glyph: 'comma',
    scan: 0.78,
  },
  comma_lost_grief: {
    accent: '#66a6ff',
    glow: 0.14,
    eye: 'dim',
    eyeY: 56,
    mouth: 'M 45 82 Q 60 73 75 82',
    browLeft: 'M 35 46 Q 44 42 53 46',
    browRight: 'M 67 46 Q 76 42 85 46',
    glyph: 'comma_lost',
    scan: 0.44,
  },
  savings_withdrawal_concern: {
    accent: '#00ffa6',
    glow: 0.17,
    eye: 'concern',
    eyeY: 55,
    mouth: 'M 46 79 Q 60 74 74 79',
    browLeft: 'M 35 41 L 53 46',
    browRight: 'M 67 46 L 85 41',
    glyph: 'vault',
    scan: 0.68,
  },
  fresh_month_optimistic: {
    accent: '#7fffe8',
    glow: 0.23,
    eye: 'calm',
    eyeY: 53,
    mouth: 'M 44 74 Q 60 82 76 74',
    browLeft: 'M 36 42 Q 44 39 52 42',
    browRight: 'M 68 42 Q 76 39 84 42',
    glyph: 'reset',
    scan: 0.72,
  },
  payday_relief: {
    accent: '#37ff9b',
    glow: 0.25,
    eye: 'soft',
    eyeY: 54,
    mouth: 'M 43 74 Q 60 83 77 74',
    browLeft: 'M 36 44 Q 44 42 52 44',
    browRight: 'M 68 44 Q 76 42 84 44',
    glyph: 'deposit',
    scan: 0.72,
  },
  zero_waste_pride: {
    accent: '#00ffd1',
    glow: 0.24,
    eye: 'pride',
    eyeY: 53,
    mouth: 'M 42 73 Q 60 85 78 73',
    browLeft: 'M 35 41 Q 44 38 53 41',
    browRight: 'M 67 41 Q 76 38 85 41',
    glyph: 'clean_week',
    scan: 0.76,
  },
  overflow_transcendent: {
    accent: '#8fffea',
    glow: 0.34,
    eye: 'bright',
    eyeY: 53,
    mouth: 'M 43 74 Q 60 83 77 74',
    browLeft: 'M 35 41 Q 44 36 53 41',
    browRight: 'M 67 41 Q 76 36 85 41',
    glyph: 'overflow',
    scan: 0.9,
  },
  bill_paid_relief: {
    accent: '#77ffbd',
    glow: 0.2,
    eye: 'soft',
    eyeY: 54,
    mouth: 'M 45 75 Q 60 82 75 75',
    browLeft: 'M 36 44 Q 44 42 52 44',
    browRight: 'M 68 44 Q 76 42 84 44',
    glyph: 'paid',
    scan: 0.68,
  },
  grocery_warning: {
    accent: theme.statusWarning,
    glow: 0.18,
    eye: 'side_eye',
    eyeY: 55,
    mouth: 'M 47 79 L 73 79',
    browLeft: 'M 35 41 L 53 45',
    browRight: 'M 67 45 L 85 41',
    glyph: 'grocery',
    scan: 0.82,
  },
  floor_warning: {
    accent: theme.statusDanger,
    glow: 0.25,
    eye: 'tense',
    eyeY: 55,
    mouth: 'M 46 80 L 74 80',
    browLeft: 'M 35 39 L 53 46',
    browRight: 'M 67 46 L 85 39',
    glyph: 'floor',
    scan: 0.95,
  },
  confirm_balance: {
    accent: theme.statusPositive,
    glow: 0.2,
    eye: 'verified',
    eyeY: 54,
    mouth: 'M 45 75 Q 60 82 75 75',
    browLeft: 'M 36 43 Q 44 41 52 43',
    browRight: 'M 68 43 Q 76 41 84 43',
    glyph: 'verify',
    scan: 0.62,
  },
  post_payday_antsy: {
    accent: theme.statusWarning,
    glow: 0.2,
    eye: 'antsy',
    eyeY: 54,
    mouth: 'M 46 78 Q 60 74 74 78',
    browLeft: 'M 35 40 L 53 44',
    browRight: 'M 67 44 L 85 40',
    glyph: 'antsy',
    scan: 0.9,
  },
};

const FACE_VARIATION_MODS = {
  focus: { glowDelta: 0.03, scanDelta: 0.08, eyeYDelta: -0.6 },
  soft: { glowDelta: -0.03, scanDelta: -0.12, eyeYDelta: 0.6 },
  spark: { glowDelta: 0.07, scanDelta: 0.1, eyeYDelta: -1 },
  scan: { glowDelta: 0.01, scanDelta: 0.18, eyeYDelta: 0 },
  pulse: { glowDelta: 0.05, scanDelta: 0.04, eyeYDelta: 0.4 },
  deep: { glowDelta: -0.04, scanDelta: 0.02, eyeYDelta: 1 },
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildDerivedFaceVariants(baseVariants) {
  const derived = {};
  Object.entries(baseVariants).forEach(([key, variant]) => {
    Object.entries(FACE_VARIATION_MODS).forEach(([suffix, mod]) => {
      derived[`${key}_${suffix}`] = {
        ...variant,
        glow: clamp((variant.glow || 0.2) + mod.glowDelta, 0.08, 0.42),
        scan: clamp((variant.scan || 0.6) + mod.scanDelta, 0.2, 1),
        eyeY: (variant.eyeY || 54) + mod.eyeYDelta,
        variantRole: suffix,
      };
    });
  });
  return derived;
}

export const NOVA_FACE_VARIANTS = {
  ...BASE_NOVA_FACE_VARIANTS,
  ...buildDerivedFaceVariants(BASE_NOVA_FACE_VARIANTS),
};

function NovaEye({ cx, cy, variant, side }) {
  const accent = variant.accent;
  if (variant.eye === 'narrow') {
    return (
      <G>
        <Ellipse cx={cx} cy={cy} rx="10" ry="4.8" fill="none" stroke={accent} strokeWidth="1.7" />
        <Line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
      </G>
    );
  }
  if (variant.eye === 'side_eye') {
    const pupilOffset = side === 'left' ? 2.2 : -2.2;
    return (
      <G>
        <Circle cx={cx} cy={cy} r="8.8" fill="none" stroke={accent} strokeWidth="1.8" />
        <Circle cx={cx + pupilOffset} cy={cy} r="3.8" fill={accent} fillOpacity="0.78" />
      </G>
    );
  }
  if (variant.eye === 'dim') {
    return (
      <G opacity="0.72">
        <Circle cx={cx} cy={cy} r="8.3" fill="none" stroke={accent} strokeWidth="1.5" />
        <Circle cx={cx} cy={cy} r="2.8" fill={accent} fillOpacity="0.46" />
        <Line x1={cx - 5} y1={cy + 10} x2={cx - 1} y2={cy + 14} stroke={accent} strokeWidth="1" strokeLinecap="round" opacity="0.45" />
      </G>
    );
  }
  if (variant.eye === 'alert' || variant.eye === 'tense') {
    return (
      <G>
        <Circle cx={cx} cy={cy} r="10" fill="none" stroke={accent} strokeWidth="2.1" />
        <Circle cx={cx} cy={cy} r={variant.eye === 'alert' ? '5.1' : '4.3'} fill={accent} fillOpacity="0.82" />
        <Circle cx={cx} cy={cy} r="13" fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity="0.28" />
      </G>
    );
  }
  if (variant.eye === 'verified') {
    return (
      <G>
        <Circle cx={cx} cy={cy} r="9" fill="none" stroke={accent} strokeWidth="1.8" />
        <Path d={`M ${cx - 4} ${cy} L ${cx - 1} ${cy + 3} L ${cx + 5} ${cy - 4}`} stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </G>
    );
  }
  const innerRadius = variant.eye === 'bright' ? 4.8 : variant.eye === 'smug' ? 3.4 : 4;
  return (
    <G>
      <Circle cx={cx} cy={cy} r="9.1" fill="none" stroke={accent} strokeWidth="1.8" />
      <Circle cx={cx} cy={cy} r={innerRadius} fill={accent} fillOpacity={variant.eye === 'soft' ? 0.62 : 0.82} />
      <Circle cx={cx + 2.1} cy={cy - 2.1} r="1.3" fill="#ffffff" fillOpacity="0.26" />
    </G>
  );
}

function StatusGlyph({ type, accent }) {
  switch (type) {
    case 'alert':
      return <Polygon points="60,15 66,26 54,26" fill="none" stroke={accent} strokeWidth="1.5" strokeLinejoin="round" />;
    case 'calculating':
      return <Path d="M 54 18 L 66 18 M 54 23 L 66 23 M 54 28 L 66 28" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />;
    case 'comma':
      return <Path d="M 61 16 C 66 18 66 25 61 27 C 64 29 62 34 57 35" stroke={accent} strokeWidth="1.7" strokeLinecap="round" fill="none" />;
    case 'comma_lost':
      return <Path d="M 53 20 L 67 31 M 67 20 L 53 31" stroke={accent} strokeWidth="1.7" strokeLinecap="round" />;
    case 'vault':
      return <Path d="M 53 25 L 53 19 L 67 19 L 67 25 M 51 25 L 69 25 L 69 35 L 51 35 Z M 60 28 L 60 32" stroke={accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    case 'reset':
      return <Path d="M 67 19 A 9 9 0 1 0 69 28 M 69 19 L 69 26 L 62 26" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    case 'deposit':
      return <Path d="M 60 16 L 60 31 M 54 25 L 60 31 L 66 25 M 52 35 L 68 35" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    case 'clean_week':
    case 'paid':
    case 'verify':
      return <Path d="M 52 25 L 58 31 L 70 19" stroke={accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    case 'grocery':
      return <Path d="M 51 21 L 69 21 L 66 34 L 54 34 Z M 55 21 C 55 16 65 16 65 21" stroke={accent} strokeWidth="1.3" strokeLinejoin="round" fill="none" />;
    case 'floor':
      return <Path d="M 49 34 L 71 34 M 52 29 L 68 29 M 55 24 L 65 24" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />;
    case 'overflow':
      return (
        <G>
          <Circle cx="60" cy="26" r="4" fill="none" stroke={accent} strokeWidth="1.3" />
          <Circle cx="60" cy="26" r="8" fill="none" stroke={accent} strokeWidth="1" strokeOpacity="0.5" />
          <Circle cx="60" cy="26" r="12" fill="none" stroke={accent} strokeWidth="0.8" strokeOpacity="0.26" />
        </G>
      );
    case 'antsy':
      return <Path d="M 52 22 L 56 18 L 60 22 L 64 18 L 68 22" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />;
    case 'stable':
      return <Circle cx="60" cy="25" r="5.5" fill="none" stroke={accent} strokeWidth="1.4" />;
    default:
      return <Path d="M 60 17 L 60 32 M 56 28 L 64 28" stroke={accent} strokeWidth="1.3" strokeLinecap="round" />;
  }
}

function VariantMarks({ role, accent }) {
  switch (role) {
    case 'focus':
      return (
        <G opacity="0.72">
          <Line x1="25" y1="60" x2="38" y2="60" stroke={accent} strokeWidth="1" strokeLinecap="round" />
          <Line x1="82" y1="60" x2="95" y2="60" stroke={accent} strokeWidth="1" strokeLinecap="round" />
          <Line x1="60" y1="25" x2="60" y2="38" stroke={accent} strokeWidth="1" strokeLinecap="round" />
        </G>
      );
    case 'soft':
      return (
        <G opacity="0.42">
          <Path d="M 32 72 Q 60 94 88 72" stroke={accent} strokeWidth="0.9" strokeLinecap="round" fill="none" />
          <Path d="M 36 78 Q 60 96 84 78" stroke={accent} strokeWidth="0.7" strokeLinecap="round" fill="none" />
        </G>
      );
    case 'spark':
      return (
        <G opacity="0.86">
          <Path d="M 91 28 L 94 34 L 100 37 L 94 40 L 91 46 L 88 40 L 82 37 L 88 34 Z" fill="none" stroke={accent} strokeWidth="1" strokeLinejoin="round" />
          <Circle cx="28" cy="37" r="2.2" fill={accent} opacity="0.65" />
        </G>
      );
    case 'scan':
      return (
        <G opacity="0.58">
          <Line x1="36" y1="38" x2="84" y2="38" stroke={accent} strokeWidth="0.8" strokeLinecap="round" strokeDasharray="5 6" />
          <Line x1="31" y1="84" x2="89" y2="84" stroke={accent} strokeWidth="0.8" strokeLinecap="round" strokeDasharray="8 5" />
        </G>
      );
    case 'pulse':
      return (
        <G opacity="0.5">
          <Circle cx="60" cy="60" r="35" fill="none" stroke={accent} strokeWidth="0.8" strokeDasharray="4 7" />
          <Circle cx="60" cy="60" r="29" fill="none" stroke={accent} strokeWidth="0.7" strokeOpacity="0.7" />
        </G>
      );
    case 'deep':
      return (
        <G opacity="0.5">
          <Circle cx="46" cy="93" r="1.8" fill={accent} />
          <Circle cx="60" cy="96" r="1.8" fill={accent} />
          <Circle cx="74" cy="93" r="1.8" fill={accent} />
        </G>
      );
    default:
      return null;
  }
}

function CardinalPorts({ accent, opacity }) {
  return (
    <G opacity={opacity}>
      <Line x1="60" y1="33" x2="60" y2="17" stroke={accent} strokeWidth="1.9" strokeLinecap="round" />
      <Circle cx="60" cy="33" r="4.2" fill={BASE_FACE} stroke={accent} strokeWidth="2" />
      <Circle cx="60" cy="12" r="1.9" fill={accent} />
      <Circle cx="60" cy="7" r="1.5" fill={accent} opacity="0.75" />

      <Line x1="87" y1="60" x2="106" y2="60" stroke={accent} strokeWidth="1.9" strokeLinecap="round" />
      <Circle cx="87" cy="60" r="4.2" fill={BASE_FACE} stroke={accent} strokeWidth="2" />
      <Circle cx="111" cy="60" r="1.9" fill={accent} />
      <Circle cx="116" cy="60" r="1.5" fill={accent} opacity="0.75" />

      <Line x1="60" y1="87" x2="60" y2="106" stroke={accent} strokeWidth="1.9" strokeLinecap="round" />
      <Circle cx="60" cy="87" r="4.2" fill={BASE_FACE} stroke={accent} strokeWidth="2" />
      <Circle cx="60" cy="111" r="1.9" fill={accent} />
      <Circle cx="60" cy="116" r="1.5" fill={accent} opacity="0.75" />

      <Line x1="33" y1="60" x2="14" y2="60" stroke={accent} strokeWidth="1.9" strokeLinecap="round" />
      <Circle cx="33" cy="60" r="4.2" fill={BASE_FACE} stroke={accent} strokeWidth="2" />
      <Circle cx="9" cy="60" r="1.9" fill={accent} />
      <Circle cx="4" cy="60" r="1.5" fill={accent} opacity="0.75" />
    </G>
  );
}

export function NovaFace({ size = 80, faceKey = 'neutral' }) {
  const variant = NOVA_FACE_VARIANTS[faceKey] || NOVA_FACE_VARIANTS.neutral;
  const glowId = `novaFaceGlow_${faceKey}`;
  const accent = variant.accent;

  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={accent} stopOpacity={variant.glow} />
          <Stop offset="68%" stopColor={accent} stopOpacity="0.08" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      <Circle cx="60" cy="60" r="58" fill={`url(#${glowId})`} />
      <Circle cx="60" cy="60" r="52" fill={BASE_FACE} stroke={accent} strokeWidth="2.4" />
      <Circle cx="60" cy="60" r="47" fill="none" stroke={accent} strokeWidth="0.9" strokeOpacity="0.34" strokeDasharray="30 12 2 10" />
      <Circle cx="60" cy="60" r="41" fill="none" stroke={DIM_STROKE} strokeWidth="0.8" strokeOpacity="0.22" />

      <CardinalPorts accent={accent} opacity={variant.scan} />

      <Path
        d="M 60 31 C 55 24 42 24 34 33 C 24 43 24 55 31 60 C 24 66 25 80 36 88 C 46 96 55 92 60 86 C 65 92 74 96 84 88 C 95 80 96 66 89 60 C 96 55 96 43 86 33 C 78 24 65 24 60 31 Z"
        fill="none"
        stroke={accent}
        strokeWidth="1.55"
        strokeOpacity="0.92"
      />
      <Path
        d="M 36 37 C 27 47 27 73 37 84 M 84 37 C 93 47 93 73 83 84"
        fill="none"
        stroke={accent}
        strokeWidth="0.95"
        strokeOpacity="0.48"
        strokeLinecap="round"
      />

      <StatusGlyph type={variant.glyph} accent={accent} />
      <VariantMarks role={variant.variantRole} accent={accent} />

      <Path d={variant.browLeft} stroke={accent} strokeWidth="1.9" strokeLinecap="round" fill="none" />
      <Path d={variant.browRight} stroke={accent} strokeWidth="1.9" strokeLinecap="round" fill="none" />

      <NovaEye cx="46" cy={variant.eyeY} variant={variant} side="left" />
      <NovaEye cx="74" cy={variant.eyeY} variant={variant} side="right" />

      <Path d={variant.mouth} stroke={accent} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <Path d="M 43 96 L 77 96 M 51 101 L 69 101" stroke={accent} strokeWidth="0.8" strokeOpacity="0.28" strokeLinecap="round" />
    </Svg>
  );
}

export default NovaFace;
