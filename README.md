# Bearmatics 🐻

A child-friendly math practice web app for ages **6–9**, in **Slovak and English**, with selectable learning levels, missing-number exercises, progressive counting hints, and animated bear/sound feedback.

**Status:** MVP scope approved in [specification #6](https://github.com/PeterMacko/Bearmatics/issues/6). The foundation (#7), math engine (#8), and interactive practice interface (#9) are implemented and verified in the accepted Chromium/Firefox QA scope (#12). Choose a level and 5/10/20 exercises, practise with retries and explicit Next, switch Slovak/English without resetting progress, and view a completion summary. Progressive hints (#10), sound and expressive bear reactions (#11) are implemented and covered by accepted QA. The original bear has neutral/happy/gently sad states, short reactions, and reduced-motion alternatives. Peter accepted scoped independent QA in #12. Feature-branch publication is not a merge or production deployment.

## Learning levels and mistake review

The implemented [SCRUM-26 progression](docs/level-progression.md) extends Peter's revision in [#15](https://github.com/PeterMacko/Bearmatics/issues/15). This feature still requires exact-revision owner review and independent QA; the earlier MVP acceptance below does not accept these changes:

| Level | Practice |
| --- | --- |
| 0 | Picture addition, all quantities 0–6, missing result only |
| 1 | Addition only, up to 10; any missing term |
| 2 | Addition and subtraction, up to 10; any missing term |
| 3 | Addition and subtraction, up to 20; missing result only |
| 4 | Addition and subtraction, up to 20; missing first or second operand |
| 5 | Addition and subtraction, up to 100; any missing term |
| 6 | Multiplication with factors 1–5; any missing term |
| 7 | Multiplication and exact division with factors 1–10; any missing term |

Every original generated round has **at most one question involving zero**, counting all three stored values, including the hidden answer; several zeros in one fact still count as one question. Levels 6–7 remain strictly positive. Level 0 includes zero as an explicitly empty group, with all 28 ordered addition facts still mathematically legal (swapped operands remain distinct). Rounds of 5 or 10 remain unique on every level, as do 20-question rounds on levels 1–7. For level 0 only, Peter approved keeping 20 questions: all 15 distinct nonzero facts plus one zero-containing fact and exactly four additional nonzero presentations, each repeating a different fact, separated rather than immediately repeated. The zero fact never repeats within the original round. Numeric entry and the usual keypad remain available. Original local pirates, bears, lollipops, boats and aircraft cycle by original exercise index, staying unchanged through retries, review and settings. Supplied groups remain visible; the main result pictures appear only after a correct submission and hide again on Next or a fresh review presentation. The optional final worked numerical hint remains available without revealing main result pictures. Initial selection remains level 1.

A mathematical mistake does not end the exercise: the child can retry immediately. Once the original session is finished, each missed presentation returns in a review queue, with the exact same equation and missing-number position. Review is not a new generated question: a missed zero fact may return as often as the existing mastery rules require, and repeated level-0 original presentations retain separate identities and themes. A correct first valid attempt removes it from review; another mistake causes it to cycle to the back after the immediate retry. Invalid input does not count as an attempt. Completion appears only when the review queue is empty. Original first-try statistics are not inflated by review answers. Leaving/restarting remains possible and discards in-memory progress.

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
| `bearmatics-analyst` | Prepares backlog features in Jira: scope, acceptance criteria, subtasks and dependencies; moves approved features to Ready. |
| `bearmatics-tester` | Independently tests the owner-approved revision and reports verified results and reproducible defects. |

## Delivery workflow

### Activity diagram

```mermaid
flowchart TD
    A[Peter gives the Analyst a feature idea] --> C[Analyst writes scope, acceptance criteria, Jira feature, subtasks and dependencies]
    C --> BL[Feature in Backlog; analysis review OWNER task In Review assigned Peter]
    BL --> D{Peter approves scope?}
    D -->|Revise| C
    D -->|Yes| AD[Analysis review Done; Analyst moves feature to Ready]
    AD --> SEL{Peter selects it: implement SCRUM-X}
    SEL -->|Not yet| AD
    SEL -->|Yes| RC{Dev readiness check: analysis still fits current main?}
    RC -->|Drift or gaps| C
    RC -->|Yes| E[Feature In Progress and unassigned; open draft PR and preview early]
    E --> F[Dev implements with tests, build and code review]
    F --> G[Completed developer tasks In Review]
    G --> H[Publish checked revision and verify preview identity]
    H --> I[Separate DEVELOPMENT review OWNER task; In Review assigned Peter; exact revision]
    I --> J{Peter approves this revision for QA?}
    J -->|Changes requested| F
    J -->|Yes: development review Done| K[Independent Tester checks immutable approved source]
    K --> L{Confirmed defects?}
    L -->|Yes| M[Record reproducible Jira fixes; Dev repairs and verifies]
    M --> G
    L -->|No| N{Remaining test failures or coverage limits?}
    N -->|Yes| O[Reopen DEVELOPMENT review task; assign Peter; brief coverage decision]
    O --> P{Peter accepts documented limits?}
    P -->|More testing| K
    P -->|Code change needed| F
    P -->|Yes: development review Done| Q[Close independently verified work and scoped QA; retain raw failures]
    N -->|No| Q
    Q --> R[Complete handoff; mark PR ready; feature In Review assigned Peter]
    R --> S{Peter merges or explicitly authorizes merge and release?}
    S -->|Hold| T[Wait; no agent merge or production release]
    T --> S
    S -->|Changes requested| U[Feature In Progress and unassigned; PR draft]
    U --> F
    S -->|Yes| V[Authorized merge and Cloudflare production deployment]
    V --> W[Dev verifies deployed revision, assets and acceptance criteria]
    W --> X{Release verification passes?}
    X -->|No| Y[Feature In Progress and unassigned; record incident; new draft fix PR]
    Y --> F
    X -->|Yes| Z[Feature Done]
```

### Sequence diagram

```mermaid
sequenceDiagram
    actor Peter as Peter - product owner
    participant Dev as Dev - coordinator
    participant Analyst as Analyst
    participant Jira as Jira - planning and decisions
    participant GitHub as GitHub - code and PR
    participant Cloudflare as Cloudflare - preview and production
    participant Tester as Independent Tester

    Peter->>Analyst: Feature idea for the backlog
    Analyst->>Jira: Create feature in Backlog, native subtasks and dependencies
    loop Until scope is approved
        Analyst->>Jira: Analysis review OWNER task In Review, assign Peter
        Analyst->>Peter: Specification, open questions, request scope approval
        Peter-->>Analyst: Approve scope, or request changes
    end
    Peter->>Jira: Analysis review Done, preserve approval
    Analyst->>Jira: Feature Ready
    Note over Peter,Jira: Several Ready features can wait in the backlog
    Peter->>Dev: Implement SCRUM-X
    Dev->>Jira: Readiness check against current main
    alt Analysis is stale or incomplete
        Dev->>Analyst: Return gaps, feature back to Backlog
    else Ready to build
        Dev->>Jira: Feature In Progress, unassigned
    end
    Dev->>GitHub: Open early draft PR and push checked increments
    GitHub->>Cloudflare: Build feature-branch preview
    Cloudflare-->>Dev: Preview and deployed revision identity

    loop Until exact revision and scoped QA are accepted
        Dev->>Dev: TDD implementation or fixes, checks and code review
        Dev->>Jira: Developer-complete tasks In Review
        Dev->>GitHub: Push checked revision and retain draft status
        GitHub->>Cloudflare: Update branch preview
        Cloudflare-->>Dev: Verified preview revision
        Dev->>Jira: Separate DEVELOPMENT review task In Review, assign Peter
        Dev->>Peter: Brief review request with exact revision and preview
        alt Peter requests changes
            Peter-->>Dev: Required changes, no acceptance QA yet
        else Peter approves this revision for QA
            Peter->>Jira: DEVELOPMENT review Done
            Dev->>Tester: Approved immutable source, criteria and evidence requirements
            Tester-->>Dev: Independent results, defects and coverage limits
            Dev->>Dev: Read and verify raw evidence
            alt Confirmed defect
                Dev->>Jira: Create fix, return through owner review before retest
            else Test failures or coverage limits remain
                Dev->>Jira: Reopen DEVELOPMENT review task, assign Peter
                Dev->>Peter: Accept documented limits or request more testing
                alt Peter accepts limits
                    Peter->>Jira: DEVELOPMENT review Done, scoped acceptance recorded
                else Peter requests more testing
                    Dev->>Tester: Additional testing of SAME approved source
                    Tester-->>Dev: Additional evidence or defects
                    Dev->>Peter: Updated coverage decision if still needed
                    Note over Dev,Tester: Testing-only changes repeat QA and coverage decision, not implementation review
                else Peter requests code changes
                    Note over Peter,Dev: Return to implementation and Peter's revision review before retesting
                end
            else No unresolved test or coverage gate
                Note over Dev,Tester: QA accepted with verified evidence
            end
        end
    end

    Dev->>Jira: Verified implementation, QA and handoff tasks Done
    Dev->>GitHub: Mark PR ready, retain failures and accepted limits in report
    Dev->>Jira: Feature In Review, assign Peter
    Dev->>Peter: Ready for your merge
    Note over Peter,Cloudflare: Preview approval and coverage acceptance are NOT merge or release approval
    Peter->>GitHub: Merge PR, or explicitly authorize Dev to merge
    GitHub->>Cloudflare: Trigger authorized production deployment
    Cloudflare-->>Dev: Deployed revision and assets
    Dev->>Dev: Verify live identity and acceptance criteria
    alt Release verification passes
        Dev->>Jira: Feature Done
    else Verification fails
        Dev->>Jira: Feature In Progress and unassigned, record incident or fix
        Dev->>GitHub: Open new draft fix PR if code changes are needed
        Note over Peter,Dev: Fixes repeat revision review and independent QA, no automatic release permission
    end
```

**Backlog first:** Jira statuses are **Backlog** (Analyst drafted, awaiting Peter's analysis approval) → **Ready** (approved, waiting to be selected) → To Do / **In Progress** / **In Review** / **Done**. The Analyst creates and maintains backlog features in Jira; Dev starts only when Peter selects a Ready feature.

**Throughout both diagrams:** after selection, the feature stays **In Progress and unassigned** during development, owner preview review, QA and unresolved coverage decisions. Completed developer tasks use **In Review** until independently verified. Use TWO separate **OWNER** subtasks: **analysis/scope review** and **development/exact-revision preview review**. Assign each to Peter only when actionable. Preserve approved analysis review as Done; reopen development review for revised previews, QA fixes and coverage decisions. Reopen analysis review only for material scope changes. Keep requests brief. Final PR review is the feature itself, not a third owner task. At the final gate, the open PR is ready and all testing/coverage decisions are complete; the feature becomes **In Review, assigned Peter**. Accepted limits never turn raw failing tests into passes.

**Models and limits:** the team runs on Anthropic Claude: Dev and Analyst use Claude Opus 5.5, the Tester uses Claude Sonnet 5.5. Claude enforces its own usage limits; if one is hit, work resumes from the same checkpoint after the reset, without duplicate workers. Waiting for Peter is not permission to continue automatically.

### Required review gates

1. **Scope approval and early previews:** proposals are not requirements until Peter agrees in the **analysis review OWNER task**, which stays Done after approval. For approved feature work, create a feature branch and draft PR as soon as a meaningful first commit is available. Push checked increments throughout development so Peter can follow the Cloudflare branch preview. Draft publication and preview updates are authorized by this workflow; they are not owner acceptance, independent QA, merge, or production-release approval. Keep the PR draft until review gates pass.
2. **Peter's development review before QA:** use a **separate development review OWNER task**, In Review and assigned Peter when actionable. Dev supplies a short change summary, linked issue/PR or exact revision, a runnable demo/preview when available (screenshots when useful), and developer test/build results with limitations. Peter explicitly approves that revision for QA, or requests changes.
3. **Independent QA:** the tester may prepare a test plan beforehand, but must not start independent acceptance testing of delivered work until Peter's approval is recorded. Dev's unit tests, build checks, and automated CI are allowed before this gate; they do not replace QA.
4. **Rework:** implementation changes after Peter's approval, including QA fixes, return through Peter's review before independent QA/retesting. Record the approved revision so old approval is not applied to new code.
5. **Coverage decision and final handoff:** retain all raw failures and disclose unverified scope. If a decision is needed, reopen the **development review** task and assign Peter; acceptance applies only to that revision and those limits. Complete verified child tasks and mark the PR ready only after the review, QA and coverage gates are settled. Then move the feature from **In Progress/unassigned** to **In Review/assigned Peter** for his final PR review and merge, without a third owner review task.
6. **Release approval:** Peter's approval to start QA or accept coverage limits is **not** approval to merge or deploy. Merge/release requires separate explicit authorization. If merging triggers Cloudflare production deployment, merge is also a release decision. Close the feature only after live release verification.

Record approval in the relevant issue/PR comment (for example, `Peter: approved revision <commit> for QA`) or in this team's chat, with a concise attributed record linked to the issue. GitHub credentials are currently shared through Peter's account, so a self-approval restriction must not be bypassed or treated as approval; a clear owner decision is required. These are team operating rules, not yet technically enforced branch-protection or CI gates.

## Work tracking: Jira and GitHub

- New planning, agent-owned tasks, decisions and verification evidence live in [Jira project SCRUM](https://project-22.atlassian.net/jira/software/projects/SCRUM/boards/1). Code, commits, pull requests and Cloudflare build checks stay in this GitHub repository. The original GitHub issue history remains intact; its Jira copy is historical, not automatic two-way synchronization.
- Use native feature/child relationships and explicit Developer, Analyst, Tester or Peter ownership. Agent-owner metadata is separate from the authenticated Jira author and does not automatically launch a Hermes worker. Do not use an unassignable service account as an assignee; preserve owner labels/descriptions until the shared Agent owner dropdown is available.
- Keep scope, acceptance criteria, dependencies and evidence concise. Comment only for decisions, blockers, handoffs, approvals and verified results; identify the acting participant. Dev reads back evidence before closing work.
- Current feature: [SCRUM-36](https://project-22.atlassian.net/browse/SCRUM-36), responsive menu scrolling, compact bear header and favicon. Analysis review [SCRUM-41](https://project-22.atlassian.net/browse/SCRUM-41) is approved; development review is separate in [SCRUM-44](https://project-22.atlassian.net/browse/SCRUM-44); [SCRUM-42](https://project-22.atlassian.net/browse/SCRUM-42) owns independent QA. The earlier eight-level contract remains in [development scope](docs/level-progression.md); its acceptance does not accept this new visual feature.
- Creating or assigning a Jira item does not itself approve unresolved product rules, start acceptance QA, or authorize code publication, merges, cloud provisioning or production deployment. The owner-before-QA and separate-release gates above remain unchanged; checked draft PR/feature preview publication follows the approved early-preview workflow.

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
npm run format:check
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run deploy:check
```

Code is formatted with Prettier (pinned dev dependency; `.prettierrc.json`, 100-character lines). Run `npm run format` before committing; `format:check` must pass. Markdown docs, generated output and Cloudflare config are excluded in `.prettierignore`. The one-time reformat commit is listed in `.git-blame-ignore-revs`; use `git config blame.ignoreRevsFile .git-blame-ignore-revs` for useful blame.

Code is linted with oxlint (pinned dev dependency; `.oxlintrc.json`): correctness rules, TypeScript and React rules, React hook rules and unused variables/imports, all as errors. `npm run lint` must pass with zero findings. If a rule conflicts with intended behaviour, keep the code and add `// oxlint-disable-next-line <rule> -- <reason>`; never change hook dependencies without a test proving behaviour is unchanged.

The browser smoke test starts/stops a local production preview automatically. On Linux, Playwright may require OS browser dependencies; install them through your administrator if the browser reports missing libraries. `deploy:check` is a Wrangler dry run, not a cloud deployment. These are developer checks, not independent QA signoff. Developer browser tests complete real sessions on every level, cover 5/10/20 exercise counts, language switching, modal keyboard focus and a 320px Slovak layout. Unit/component tests cover the pure math engine, invalid input versus wrong answers, retries, exact session completion, first-try counts, language state and leave confirmation. This is developer verification, not independent QA or a complete accessibility audit. Developer checks also cover hint formulas for each operator/blank, zero/boundary values, decomposition, stage/language preservation, hint-assisted scoring, review requeueing and narrow layouts. Developer checks also cover neutral/error/success control colours, bear expressions, reduced motion, opt-in native Web Audio, mute, blocked audio and duplicate-submission suppression.

Dependencies are pinned. npm 11 install-script approvals are limited to the locked esbuild/workerd versions in package.json. Do not broadly approve unrelated dependency scripts. `npm audit` can be run to check the current dependency advisories.

## Cloudflare connection settings

`wrangler.jsonc` is the canonical configuration and includes the required `previews: {}` block for branch previews. `wrangler.toml` is an equivalent alternative; keep both in sync and use `--config wrangler.toml` to select TOML explicitly (Wrangler otherwise discovers JSONC first). Both enable persistent invocation logs with `observability.logs.enabled`, `invocation_logs` and `persist` set to `true`. Preview observability uses the top-level settings unless explicitly overridden. These are runtime/request logs, not browser audio logs or build logs; do not log children's answers or personal data. Cloudflare log retention/usage follows the account plan.

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
