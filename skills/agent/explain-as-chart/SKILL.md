---
name: explain-as-chart
description: >-
  Use when explaining a request flow, sequence of calls, system or service
  architecture, component layout, or job pipeline as a diagram, including when
  the user asks to draw, chart, diagram, or visualize it, or says an ASCII
  diagram is not rendering.
author: alexgorbatchev
metadata:
  created_on: 2026-11-10 15:30
  last_modified: 2026-11-10 15:30
  status: current
---

## Pick a template

- [Sequence template](assets/sequence.html): who calls whom, in order. Actors are columns; steps are arrows, dashed replies, and notes, grouped into colored phases.
- [Blocks template](assets/blocks.html): what exists and how it connects. Boxes sit on a column grid with a title and short lines (numbered steps work well), joined by labeled arrows; dashed for asynchronous or polling links.

Draw a flow with both only when the user needs structure and ordering; render them as two separate pages.

## Fill it

1. Copy the template and replace only its `DIAGRAM` object. Leave the rendering code and styles unchanged.
2. Take every name, endpoint, table, and count from the code, configuration, or conversation. Do not invent components to balance the layout.
3. Keep labels short: arrow labels under about 45 characters, box lines under about 40, at most 6 actors or 3 columns. Split a larger system into several diagrams rather than shrinking text.
4. Keep colors on the theme variables the templates use, so the page follows light and dark themes.

## Show it

1. When a tool can render HTML inline in the conversation, preview the page first and inspect the image for overlapping labels, clipped text, and arrows that cross boxes. Fix the data (shorter labels, another column or row, a `span`) and preview again, at most twice.
2. Render the checked page inline with the measured content height.
3. Without such a tool, write the page to a scratch `.html` file and give its absolute path. Do not substitute ASCII art for a requested diagram.
4. In the reply, add only what the diagram cannot show, such as open questions or decisions; do not restate the diagram.
