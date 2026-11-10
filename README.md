# Bearmatics 🐻

A child-friendly math practice web app for ages **6–9**, in **Slovak and English**, with selectable learning levels, missing-number exercises, progressive counting hints, and animated bear/sound feedback.

**Status:** MVP scope approved in [specification #6](https://github.com/PeterMacko/Bearmatics/issues/6). The foundation (#7), math engine (#8), and interactive practice interface (#9) are implemented and verified in the accepted Chromium/Firefox QA scope (#12). Choose a level and 5/10/20 exercises, practise with retries and explicit Next, switch Slovak/English without resetting progress, and view a completion summary. Progressive hints (#10), sound and expressive bear reactions (#11) are implemented and covered by accepted QA. The original bear has neutral/happy/gently sad states, short reactions, and reduced-motion alternatives. Peter accepted scoped independent QA in #12. Feature-branch publication is not a merge or production deployment.

## Learning levels and mistake review

Peter's revision in [#15](https://github.com/PeterMacko/Bearmatics/issues/15) supersedes the original five-level progression in #6:

| Level | Practice |
| --- | --- |
| 1 | Addition only, up to 10 |
| 2 | Addition and subtraction, up to 10 |
| 3 | Addition and subtraction, up to 20 |
| 4 | Addition and subtraction, up to 100 |
| 5 | Multiplication with factors 1–5 |
| 6 | Multiplication and exact division with factors 1–10 |

A mathematical mistake does not end the exercise: the child can retry immediately. Once the original session is finished, each missed equation returns in a review queue, with the same missing-number position. A correct first valid attempt removes it from review; another mistake causes it to cycle to the back after the immediate retry. Invalid input does not count as an attempt. Completion appears only when the review queue is empty. Original first-try statistics are not inflated by review answers. Leaving/restarting remains possible and discards in-memory progress.

The revised visual direction uses coral, sunshine yellow and sky blue rather than green primary styling. Three teaching-hint stages are now available in Slovak and English: strategy → visual part/whole or equal-group model → worked solution. Known quantities use dots and tens blocks; earlier stages keep the missing value hidden. Worked solutions use the appropriate inverse operation for a missing operand, with smaller tens/ones or bridging-ten steps where useful. Hints never fill or submit an answer and reset on the next exercise; switching language preserves the hint stage and typed answer.

Hint-assisted answers are excluded from original first-try counts. A hinted review answer must return for a fresh unassisted attempt before clearing the mastery queue. Hint use alone does not add an otherwise-correct original exercise to the mistake queue. Expressive bear/sound reactions are implemented in #11 and covered by the accepted QA scope in #12.

## Answer feedback and sound

Answer controls are neutral blue before checking, green on success, and red after a valid wrong answer. Editing the answer returns controls and the bear to neutral. Invalid input gets a short localized prompt, without an example, punishment, sound or sad reaction. Text feedback remains available alongside colour, sound and animation.

Sound preference starts **on by default**. Browser audio activates only from a genuine interaction such as Start; it does not autoplay on page load. Settings distinguishes requested, ready, unavailable and muted states. Muting before Start is respected, and mute stops active/scheduled tones immediately. Correct/retry cues use stronger bounded synthesized tones; a distinct two-second completion fanfare plays once after the original session and all required mastery review are finished, without replaying on settings/language changes or unmute. No background music, microphone access, audio downloads or recordings are used. If the browser blocks audio, practice continues with visual feedback. The bear has short non-looping success/retry reactions; reduced-motion settings disable movement while keeping the expressions. Human listening and device volume remain separate review checks.

The bear SVG, expression variations and procedural sound patterns were created for Bearmatics; no third-party image or audio assets are included. A repository-wide license has not been selected by this task.

## Team

| Participant | Responsibility |
| --- | --- |
| Peter (product owner) | Approves scope, reviews Dev's delivered work **before independent QA**, and authorizes merge/release. |
| `dev` | Coordinates work, implements, runs developer checks, presents reviewable deliverables, and verifies evidence before closing tasks. |
| `bearmatics-analyst` | Clarifies requirements, learning rules, user flows, and acceptance criteria. |
| `bearmatics-tester` | Independently tests the owner-approved revision and reports verified results and reproducible defects. |

## Delivery workflow

```mermaid
flowchart TD
    A[Peter defines the task] --> B[Analyst clarifies scope and acceptance criteria]
    B --> C{Peter approves scope?}
    C -->|Changes requested| B
    C -->|Yes| P[Open draft PR and feature-branch preview early]
    P --> D[Dev implements, checks and pushes safe increments]
    D --> E[Dev presents exact revision and preview for owner review]
    E --> F{Peter approves this revision for QA?}
    F -->|Changes requested| D
    F -->|Yes| G[Tester performs independent QA on approved revision]
    G --> H{QA passes?}
    H -->|No: defects return to Dev| D
    H -->|Yes| V[Dev closes verified implementation and QA tasks]
    V --> I{Peter authorizes merge and release?}
    I -->|Changes requested| D
    I -->|Hold| J[Wait without merging or deploying]
    J --> I
    I -->|Yes| K[Authorized merge and Cloudflare deployment]
    K --> L[Verify deployed revision and acceptance criteria]
    L --> M{Verification passes?}
    M -->|No| D
    M -->|Yes| N[Dev closes completed issues]
```

### Required review gates

1. **Scope approval and early previews:** proposals are not requirements until Peter agrees. For approved feature work, create a feature branch and draft PR as soon as a meaningful first commit is available. Push checked increments throughout development so Peter can follow the Cloudflare branch preview. Draft publication and preview updates are authorized by this workflow; they are not owner acceptance, independent QA, merge, or production-release approval. Keep the PR draft until review gates pass.
2. **Peter's review before QA:** Dev supplies a short change summary, linked issue/PR or exact revision, a runnable demo/preview when available (screenshots when useful), and developer test/build results with limitations. Peter explicitly approves that revision for QA, or requests changes.
3. **Independent QA:** the tester may prepare a test plan beforehand, but must not start independent acceptance testing of delivered work until Peter's approval is recorded. Dev's unit tests, build checks, and automated CI are allowed before this gate; they do not replace QA.
4. **Rework:** implementation changes after Peter's approval, including QA fixes, return through Peter's review before independent QA/retesting. Record the approved revision so old approval is not applied to new code.
5. **Release approval:** Peter's approval to start QA is **not** approval to merge or deploy. Merge/release requires separate explicit authorization. If merging triggers Cloudflare production deployment, merge is also a release decision.

Record approval in the relevant issue/PR comment (for example, `Peter: approved revision <commit> for QA`) or in this team's chat, with a concise attributed record linked to the issue. GitHub credentials are currently shared through Peter's account, so a self-approval restriction must not be bypassed or treated as approval; a clear owner decision is required. These are team operating rules, not yet technically enforced branch-protection or CI gates.

## GitHub work tracking

- One parent issue per feature/outcome; native sub-issues for meaningful agent tasks and owner review.
- Titles use `[ANALYST]`, `[DEV]`, `[QA]`, or `[OWNER]`; `agent:*` labels identify agents. The body explicitly names the responsible participant. Hermes agents are not separate GitHub accounts.
- Keep scope, acceptance criteria, dependencies, and evidence concise. Comment only for decisions, blockers, handoffs, approvals, and verified results; identify the acting participant.
- A task's status is not proof of completion. Dev checks evidence before closing; all acceptance criteria and review gates must be satisfied before the parent closes.
- Creating an issue does not automatically start an agent or authorize code publication, merges, cloud resources, or deployments.

## Accepted QA scope

Independent QA of the owner-approved snapshot passed in Chromium and Firefox with no confirmed product defects. It included independent arithmetic/hint checks and practice/review flows, in addition to rerunning developer tests. Peter accepted the documented coverage limits: WebKit/Safari could not launch due to missing host libraries; physical-device behaviour, human sound-quality review and a full accessibility audit remain unverified. This is not a claim of universal browser compatibility or release authorization. Evidence and decisions are recorded in [#12](https://github.com/PeterMacko/Bearmatics/issues/12) and [#14](https://github.com/PeterMacko/Bearmatics/issues/14).

No hosted GitHub Actions CI workflow is included in this initial app publication; test/build evidence comes from local developer and isolated independent-QA runs.

## Hosting and data

Hosting: **Cloudflare Workers with Static Assets**, connected to this GitHub repository by Peter. The MVP is live at https://bearmatics.mr-petermacko.workers.dev (release verification in #13). No server database or accounts are required for the initial app. A future authenticated Worker API with Cloudflare D1 can support saved progress. Do not store children's personal data by default.

## Local development and developer checks

Use Node.js `^26.12.1` (supported Node 26.x starting at 26.12.1; validated here with Node 26.12.1 and npm 11.19.1). Install the exact dependency tree from the committed lockfile:

```sh
npm ci
npm run dev
```

The development server binds to localhost. To verify the foundation:

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run deploy:check
```

The browser smoke test starts/stops a local production preview automatically. On Linux, Playwright may require OS browser dependencies; install them through your administrator if the browser reports missing libraries. `deploy:check` is a Wrangler dry run, not a cloud deployment. These are developer checks, not independent QA signoff. Developer browser tests complete real sessions on every level, cover 5/10/20 exercise counts, language switching, modal keyboard focus and a 320px Slovak layout. Unit/component tests cover the pure math engine, invalid input versus wrong answers, retries, exact session completion, first-try counts, language state and leave confirmation. This is developer verification, not independent QA or a complete accessibility audit. Developer checks also cover hint formulas for each operator/blank, zero/boundary values, decomposition, stage/language preservation, hint-assisted scoring, review requeueing and narrow layouts. Developer checks also cover neutral/error/success control colours, bear expressions, reduced motion, opt-in native Web Audio, mute, blocked audio and duplicate-submission suppression.

Dependencies are pinned. npm 11 install-script approvals are limited to the locked esbuild/workerd versions in package.json. Do not broadly approve unrelated dependency scripts. `npm audit` can be run to check the current dependency advisories.

## Cloudflare connection settings

After the application PR is merged into `main` with Peter’s approval, and the first deployment is authorized, connect the repo as a Worker with these settings:

| Setting | Value |
| --- | --- |
| Worker name | `bearmatics` (must match wrangler.jsonc) |
| Root directory | Repository root |
| Production branch | `main` |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |
| Preview builds | Enabled; preview URLs are public unless protected |
| Build variable | `NODE_VERSION=26.12.1` (or a compatible installed Node version) |
| App secrets / database bindings | None for this foundation |

Wrangler serves static files from `dist` with SPA fallback; no server script is required. Cloudflare installs dependencies before the build. The initial production release was verified in #13. Do not treat a successful dry run as a live release. Feature branches use preview builds (`npx wrangler preview`), never the production deploy command. Add the actual verified stable Preview URL to the draft PR; do not guess it from a branch name. A failed build leaves the last successful preview unchanged, so record the previewed revision and use a deployment-specific URL for exact owner/QA approval when available. Publishing to the production branch can trigger deployment once Git integration is connected; obtain release authorization first.

## Planning links

- [Team kickoff and conventions #1](https://github.com/PeterMacko/Bearmatics/issues/1)
- [MVP scope and task breakdown #5](https://github.com/PeterMacko/Bearmatics/issues/5)
