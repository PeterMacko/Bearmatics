# SCRUM-36 — approved menu visual fixes

Baseline: `27a4d6bf10d2d0dc630d692861a91c0b06cbe6b0`.
Peter explicitly approved the Analyst scope and marked [analysis review SCRUM-41](https://project-22.atlassian.net/browse/SCRUM-41) Done. Source-informed analysis is SCRUM-37; it is not browser/acceptance-QA evidence.

## Scope
- Phone menu: bear left, trail/heading/intro to its right in one band; gear remains top-right. Reclaim the obsolete `b.` header space. Preserve wider bear-left composition.
- Height-constrained narrow AND wide windows: only the eight-level list scrolls; menu header and exercise-count5/10/20 plus Start remain visible at ordinary sizes. Preserve readable text,48px level/count/Start targets, selection and keyboard/touch reachability. Use accessible document-flow fallback when enlargement or extreme height makes fixed regions plus a complete level row physically impossible. Never hide overflow or shrink fonts to manufacture fit.
- Remove visible `b.` globally, retaining accessible Bearmatics identity and session Back. Rearrange only the menu, not the practice bear/controls.
- Add original, local, recognizable smiling-bear favicon; verify16/32px artwork, built delivery and MIME/path rather than SPA-fallback HTML. SVG plus local32px PNG fallback is the proposed treatment.
- Preserve SK/EN copy, mathematical progression, zero cap, defaults, scoring/mastery/hints, session identities, inputs, settings and audio. Exact responsive thresholds are implementation choices to verify, not new learning rules.

## Owner-requested development-review amendment
Peter's review of e359406 approves the narrow-phone layout as shown: preserve it unchanged apart from the gentle wink. Wide windows must use a compact horizontally/vertically centered menu rather than stretching header and controls across the full height. Put the wide settings gear at the viewport upper-right outside main content, preserving the approved narrow gear position. At Fold/wide sizes, enlarge and vertically center the bear in the left half; put heading, a SINGLE column of levels, count and Start in the right half. This supersedes retaining two-column cards. Keep level-list-only scrolling when height-constrained and readable extreme-enlargement fallback. Add a short infrequent menu-only wink (roughly25–40seconds apart as an implementation default), no layout shift, disabled for reduced motion, suspended when hidden, cleaned up on exit. Do not alter practice bear feedback, audio or session logic. Revised exact preview must return to DEVELOPMENT44 before independent QA.

## Small-bear decoration and idle-motion refinement
Peter's review of879de64 requests smaller blue decorative leaf accents when the menu bear is small; keep the bear size and all approved menu geometry unchanged. Scale decoration with its scene rather than using desktop-sized fixed leaves on the82px phone scene. Add a slow low-amplitude side-to-side menu-bear sway without layout shift or collisions, preserving practice feedback/audio. Disable motion for reduced-motion users, pause while hidden, and clean up any listeners/timers on menu exit. Wink cadence is now explicitly about30seconds (the current implementation already uses30seconds); preserve it and verify repeat events rather than claiming an unimplemented speed increase. Return the revised exact preview through DEVELOPMENT44 before independent QA.

## Distinct owner gates
1. **Analysis review SCRUM-41:** approved/Done; reopen only for material scope changes.
2. **Development review SCRUM-44:** separate task. When checked code and exact preview are ready, set In Review and assign Peter. Reopen this task for revised previews, QA fixes or coverage decisions. Peter approves the exact revision BEFORE independent Tester QA.
3. **Final PR review:** no third OWNER subtask. After ready open PR and completed QA/coverage gates, set feature SCRUM-36 In Review and assign Peter for his merge. Until then, feature stays In Progress/unassigned.

No merge/production-release permission. Developer checks are not independent QA. Retain raw failures and obtain explicit disposition for material coverage limits; prior-feature waivers are not inherited.

## Verification plan
TDD component/browser regressions; EN/SK phone portrait/landscape, wide-short and roomy windows; actual scroll ownership and all eight levels; native-radio keyboard focus/reveal; selected level/count through locale/settings/resize; enlarged-text fallback without clipping; retained practice and modal regressions. Keep simulated root text, actual browser zoom, emulation and real-phone evidence distinct. Original Analyst specification and verified SHA256 manifest are retained under Dev scratch `jira-menu-visuals/analyst-verified/`.
