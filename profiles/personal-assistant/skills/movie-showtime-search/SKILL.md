---
name: movie-showtime-search
description: Find movie showtimes for a user-specified movie, date, time window, and geographic corridor, then return a theater-by-theater list with direct theater links and ticket links when available. Use when the user asks for nearby movie times, wants coverage across several neighboring cities, or needs browser automation because theater pages hide showtimes behind JavaScript or anti-bot flows. Do not use for reviews, plot summaries, or generic entertainment recommendations that do not require concrete showtime verification.
author: alexgorbatchev
---

# Movie Showtime Search

Search broadly enough to avoid missing nearby theaters, but verify narrowly enough that every listed showtime is defensible.

Prefer direct theater pages for exact times and ticket links. When static fetches hide the real data, switch to browser automation instead of guessing from incomplete shells.

## Workflow

1. Confirm the request contract.
- Capture the movie title, target date, time filter, and search geography.
- If the user gives a corridor such as “from A to B”, keep that ordering in the final answer.
- If the area is omitted, first reuse any location corridor already established earlier in the conversation.
- If the conversation does not establish the area, use this profile-local default when it is not `__ASK_USER__`: `{{ env "PERSONAL_ASSISTANT_DEFAULT_MOVIE_AREA" default "__ASK_USER__" }}`.
- If the configured value is `__ASK_USER__`, ask the user for the location corridor instead of guessing.

2. Enumerate candidate theaters before verifying times.
- Start with official theater sites when you already know the likely venues.
- If coverage is unclear, use search results or theater aggregators to enumerate nearby candidates across the requested corridor.
- Do not stop at the first few theaters you find; missing obvious nearby venues is a quality failure.

3. Verify each theater with the strongest source available.
- Prefer official theater or chain pages for exact times.
- If an official page is JavaScript-rendered, blocked, or incomplete in static fetches, use browser automation to inspect the rendered page.
- If the official site remains inaccessible, use a theater-specific aggregator page such as Fandango or Atom and say so plainly.
- Treat generic search snippets and partially rendered shells as discovery hints, not as final evidence.

4. Resolve conflicts instead of averaging them away.
- If two sources disagree on times, prefer the source with the most direct, rendered, theater-specific evidence.
- When possible, cross-check the disputed theater with browser automation or a second theater-specific source.
- If the conflict cannot be resolved confidently, exclude the questionable time and explain why.

5. Filter to the requested date and time window.
- Show only times that match the user’s time constraint such as “after 6pm” or “Saturday afternoon”.
- Keep the original local time formatting unless the source is inconsistent.
- Do not list irrelevant matinees or neighboring-day showings.

## Source Selection Rules

- First choice: official theater site or official chain site.
- Second choice: theater-specific aggregator page with concrete rendered times.
- Discovery-only sources: generic search results, movie overviews, or truncated snippets.
- Browser automation is the default fallback whenever page rendering prevents trustworthy extraction.

## Output Contract

Return a concise theater list in this shape:

```md
## Verified nearby theaters

### City — Theater Name
- Theater: <direct theater page>
- Movie page: <optional direct movie page>
- **7:00 PM** — <direct ticket link if available>
- **8:45 PM** — <direct ticket link if available>

### Next City — Next Theater
- Theater: <direct theater page>
- **6:40 PM**
```

Then add short notes only when needed:
- Explain unverifiable theaters or conflicting times.
- Call out when a theater was included as a nearby spillover outside the strict corridor boundary.
- Say explicitly when no clean direct ticket URL was available.

## Quality Bar

- Order theaters geographically according to the user’s requested corridor.
- Include direct theater links for every listed venue.
- Include direct ticket links when you can verify them cleanly.
- Do not cite a source as verified if it only exposed a shell or search snippet.
- Be explicit about uncertainty instead of filling gaps with guesses.
- If browser automation was necessary, use it; do not under-cover the area just because static fetches were weak.
