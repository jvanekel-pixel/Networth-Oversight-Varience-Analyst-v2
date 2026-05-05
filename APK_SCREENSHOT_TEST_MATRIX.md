# NOVA APK Screenshot Test Matrix

Use this matrix before sharing an APK beyond the core test group. The goal is not identical pixel positions across devices. The goal is a stable hierarchy, readable text, no clipped controls, no content hidden behind Android system bars, and predictable card density.

## Device Classes

| Class | Target width | Why it matters | Example targets |
| --- | ---: | --- | --- |
| Narrow phone | 320-359 dp | Worst case for cramped chips, tab labels, calendar cells, and modal forms. | older/small Android, emulator Pixel 2-ish |
| Compact phone | 360-411 dp | Main Android phone class. | Pixel/Samsung/Motorola regular phones |
| Large phone | 412-599 dp | Tall/larger phones can stretch rows and charts. | Samsung Ultra/Motorola large display |
| Medium window | 600-839 dp | Foldable, tablet, split-screen. | foldable inner display/tablet |
| Expanded window | 840+ dp | Checks max-width caps and centered content. | tablet landscape/desktop emulator |

## Required APK Screenshots

Capture each screen at 1.0 font scale and again at 1.3 font scale for narrow and compact phones.

| Screen | Required states |
| --- | --- |
| Dashboard | default cards visible, dashboard header buttons, recent activity populated |
| Personal | header actions, variance card, account card, bills/subscriptions, receipt card |
| Household | unavailable state for solo mode, full view for partnered mode |
| Business | business overview and business selector |
| Business Detail | income list, expense list, receipt add/view tags, entry modal open |
| Calendar | dashboard mode, personal mode, business mode, day sheet open |
| Settings | backup folder section, auto-backup schedule, long collapsible sections |
| Reports | header row, chart cards, export panel |
| Transaction Modal | income, expense, split transaction, edit transaction |
| Onboarding | welcome, accounts, bills, savings goal, review |

## Pass Criteria

- No text overlaps another text block, icon, control, or chart.
- No primary action is below or behind Android navigation controls.
- Header action rows wrap instead of compressing text below readability.
- Calendar cells remain square-ish and centered; date numbers and event dots remain visible.
- Charts stay inside their card bounds.
- Modal sheets are scrollable when content exceeds screen height.
- Touch targets remain at least about 48 dp tall for primary controls.
- At font scale 1.3, dense rows can wrap or truncate gracefully, but controls must remain discoverable.
- At 600+ dp widths, content is centered and capped instead of stretching edge to edge.

## ADB Commands

Install the APK:

```powershell
adb install -r .\nova-v2-v1.1.1.apk
```

Set font scale:

```powershell
adb shell settings put system font_scale 1.3
adb shell settings put system font_scale 1.0
```

Capture a screenshot:

```powershell
adb exec-out screencap -p > .\screenshots\dashboard-compact-font-1.0.png
```

Record a short navigation clip:

```powershell
adb shell screenrecord /sdcard/nova-layout-check.mp4
adb pull /sdcard/nova-layout-check.mp4 .\screenshots\nova-layout-check.mp4
```

## Regression Notes

When a screen fails, fix the shared layout primitive first if the problem is structural. Only patch a single screen when the issue is genuinely local to that screen.

Preferred fixes:

- Add `flexWrap: 'wrap'` to dense action rows.
- Replace fixed `height` with `minHeight`.
- Add `minWidth: 0` and `flexShrink: 1` to text containers inside rows.
- Use `ScrollScreen` for full-screen scrolling surfaces.
- Use `useResponsiveLayout()` instead of `Dimensions.get()` for runtime layout.
- Cap wide content with `contentMaxWidth` instead of scaling every card wider.
