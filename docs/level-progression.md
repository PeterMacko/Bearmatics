# SCRUM-26: learning-level progression — development scope

Tracking: [feature SCRUM-26](https://project-22.atlassian.net/browse/SCRUM-26), [analysis SCRUM-27](https://project-22.atlassian.net/browse/SCRUM-27).

**Status:** analysis and development are authorized. This first branch increment is documentation only; the new levels are not implemented yet. Existing behavior is based on main commit `e0f27824badfb01183db0a9a291d5d691eeecb7a`.

## Confirmed scope

| New level | Content |
| --- | --- |
| 0 | New addition-only picture counting for younger children. Include zero as an empty group. Show numeric quantities and repeated child-friendly pictures arranged in standard die-pip patterns. |
| 1–2 | Preserve current rules and blank-position mix. |
| 3 | Current level 3 addition/subtraction within 20, with only the result after `=` missing. |
| 4 | Current level 3 addition/subtraction within 20, with the first or second operand before `=` missing; cover both positions. |
| 5 | Old level 4: addition/subtraction within 100. |
| 6 | Old level 5: multiplication with factors 1–5. |
| 7 | Old level 6: multiplication and exact division with factors 1–10. |

Picture themes requested: pirates, bears, lollipops, boats and aircraft. A quantity of three means three individually countable pictures, not one image with a numeral. Standard groups: one centered; two opposite diagonal corners; three those corners plus center; four corners; five corners plus center; six two columns of three. Zero is an empty group with suitable accessible wording.

## Explicitly unresolved — not approved requirements

- **Maximum 6:** proposed interpretation is total/result at most 6, not two operands up to 6 with totals up to 12. The owner skipped this clarification; do not infer consent from a skipped response.
- **Result pictures:** proposed default is supplied-operand pictures first, with result pictures revealed after a correct answer. An intentional count-the-result teaching mode would instead show them before answering. The owner skipped this clarification too.

The analyst must document these choices and their consequences before the affected Level 0 implementation is accepted. Including zero is explicitly approved. If total ≤ 6 is selected, 28 ordered addition facts are available, enough for the current 5/10/20 unique-equation sessions. Independently verify pool and blank policies rather than trusting these notes.

## Implementation and review boundaries

- Use strict RED → GREEN → REFACTOR for functional changes. Preserve existing math legality, finite generation, unique solutions, hints, first-try scoring and exact-equation mastery review.
- Preserve touch/hardware input, localized modal/focus behavior, larger-window fit, accessible enlarged-text scrolling, gesture-gated sound/mute and once-only completion/replay guards. Recheck all eight selection cards rather than assuming the former six-card layout fits.
- Keep code and PRs on GitHub and work/evidence in Jira. Publish checked increments to the feature draft PR for previews; a documentation-only preview does not demonstrate the new functionality.
- Peter reviews the exact delivered revision under [SCRUM-32](https://project-22.atlassian.net/browse/SCRUM-32) before independent QA [SCRUM-33](https://project-22.atlassian.net/browse/SCRUM-33). Merge and production release need separate permission. Old iteration coverage waivers do not automatically cover this feature.
