# SCRUM-26: learning-level progression — development scope

Tracking: [feature SCRUM-26](https://project-22.atlassian.net/browse/SCRUM-26), [analysis SCRUM-27](https://project-22.atlassian.net/browse/SCRUM-27).

**Status:** the approved eight-level engine, localized selector and level-0 picture practice are implemented in this feature branch. Developer verification is not owner acceptance or independent QA. Peter’s exact-revision review (SCRUM-32), independent QA (SCRUM-33) and separate release authorization remain required.

## Confirmed scope

| New level | Content |
| --- | --- |
| 0 | Addition only: integers a, b, c in 0–6 with a + b = c; missing result only. Include zero as an empty group. Show numeric quantities and repeated pictures in standard die-pip patterns. |
| 1–2 | Preserve current rules and blank-position mix. |
| 3 | Current level 3 addition/subtraction within 20, with only the result after `=` missing. |
| 4 | Current level 3 addition/subtraction within 20, with the first or second operand before `=` missing; cover both positions. |
| 5 | Old level 4: addition/subtraction within 100. |
| 6 | Old level 5: multiplication with factors 1–5. |
| 7 | Old level 6: multiplication and exact division with factors 1–10. |

Picture themes requested: pirates, bears, lollipops, boats and aircraft. A quantity of three means three individually countable pictures, not one image with a numeral. Standard groups: one centered; two opposite diagonal corners; three those corners plus center; four corners; five corners plus center; six two columns of three. Zero is an empty group with suitable accessible wording.

## Explicit owner decisions — approved and implemented

Peter explicitly approved both Analyst recommendations after the original clarification was skipped. The later approval supersedes the original pending wording:

- **Maximum 6:** every quantity, including the total/result, is at most 6. This includes 0 + 0, 0 + 6, 6 + 0 and 3 + 3; it excludes 4 + 3.
- **Result pictures:** supplied-operand groups are always visible. Main result pictures remain a count-neutral unknown until correct submission, including after invalid/wrong input, edits and closing any hint. Preserve the existing optional stage-3 numerical worked explanation; it neither fills the answer nor reveals main result pictures.

All 28 ordered level-0 facts are eligible; swapped operands remain distinct. Finite sampling without replacement supports 5/10/20 unique numeric displays, seeded reproducibility and immutable exercises. The solver, answer checker and hints enforce blank policy too. Themes never affect generation, scoring or mathematical uniqueness.

Five original inline-vector themes cycle by the original exercise index. Retry, locale/settings/orientation changes and exact-equation review retain the theme; Next and a fresh review presentation conceal the result again. Known groups have localized position/theme/count names, zero has an explicit visible empty cue, and unknown results have no hidden count or answer imagery. Existing numeric equation controls and numeric-only `data-term` parsing remain intact. Level 1 remains the initial selection.

## Developer verification boundaries

Unit/component checks cover arithmetic domains, the complete level-0 fact set, supported sizes, seeded/constant random sources, solver/hint rejection, concealment/reveal, theme preservation and review/scoring. Developer browser checks exercise all eight levels, local artwork and responsive SK/EN practice. Test/build/browser execution evidence belongs to the delivered revision; it does not close SCRUM-32/33. Browser emulation, root-text enlargement and audio instrumentation do not establish physical-device keyboard behaviour, actual zoom, screen-reader usability or human listening quality.

## Implementation and review boundaries

- Use strict RED → GREEN → REFACTOR for functional changes. Preserve existing math legality, finite generation, unique solutions, hints, first-try scoring and exact-equation mastery review.
- Preserve touch/hardware input, localized modal/focus behavior, larger-window fit, accessible enlarged-text scrolling, gesture-gated sound/mute and once-only completion/replay guards. Recheck all eight selection cards rather than assuming the former six-card layout fits.
- Keep code and PRs on GitHub and work/evidence in Jira. Publish checked increments to the feature draft PR for previews; a documentation-only preview does not demonstrate the new functionality.
- Peter reviews the exact delivered revision under [SCRUM-32](https://project-22.atlassian.net/browse/SCRUM-32) before independent QA [SCRUM-33](https://project-22.atlassian.net/browse/SCRUM-33). Merge and production release need separate permission. Old iteration coverage waivers do not automatically cover this feature.
