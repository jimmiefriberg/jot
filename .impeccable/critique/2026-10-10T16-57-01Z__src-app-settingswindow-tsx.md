---
target: Settings window
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/jimmiefriberg/Documents/GitHub/jot/src/app/SettingsWindow.tsx"
target_fingerprint: "sha256:4173aca711b94f369b97682d0dfe7624a18555515367b7a6c18e835e0df4d6d6"
target_path: /Users/jimmiefriberg/Documents/GitHub/jot/src/app/SettingsWindow.tsx
timestamp: 2026-10-10T16-57-01Z
slug: src-app-settingswindow-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

# Critique: Settings window (src/app/SettingsWindow.tsx)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Picking a theme for the inactive appearance changes nothing visible; no "in use" marker. |
| 2 | Match System / Real World | 3 | Plain copy, familiar theme names. |
| 3 | User Control and Freedom | 2 | Custom-theme Delete is instant, no confirm, no undo; no reset to defaults. |
| 4 | Consistency and Standards | 3 | Tab/radio roles without arrow-key behaviour; one switch left of its label. |
| 5 | Error Prevention | 2 | Numbers saved unclamped (updateSettings writes raw values); Delete beside Duplicate. |
| 6 | Recognition Rather Than Recall | 3 | Swatches good; Appearance mode lives on another tab. |
| 7 | Flexibility and Efficiency | 2 | No theme filter, no ⌘1–4, no hex paste, 21 card tab stops. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm; small redundancies (Appearance group/row, 19 disabled swatches). |
| 9 | Error Recovery | 2 | Unknown font / deleted in-use theme fall back silently. |
| 10 | Help and Documentation | 3 | Short inline descriptions answer the real question. |
| **Total** | | **25/40** | **Acceptable** |

## Design Specificity Verdict
Half and half. Structure copies macOS System Settings (toolbar tabs, grouped cards, right-aligned switches), in tension with the platform-neutral principle. Jot-specific: live re-theming, theme cards from real colour roles, real-font samples, "X opens as" rows.
Detector: CLI 0 findings. Browser (Ink, 760×620): 5× tiny-text (.setting-row-description 11.5px, General + Editor), 2× low-contrast (unselected segments 4.47:1, General "Light", Files "Plain"), 1× text-occlusion false positive (detector's own badge). Detector missed the off-switch contrast (1.16–1.44:1 in all themes); design review found muted text far worse in other presets (Solarized Light 2.48:1).

## Priority Issues
- [P1] Theme picking gives no feedback; Appearance control is on another tab. Fix: Appearance control atop Themes, "In use" tag, inline note under the inactive grid. Command: /impeccable clarify
- [P1] Theme-dependent contrast: off switch 1.16–1.44:1 everywhere, white knob 1.7–2.5:1 on dark accents, muted 11.5–12px text under 4.5:1 in 7 presets. Fix: inset ring on off track, readable knob, descriptions/headings mixed at 72% foreground. Command: /impeccable harden
- [P1] Keyboard model and labels: no arrow keys/roving tabindex on tabs, segments, grids (43 tab stops on Themes); unnamed number inputs (SettingRow uses div/span); unlabelled grids; ⌘+ no zoom. Real-app Tab reach unverified (could be P0). Command: /impeccable harden
- [P2] Custom-theme flow: buried below 21 cards; instant Delete; no hex input; mixed UI/syntax colour grid; unclamped numbers in saveNumber. Command: /impeccable harden (+ distill)
- [P2] Controls compact vs "quiet but roomier": segments 23px, inputs 72×26, selects 28px, switch 32×19, swatches 30×22, 11.5px labels. Fix: ≥30px inputs/buttons, ≥28px segments, 36×22 switch, 12–13px text. Command: /impeccable polish

## Persona Red Flags
- Alex: no theme filter, no ⌘1–4, 21 tab stops, scroll past all cards to edit colours, unordered "Theme to edit" list.
- Sam: near-invisible off switches, Solarized Light 2.48:1, unnamed inputs, no arrow keys, no zoom in Settings, faint input focus ring in Solarized/Sepia.
- Tove: picks Dracula in Light mode and sees nothing; no palette paste/import; "Other…" font saves per keystroke and falls back silently; bundled fonts not indicated.

## Minor Observations
- Sideways shift between tabs (scrollbar) → scrollbar-gutter: stable.
- Raised cards read recessed in dark themes.
- Dark-theme toggle on current light pick leaves Light grid unselected.
- Card hover lift ignores prefers-reduced-motion.
- nav + role=tablist; tab buttons default type=submit.
- Five "X opens as" rows could be one matrix.

## Questions to Consider
- One grid for light and dark, with a Preview toggle?
- "Paste or import a palette" instead of 19 pickers?
- One scrolling page with anchors and a filter instead of four Mac-style tabs?
