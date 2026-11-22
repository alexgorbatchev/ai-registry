---
name: layout-design
description: Use when redesigning, optimizing, or reviewing interface layouts, including dense tool interfaces, control placement, wasted space, visual hierarchy, responsive composition, and iterative layout variants within an existing design system.
author: alexgorbatchev
metadata:
  created_on: 2026-11-11 14:59
  last_modified: 2026-11-11 14:59
  status: current
---

# Layout design

Optimize the interface around the user's work, not around the current component boxes. Preserve its visual language while reconsidering proportions, grouping, and placement.

This skill owns layout decisions and visual critique. It does not authorize implementation from a review request or expand a layout task into new product behavior. Pure illustration, branding, and image generation are outside its scope. Engineering validation, screenshot capture and delivery, task tracking, and integration remain with the applicable project workflow; use `programming` and the applicable capture skill when available. If unavailable, consult project instructions and capture-tool documentation; report missing evidence without claiming visual acceptance.

## Establish the design constraints

1. Identify whether the deliverable is a critique, visual exploration, or implemented UI. Honor explicit limits such as exploration without tests. Do not treat those limits as proof of functional correctness or silently extend them to later production implementation.
2. Inspect the current rendered interface and its component/theme source. Identify the typography, spacing scale, colors, borders, surfaces, icon style, control states, and responsive conventions already in use. Start from that vocabulary unless a visual-language change was requested.
3. Establish the primary task, frequent actions, occasional actions, readouts, and development utilities. Use existing behavior and user feedback; do not invent features or data to make a composition attractive. Label illustrative content and proposed controls.
4. Identify the accepted baseline, target viewports, representative content, and the concrete complaint. State the intended improvement in observable terms: more usable content area, a control beside its readout, aligned labels, or a secondary action removed from the primary path. Ask only for missing decisions that materially change the design; otherwise proceed with stated assumptions.

## Compose by task and available space

- Map each control to the object or state it affects. Place editing actions with their readouts and contextual controls with their content. Give every control a clear group; avoid floating buttons, orphan labels, and utility bars that collect unrelated actions.
- Allocate space to the primary working area first. Compare side-by-side and stacked arrangements using the actual remaining content width and height. A shorter toolbar is not an improvement if its side panels make the main workspace unusable.
- Preserve design tokens, not accidental component dimensions. Change widths, heights, orientation, and composition deliberately. Moving the same oversized rectangles around is not layout optimization.
- Build a shared grid with aligned group edges and label baselines. Use intrinsic sizing for content, bounded sizing for controls, and flexible space for the work area. Look for fixed widths, stretched rows, nested padding, and space-between distribution that create unexplained gaps.
- Make control size consistent by role. Primary actions may deserve larger targets; secondary actions should be quieter. Avoid both arbitrary size differences and making every button equally prominent. Keep practical pointer/touch targets and visible keyboard focus when increasing density.
- Size groups for their real labels and states. Reflow or change grouping before shrinking text, truncating ordinary action names, or compressing controls. Reserve truncation for genuinely variable content and retain a way to access the full value.
- Keep labels consistently positioned within comparable groups. Make units, selected values, toggles, and actions distinguishable; an unexplained number or decorative-looking action is not a compact interface.
- Use borders and surfaces to communicate actual groups. Carry shared separators through their intended span. Remove wrapper gaps around content meant to meet an edge, while preserving useful internal padding and legitimate empty content states.
- Keep occasional and development-only controls accessible but subordinate, using existing disclosure patterns where appropriate. Do not hide frequent actions merely to improve a screenshot.
- Use color to express real state or identity. Preserve contrast, selected/disabled distinctions, and non-color identification. Do not fabricate persistent colors or states that the underlying model cannot support.
- Borrow useful interaction patterns from familiar domain tools without importing their branding or assuming their limitations are requirements.

## Iterate without losing the accepted direction

1. Keep the user's selected structure and version names as the baseline. Change the aspects under discussion; do not restart the composition with each comment.
2. When variants are requested, vary meaningful structural decisions such as group placement, orientation, or space allocation. Hold theme, data, viewport, and state comparable. Produce the requested number, but repair weak candidates before presenting them.
3. Prefer one coherent refinement when the user has selected a direction. Track the specific critique through the next render; a change elsewhere does not resolve it.
4. Keep visual exploration separate from implementation evidence. Browser-only rearrangements, static markup, and illustrative controls can communicate a design, but do not establish working component lifecycle, interactions, persistence, or compatibility. Identify these limits in the handout.

## Review the rendered result

Inspect the actual captured images, not just source code or element dimensions. Compare against the baseline and the specific requested improvement in this order:

| Pass | Inspect | Repair before handout |
| --- | --- | --- |
| Whole composition | Primary workspace, hierarchy, balance, useful density at target widths | Large unexplained voids, overdominant secondary controls, sidebars consuming the work area |
| Groups | Shared edges, grid rhythm, ownership of each action, continuous separators | Floating actions, unrelated controls bundled together, inconsistent padding or broken borders |
| Controls and content | Label baselines, sizes by role, readable values, states and focus | Squeezed labels, ambiguous actions, clipped content, inconsistent targets or unreadable color |
| Responsive and state changes | Narrow layout, representative long content, empty/populated and selected/disabled states where affected | Overflow, overlaps, lost actions, unexpected wrapping, density achieved only with ideal fixture data |

Use measurements to investigate a visible problem, not as a substitute for judgment. Check the whole composition again after local fixes: widening one group may squeeze its neighbor. Recapture after repairs and inspect those final images. Successful rendering, screenshot creation, or a passing build does not establish visual acceptance.

For review-only work, report concrete defects and proposed corrections without editing. For authorized implementation, repair clear defects within scope; surface product decisions and tradeoffs that require a choice. If the rendering environment is blocked, continue source-level work where useful, state what could not be inspected, and do not label the design visually verified.

## Deliver the reviewed result

Show the final comparable visual evidence through the project's delivery workflow, with stable variant names and the chosen baseline identified. Explain the few decisions that materially improve the layout and any remaining tradeoff. State whether the result is a visual study or implemented behavior, and distinguish visual inspection from executed functional checks. Do not bury a screenshot behind a claim that it was reviewed; make it available for the user to judge.
