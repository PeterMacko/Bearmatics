import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { generateSession, type Level } from './math/engine';
import { copy, type Language } from './i18n';
import Bear from './Bear';
import { PICTURE_THEMES } from './PictureGroup';
import { useCompactPractice, useTouchCapability } from './useCompactPractice';
import HintPanel from './HintPanel';
import HintDialog from './HintDialog';
import LeaveDialog from './LeaveDialog';
import CourseChoice, { type Course } from './CourseChoice';
import EnglishHome, { type EnglishLevel } from './EnglishHome';
import LevelMenu from './LevelMenu';
import PracticeView from './PracticeView';
import SettingsDialog from './SettingsDialog';
import AppBar, { type BarBack } from './AppBar';
import SummaryView from './SummaryView';
import { useMenuLayout } from './useMenuLayout';
import { MATH_LEVELS, SMALL_MATH_LEVELS, shownLevel } from './courses';
import EnglishPracticeView from './english/EnglishPracticeView';
import { checkWord, generateWordSession, type WordQuestion } from './english/listen';
import { useWordPlayer } from './english/wordPlayer';
import EnglishWriteView from './english/EnglishWriteView';
import { useKeyboardViewport } from './english/useKeyboardViewport';
import {
  checkWritten,
  generateWriteSession,
  writePrompt,
  type WriteQuestion,
} from './english/write';
import { useFeedbackAudio } from './useFeedbackAudio';
import {
  AccountButton,
  GoogleNewView,
  PrivacyView,
  ProfileView,
  SignInView,
  SignUpView,
  type AccountScreen,
} from './account/AccountViews';
import { googleAvailable, loadAccount, type Account } from './account/api';
import {
  finishLesson,
  loadProgress,
  startLesson,
  type Offer,
  type Progress,
  type Streak,
} from './progress/api';
import StreakChip from './progress/StreakChip';
import StreakOffer from './progress/StreakOffer';
import LeaderboardDialog from './progress/LeaderboardDialog';
import SummaryStreak from './progress/SummaryStreak';
import BadgeButton from './progress/BadgeButton';
import SummaryPoints, { SignInHint, type LessonSave } from './progress/SummaryPoints';
import { pointsFrames, staticFrame, usePointsAnimation } from './progress/animation';
import {
  MAX_HINT_STAGE,
  advance,
  bearMood,
  clearFeedback,
  createSession,
  currentExercise,
  hasProgress,
  nextAction,
  nextHintStage,
  openHintStage,
  progressValue,
  submitAnswer,
  type Session,
} from './session';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [level, setLevel] = useState<Level>(1);
  const [size, setSize] = useState(10);
  // Small maths (SCRUM-141) keeps its own choice while the app is open.
  const [smallLevel, setSmallLevel] = useState<Level>(SMALL_MATH_LEVELS[0].value);
  const [smallSize, setSmallSize] = useState(10);
  const [session, setSession] = useState<Session | null>(null);
  // Course screen state: null is the course choice. Nothing is stored between visits.
  const [course, setCourse] = useState<Course | null>(null);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(1);
  const [englishSize, setEnglishSize] = useState(10);
  const [englishSession, setEnglishSession] = useState<Session<WordQuestion> | null>(null);
  const [choice, setChoice] = useState('');
  // English level 3 (listen and write).
  const [writeSession, setWriteSession] = useState<Session<WriteQuestion> | null>(null);
  const [written, setWritten] = useState('');
  const [writeNote, setWriteNote] = useState<'empty' | 'letters' | null>(null);
  const [wrongAnswer, setWrongAnswer] = useState<string | null>(null);
  const writeInputRef = useRef<HTMLInputElement>(null);
  const keyboard = useKeyboardViewport(writeInputRef, !!writeSession && !writeSession.done);
  // What started the current sound: the speaker or one word button. Only that control animates,
  // so playing the target never highlights its button and a word tap never animates the speaker.
  const [playSource, setPlaySource] = useState<string | null>(null);
  const words = useWordPlayer();
  // The practice on screen, maths or English: drives bear, progress, Back and feedback sounds.
  const active: Session<unknown> | null = session ?? englishSession ?? writeSession;
  // Optional account (SCRUM-97). Everything works signed out; the server may be missing.
  const [account, setAccount] = useState<Account | null>(null);
  // False until the first /api/me answer: a lesson started before it waits for the answer.
  const [accountKnown, setAccountKnown] = useState(false);
  const [accountScreen, setAccountScreen] = useState<AccountScreen | null>(null);
  const [privacyFrom, setPrivacyFrom] = useState<AccountScreen | null>(null);
  const [accountNotice, setAccountNotice] = useState('');
  const [googleReady, setGoogleReady] = useState(false);
  const menuRef = useMenuLayout(!active && !accountScreen, language, level, course ?? 'choice');
  const menuHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusMenuHeading = useRef(false);
  const navigate = (next: Course | null) => {
    focusMenuHeading.current = true;
    setCourse(next);
  };
  const openAccount = (next: AccountScreen | null, notice = '') => {
    focusMenuHeading.current = true;
    if (next === 'privacy') setPrivacyFrom(accountScreen);
    setAccountNotice(notice);
    setAccountScreen(next);
  };
  const practising = !!active;
  // After navigation (not on first load): the new screen starts at the top, so the bar is in
  // view, and focus moves to its heading (also after leaving a lesson, QA139-01/02).
  useEffect(() => {
    if (!focusMenuHeading.current) return;
    focusMenuHeading.current = false;
    window.scrollTo(0, 0);
    menuHeadingRef.current?.focus({ preventScroll: true });
  }, [course, accountScreen, practising]);
  useEffect(() => {
    let live = true;
    loadAccount()
      .then(
        (found) => live && setAccount(found),
        () => {},
      )
      .finally(() => live && setAccountKnown(true));
    googleAvailable().then(
      (ready) => live && setGoogleReady(ready),
      () => {},
    );
    // Result of a Google sign-in round trip: /?account=<result>. Remove it from the address.
    const result = new URLSearchParams(window.location.search).get('account');
    if (result) {
      window.history.replaceState(null, '', window.location.pathname);
      if (result === 'google-new') setAccountScreen('google-new');
      else if (result !== 'signed-in') {
        setAccountScreen('signin');
        setAccountNotice(result);
      }
    }
    return () => {
      live = false;
    };
  }, []);
  const [answer, setAnswer] = useState('');
  const compact = useCompactPractice();
  const touch = useTouchCapability();
  const [inputMode, setInputMode] = useState<'pad' | 'native'>('native');
  const padMode = touch || inputMode === 'pad';
  const editAnswer = (value: string) => {
    if (!session || session.solved || session.done) return;
    setAnswer(value);
    setSession((previous) => previous && clearFeedback(previous));
  };
  const padEdit = (key: string) => {
    editAnswer(
      key === 'clear' ? '' : key === 'backspace' ? answer.slice(0, -1) : (answer + key).slice(0, 3),
    );
  };
  const handleAnswerKey = (event: KeyboardEvent<HTMLElement>) => {
    if (
      !padMode ||
      session?.solved ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.nativeEvent.isComposing
    )
      return;
    if (/^[0-9]$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      padEdit(
        event.key === 'Backspace' ? 'backspace' : event.key === 'Delete' ? 'clear' : event.key,
      );
    }
  };
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);
  const {
    soundEnabled,
    soundReady,
    soundBusy,
    audioUnavailable,
    activateSound,
    toggleSound,
    resetForNewSession,
    playBadge,
    playPop,
  } = useFeedbackAudio(active?.feedback, active?.attempts, active?.done);
  // Points (SCRUM-117): signed-in players only; null while unknown or signed out.
  const [points, setPoints] = useState<number | null>(null);
  // Streak (SCRUM-118): shown next to the badge; null while unknown or signed out.
  const [streak, setStreak] = useState<Streak | null>(null);
  const [offer, setOffer] = useState<{ offer: Offer; points: number } | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [warming, setWarming] = useState(false);
  // SCRUM-148: the leaderboard window (from the points + bar button).
  const [boardOpen, setBoardOpen] = useState(false);
  const boardTrigger = useRef<HTMLButtonElement | null>(null);
  // The streak number shown when the lesson started (the summary switches from it).
  const streakAtStart = useRef<number | null>(null);
  const showProgress = (progress: Progress) => {
    setPoints(progress.points);
    setStreak({ streak: progress.streak, frozen: progress.frozen, today: progress.today });
  };
  const accountId = account ? `${account.kind}:${account.username ?? account.nickname}` : null;
  useEffect(() => {
    if (!accountId) {
      setPoints(null);
      setStreak(null);
      return;
    }
    let live = true;
    loadProgress().then(
      (found) => live && showProgress(found),
      () => {},
    );
    return () => {
      live = false;
    };
  }, [accountId]);
  // The running lesson. Its server ID is requested at Start when the player is signed in; a
  // lesson started before the account has loaded asks for it as soon as the account is known.
  type Lesson = {
    size: number;
    id: Promise<string | null>;
    saved: boolean;
    /** The account turned out to be signed out: nothing to save. */
    signedOut: boolean;
    /** A finish request was sent and its answer was lost, so "already counted" is expected. */
    retried: boolean;
    earned: number;
  };
  const lesson = useRef<Lesson | null>(null);
  const waitingStart = useRef<((id: string | null) => void) | null>(null);
  const [lessonSave, setLessonSave] = useState<LessonSave | null>(null);
  const beginLesson = (lessonSize: number) => {
    streakAtStart.current = streak ? streak.streak : null;
    setLessonSave(null);
    closeOffer();
    waitingStart.current = null;
    const fresh: Lesson = {
      size: lessonSize,
      id: Promise.resolve(null),
      saved: false,
      signedOut: false,
      retried: false,
      earned: 0,
    };
    if (account) fresh.id = startLesson(lessonSize).catch(() => null);
    else if (!accountKnown)
      fresh.id = new Promise((resolve) => {
        waitingStart.current = resolve;
      });
    else fresh.signedOut = true;
    lesson.current = fresh;
  };
  useEffect(() => {
    const resolve = waitingStart.current;
    const current = lesson.current;
    if (!accountKnown || !resolve || !current) return;
    waitingStart.current = null;
    if (account) startLesson(current.size).then(resolve, () => resolve(null));
    else {
      current.signedOut = true;
      resolve(null);
    }
  }, [accountKnown, account]);
  const saveLesson = async (firstTry: number) => {
    const current = lesson.current;
    if (!current || current.signedOut) return;
    current.earned = Math.min(firstTry, current.size);
    setLessonSave({ state: 'saving' });
    let sent = false;
    try {
      let id = await current.id;
      if (current.signedOut) {
        if (lesson.current === current) setLessonSave(null);
        return;
      }
      if (!id) {
        id = await startLesson(current.size);
        current.id = Promise.resolve(id);
      }
      sent = true;
      const result = await finishLesson(id, current.size, current.earned);
      // The bar always gets the saved total, also when the child has already left the summary.
      showProgress(result);
      if (lesson.current !== current) return;
      // The unlock offer comes after the summary scene (after the points animation).
      if (result.offer) setOffer({ offer: result.offer, points: result.points });
      // A retry after a lost answer finds the lesson already counted: show what it gave.
      const added = result.added === 0 && current.retried ? current.earned : result.added;
      setLessonSave({ state: 'saved', added, before: result.points - added, after: result.points });
    } catch {
      if (sent) current.retried = true;
      if (lesson.current === current) setLessonSave({ state: 'failed' });
    }
  };
  const finishedFirstTry = active?.done ? active.firstTry : null;
  useEffect(() => {
    // Once per finished lesson (including its review round); leaving early saves nothing.
    const current = lesson.current;
    if (finishedFirstTry === null || !current || current.saved) return;
    current.saved = true;
    summaryShownAt.current = Date.now();
    void saveLesson(finishedFirstTry);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- runs when a lesson finishes
  }, [finishedFirstTry]);
  // Summary animation: the points fill the bar (top bar and summary) once per saved lesson.
  const summaryShownAt = useRef(0);
  const chimeTimer = useRef(0);
  const [newBadge, setNewBadge] = useState(0);
  const animationRun =
    lessonSave?.state === 'saved' && lessonSave.added > 0
      ? {
          key: `${lessonSave.before}:${lessonSave.after}:${summaryShownAt.current}`,
          before: lessonSave.before,
          after: lessonSave.after,
          delay: 700,
        }
      : null;
  const animated = usePointsAnimation(animationRun, (badge) => {
    setNewBadge(badge);
    // The chime never cuts the completion fanfare (about 2 s after the summary appears).
    window.clearTimeout(chimeTimer.current);
    const wait = summaryShownAt.current + 2200 - Date.now();
    if (wait > 0) chimeTimer.current = window.setTimeout(playBadge, wait);
    else playBadge();
  });
  useEffect(() => {
    if (lessonSave?.state !== 'saved') {
      setNewBadge(0);
      window.clearTimeout(chimeTimer.current);
    }
  }, [lessonSave]);
  useEffect(() => () => window.clearTimeout(chimeTimer.current), []);
  // SCRUM-118: open the unlock offer once the points have filled the bar.
  useEffect(() => {
    if (!offer || lessonSave?.state !== 'saved') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fill = pointsFrames(lessonSave.before, lessonSave.after).reduce(
      (sum, f) => sum + f.hold,
      0,
    );
    const wait = reduce ? 900 : (lessonSave.added > 0 ? 700 + fill : 0) + 900;
    const timer = window.setTimeout(() => setOfferOpen(true), wait);
    return () => window.clearTimeout(timer);
  }, [offer, lessonSave]);
  const closeOffer = () => {
    setOfferOpen(false);
    setOffer(null);
  };
  useEffect(() => {
    if (!warming) return;
    const timer = window.setTimeout(() => setWarming(false), 1600);
    return () => window.clearTimeout(timer);
  }, [warming]);
  // Before the first animation frame the bar still shows the old total (no flash of the new one).
  // After the lesson's animation the total can change again (streak unlock pays points):
  // then the bar shows the new total.
  const animating = animationRun !== null && points === animationRun.after;
  const shownFrame = animating
    ? (animated ?? staticFrame(animationRun.before))
    : points === null
      ? null
      : staticFrame(points);
  const inputRef = useRef<HTMLInputElement>(null);
  useLayoutEffect(() => {
    const input = inputRef.current;
    if (padMode && input && document.activeElement === input) {
      input.blur();
      input.focus({ preventScroll: true });
    }
  }, [padMode]);
  const nextRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const t = copy[language];
  const toggleInputMode = () => {
    // Commit readonly before focusing; the editable fallback is a user gesture.
    inputRef.current?.blur();
    flushSync(() => setInputMode(padMode ? 'native' : 'pad'));
    inputRef.current?.focus();
  };
  const endPractice = () => {
    lesson.current = null;
    closeOffer();
    waitingStart.current = null;
    setLessonSave(null);
    focusMenuHeading.current = true;
    words.stop();
    setSession(null);
    setEnglishSession(null);
    setWriteSession(null);
    setWritten('');
    setWriteNote(null);
    setWrongAnswer(null);
  };
  const requestLeave = () => {
    if (settingsOpen || hintOpen || leaveOpen) return;
    if (active && hasProgress(active, session ? answer : writeSession ? written : choice))
      setLeaveOpen(true);
    else endPractice();
  };
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  useEffect(() => {
    if (session?.done) summaryRef.current?.focus();
    else if (session?.solved) nextRef.current?.focus();
    else if (session) inputRef.current?.focus();
    // Move focus only when the exercise, solved or done state changes; depending on the whole
    // session would re-focus on every attempt or hint step.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- intentional partial dependencies (see above)
  }, [session?.index, session?.solved, session?.done]);
  const speakerRef = useRef<HTMLButtonElement>(null);
  const englishQuestion = englishSession ? currentExercise(englishSession) : undefined;
  useEffect(() => {
    if (englishSession?.done) summaryRef.current?.focus();
    else if (englishSession?.solved) nextRef.current?.focus();
    else if (englishSession) speakerRef.current?.focus();
    // Same rule as maths: move focus only on a new question, solved or done.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- intentional partial dependencies (see above)
  }, [englishQuestion, englishSession?.solved, englishSession?.done]);
  useEffect(() => {
    if (!englishSession || !englishQuestion) return;
    // Warm the cache for this question's buttons and the next target.
    const following = englishSession.exercises[englishSession.index + 1];
    words.preload([...englishQuestion.options, ...(following ? following.options : [])]);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- preload once per question
  }, [englishQuestion]);
  const writeQuestion = writeSession ? currentExercise(writeSession) : undefined;
  useEffect(() => {
    if (writeSession?.done) summaryRef.current?.focus();
    // The input keeps focus through the question (Enter checks, then Enter goes on), so an open
    // on-screen keyboard stays open between words.
    else if (writeSession) writeInputRef.current?.focus({ preventScroll: true });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- move focus per question only
  }, [writeQuestion, writeSession?.done]);
  const current = session ? currentExercise(session) : undefined;
  // Counts presentations (new example, review repeat, new lesson): the take-away basket
  // starts full for each (SCRUM-156).
  const [presentation, setPresentation] = useState(0);
  const pictureTheme =
    session && current
      ? PICTURE_THEMES[session.exercises.indexOf(current) % PICTURE_THEMES.length]
      : PICTURE_THEMES[0];
  const start = () => {
    setPresentation((n) => n + 1);
    resetForNewSession();
    void activateSound();
    setAnswer('');
    beginLesson(course === 'small' ? smallSize : size);
    setSession(
      createSession(
        course === 'small' ? generateSession(smallLevel, smallSize) : generateSession(level, size),
      ),
    );
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    void activateSound();
    setSession((previous) => previous && submitAnswer(previous, answer));
  }
  const next = () => {
    void activateSound();
    setPresentation((n) => n + 1);
    setHintOpen(false);
    setSession((previous) => previous && advance(previous));
    setAnswer('');
  };
  const openHint = () => {
    if (settingsOpen || hintOpen || leaveOpen) return;
    setSession((previous) => previous && openHintStage(previous));
    setHintOpen(true);
  };
  const showHint = () => setSession((previous) => previous && nextHintStage(previous));
  // English: the Start/Next tap is the gesture that lets the new word play straight away.
  const startEnglish = () => {
    beginLesson(englishSize);
    if (englishLevel === 3) {
      resetForNewSession();
      void activateSound();
      setWritten('');
      setWriteNote(null);
      setWrongAnswer(null);
      const created = createSession(generateWriteSession(englishSize));
      setWriteSession(created);
      setPlaySource('speaker');
      void words.play(created.exercises[0].target);
      return;
    }
    resetForNewSession();
    void activateSound();
    setChoice('');
    const created = createSession(generateWordSession(englishLevel, englishSize));
    setEnglishSession(created);
    setPlaySource('speaker');
    void words.play(created.exercises[0].target);
  };
  const chooseWord = (word: string) => {
    if (!englishSession || englishSession.solved) return;
    setPlaySource(word);
    void words.play(word);
    setChoice(word);
    setEnglishSession((previous) => previous && clearFeedback(previous));
  };
  const checkChoice = () => {
    void activateSound();
    setEnglishSession((previous) => previous && submitAnswer(previous, choice, checkWord));
  };
  const checkWrite = () => {
    if (!writeSession || writeSession.solved) return;
    void activateSound();
    const note = writePrompt(written);
    setWriteNote(note);
    if (note) return; // empty or not letters: a gentle prompt, not a try
    const checked = submitAnswer(writeSession, written, checkWritten);
    setWriteSession(checked);
    // Wrong: the word is shown; the input clears for writing it once.
    if (checked.feedback === 'incorrect') {
      setWrongAnswer(written.trim());
      setWritten('');
    }
  };
  const nextWrite = () => {
    if (!writeSession) return;
    void activateSound();
    const following = advance(writeSession);
    setWriteSession(following);
    setWritten('');
    setWriteNote(null);
    setWrongAnswer(null);
    const question = currentExercise(following);
    setPlaySource('speaker');
    if (!following.done && question) void words.play(question.target);
    else words.stop();
  };
  const nextWord = () => {
    if (!englishSession) return;
    void activateSound();
    const following = advance(englishSession);
    setEnglishSession(following);
    setChoice('');
    const question = currentExercise(following);
    setPlaySource('speaker');
    if (!following.done && question) void words.play(question.target);
    else words.stop();
  };

  // A lesson in progress (not its summary): the bar shows no profile, so a child cannot leave
  // the lesson by mistake (SCRUM-133). Back still asks before leaving.
  const inLesson = !!active && !active.done;
  const back: BarBack | null = active
    ? { label: t.back, onClick: active.done ? endPractice : requestLeave }
    : accountScreen
      ? {
          label: t.account.back,
          onClick: () =>
            openAccount(
              accountScreen === 'privacy'
                ? privacyFrom
                : accountScreen === 'signup'
                  ? 'signin'
                  : null,
            ),
        }
      : course
        ? { label: t.backToCourses, onClick: () => navigate(null) }
        : null;

  const summaryPoints =
    account && shownFrame ? (
      <SummaryPoints
        t={t.points}
        save={lessonSave}
        frame={shownFrame}
        newBadge={newBadge}
        onRetry={() => active && void saveLesson(active.firstTry)}
      />
    ) : account && lessonSave ? (
      <SummaryPoints
        t={t.points}
        save={lessonSave.state === 'saved' ? null : lessonSave}
        frame={staticFrame(0)}
        newBadge={0}
        onRetry={() => active && void saveLesson(active.firstTry)}
      />
    ) : null;
  const summaryFooter = accountKnown && !account ? <SignInHint t={t.points} /> : null;
  const summaryStreak =
    account && streak && lessonSave?.state === 'saved' ? (
      <SummaryStreak t={t.points} before={streakAtStart.current} streak={streak} />
    ) : null;

  return (
    <div
      className={`app-shell ${!active && !accountScreen ? 'menu-shell' : ''} ${!active && accountScreen ? 'account-shell' : ''} ${compact && active && !active.done ? 'compact-practice' : ''}`}
    >
      {active && !active.done && (
        <progress
          className="viewport-progress"
          aria-label={session ? t.trail : t.englishTrail}
          max={active.exercises.length}
          value={progressValue(active)}
        />
      )}
      <h1 className="sr-only">Bearmatics</h1>
      <AppBar
        label={t.appBar}
        back={back}
        inert={leaveOpen || hintOpen || settingsOpen || offerOpen || boardOpen}
        layoutKey={`${language}:${course}:${accountScreen}:${!!active}:${account?.nickname}`}
      >
        {account && points !== null && shownFrame && (
          <BadgeButton
            t={t.points}
            points={points}
            frame={shownFrame}
            onLeaderboard={(button) => {
              boardTrigger.current = button;
              setBoardOpen(true);
            }}
          />
        )}
        {account && streak && <StreakChip t={t.points} streak={streak} warming={warming} />}
        {!inLesson && (
          <AccountButton
            t={t.account}
            account={account}
            onClick={() => {
              if (active) endPractice(); // only on the summary: nothing left to lose
              openAccount(account ? 'profile' : 'signin');
            }}
          />
        )}
        <button
          ref={settingsRef}
          className="corner-button settings-button"
          type="button"
          aria-label={t.settings}
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={() => {
            if (!hintOpen && !leaveOpen) setSettingsOpen(true);
          }}
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </AppBar>
      <main
        ref={menuRef}
        className={`workspace ${active ? 'in-session' : ''}`}
        inert={leaveOpen || hintOpen || settingsOpen || offerOpen || boardOpen}
      >
        <aside className="companion">
          <div className="bear-scene">
            <span className="scene-ring" />
            <Bear
              idleWink={!active}
              key={`${active?.done}:${active?.feedback}:${active?.attempts}`}
              mood={bearMood(active)}
            />
            <span className="scene-leaf leaf-one" />
            <span className="scene-leaf leaf-two" />
          </div>
        </aside>
        {writeSession ? (
          writeSession.done ? (
            <SummaryView
              t={t}
              eyebrow={t.englishTrail}
              finishedLabel={t.writeFinished}
              total={writeSession.exercises.length}
              firstTry={writeSession.firstTry}
              headingRef={summaryRef}
              points={summaryPoints}
              footer={summaryFooter}
              streak={summaryStreak}
              onAgain={startEnglish}
              onBack={endPractice}
            />
          ) : (
            writeQuestion && (
              <EnglishWriteView
                t={t}
                question={writeQuestion}
                position={
                  writeSession.reviewing
                    ? `${t.review} · ${writeSession.reviewQueue.length} ${t.remaining}`
                    : `${t.englishWord} ${writeSession.index + 1} ${t.of} ${writeSession.exercises.length}`
                }
                reviewing={writeSession.reviewing}
                solved={writeSession.solved}
                feedback={writeSession.feedback}
                attempts={writeSession.attempts}
                wrongAnswer={wrongAnswer}
                prompt={writeNote}
                answer={written}
                playing={!!words.playing && playSource === 'speaker'}
                playFailed={words.failed}
                nextLabel={
                  nextAction(writeSession) === 'next' ? t.englishNext : t[nextAction(writeSession)]
                }
                keyboard={keyboard}
                speakerRef={speakerRef}
                inputRef={writeInputRef}
                onAnswerChange={(value) => {
                  if (writeSession.solved) return;
                  setWritten(value);
                  setWriteNote(null);
                  if (writeSession.feedback !== 'ready')
                    setWriteSession((previous) => previous && clearFeedback(previous));
                }}
                onReplay={() => {
                  setPlaySource('speaker');
                  void words.play(writeQuestion.target);
                }}
                onRetryPlay={() => void words.retry()}
                onCheck={checkWrite}
                onNext={nextWrite}
              />
            )
          )
        ) : englishSession ? (
          englishSession.done ? (
            <SummaryView
              t={t}
              eyebrow={t.englishTrail}
              finishedLabel={t.englishFinished}
              total={englishSession.exercises.length}
              firstTry={englishSession.firstTry}
              headingRef={summaryRef}
              points={summaryPoints}
              footer={summaryFooter}
              streak={summaryStreak}
              onAgain={startEnglish}
              onBack={endPractice}
            />
          ) : (
            englishQuestion && (
              <EnglishPracticeView
                t={t}
                question={englishQuestion}
                position={
                  englishSession.reviewing
                    ? `${t.review} · ${englishSession.reviewQueue.length} ${t.remaining}`
                    : `${t.englishWord} ${englishSession.index + 1} ${t.of} ${englishSession.exercises.length}`
                }
                reviewing={englishSession.reviewing}
                solved={englishSession.solved}
                feedback={englishSession.feedback}
                choice={choice}
                playing={words.playing ? playSource : null}
                playFailed={words.failed}
                nextLabel={
                  nextAction(englishSession) === 'next'
                    ? t.englishNext
                    : t[nextAction(englishSession)]
                }
                speakerRef={speakerRef}
                nextRef={nextRef}
                onReplay={() => {
                  setPlaySource('speaker');
                  void words.play(englishQuestion.target);
                }}
                onRetryPlay={() => void words.retry()}
                onChoose={chooseWord}
                onCheck={checkChoice}
                onNext={nextWord}
              />
            )
          )
        ) : !session && accountScreen ? (
          (() => {
            const common = {
              t: t.account,
              headingRef: menuHeadingRef,
              onPrivacy: () => openAccount('privacy'),
            };
            const signedIn = (found: Account) => {
              setAccount(found);
              openAccount(null);
            };
            // Only known results become text; the address bar can never inject a message.
            const notices: Record<string, string> = {
              'google-unavailable': t.account.errors.googleUnavailable,
              'google-failed': t.account.errors.googleFailed,
              'google-cancelled': t.account.errors.googleFailed,
              'signed-out': t.account.signedOut,
              deleted: t.account.deleted,
            };
            const notice = notices[accountNotice] ?? '';
            if (accountScreen === 'privacy')
              return <PrivacyView t={t.account} headingRef={menuHeadingRef} />;
            if (accountScreen === 'signup') return <SignUpView {...common} onSignedIn={signedIn} />;
            if (accountScreen === 'google-new')
              return <GoogleNewView {...common} onSignedIn={signedIn} />;
            if (accountScreen === 'profile' && account)
              return (
                <ProfileView
                  {...common}
                  account={account}
                  onAccount={setAccount}
                  onSignedOut={(reason) => {
                    setAccount(null);
                    openAccount('signin', reason);
                  }}
                />
              );
            return (
              <SignInView
                {...common}
                googleReady={googleReady}
                notice={notice}
                onCreate={() => openAccount('signup')}
                onSignedIn={signedIn}
              />
            );
          })()
        ) : !session ? (
          course === 'small' ? (
            <LevelMenu
              t={t}
              levels={SMALL_MATH_LEVELS}
              heading={{ eyebrow: t.smallTrail, title: t.smallChoose, intro: t.smallIntro }}
              headingRef={menuHeadingRef}
              level={smallLevel}
              size={smallSize}
              onLevelChange={setSmallLevel}
              onSizeChange={setSmallSize}
              onStart={start}
            />
          ) : course === 'math' ? (
            <LevelMenu
              t={t}
              levels={MATH_LEVELS}
              heading={{ eyebrow: t.trail, title: t.choose, intro: t.intro }}
              headingRef={menuHeadingRef}
              level={level}
              size={size}
              onLevelChange={setLevel}
              onSizeChange={setSize}
              onStart={start}
            />
          ) : course === 'english' ? (
            <EnglishHome
              t={t}
              level={englishLevel}
              size={englishSize}
              headingRef={menuHeadingRef}
              onLevelChange={setEnglishLevel}
              onSizeChange={setEnglishSize}
              onStart={startEnglish}
            />
          ) : (
            <CourseChoice t={t} headingRef={menuHeadingRef} onChoose={navigate} />
          )
        ) : session.done ? (
          <SummaryView
            t={t}
            total={session.exercises.length}
            firstTry={session.firstTry}
            headingRef={summaryRef}
            points={summaryPoints}
            footer={summaryFooter}
            streak={summaryStreak}
            onAgain={start}
            onBack={endPractice}
          />
        ) : (
          current && (
            <PracticeView
              t={t}
              level={course === 'small' ? shownLevel(SMALL_MATH_LEVELS, smallLevel) : level}
              current={current}
              pictureTheme={pictureTheme}
              presentation={presentation}
              onPop={playPop}
              position={
                session.reviewing
                  ? `${t.review} · ${session.reviewQueue.length} ${t.remaining}`
                  : `${t.exercise} ${session.index + 1} ${t.of} ${session.exercises.length}`
              }
              reviewing={session.reviewing}
              solved={session.solved}
              feedback={session.feedback}
              nextLabel={t[nextAction(session)]}
              answer={answer}
              padMode={padMode}
              touch={touch}
              hintOpen={hintOpen}
              inputRef={inputRef}
              nextRef={nextRef}
              hintRef={hintRef}
              onSubmit={submit}
              onAnswerChange={editAnswer}
              onAnswerKey={handleAnswerKey}
              onPadKey={padEdit}
              onNext={next}
              onOpenHint={openHint}
              onToggleInputMode={toggleInputMode}
            />
          )
        )}
      </main>
      {boardOpen && account && (
        <LeaderboardDialog
          t={t.points}
          hidden={!account.leaderboard}
          triggerRef={boardTrigger}
          onClose={() => setBoardOpen(false)}
        />
      )}
      {offerOpen && offer && (
        <StreakOffer
          t={t.points}
          offer={offer.offer}
          points={offer.points}
          onAnswered={showProgress}
          onWarm={() => {
            setWarming(true);
            playBadge();
          }}
          onClose={closeOffer}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          t={t}
          language={language}
          soundEnabled={soundEnabled}
          soundReady={soundReady}
          soundBusy={soundBusy}
          audioUnavailable={audioUnavailable}
          triggerRef={settingsRef}
          onLanguageChange={setLanguage}
          onToggleSound={toggleSound}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {hintOpen && session && current && (
        <HintDialog
          title={t.hint}
          closeLabel={t.closeHint}
          nextLabel={session.hintStage >= MAX_HINT_STAGE ? t.allHints : t.nextHint}
          nextDisabled={session.hintStage >= MAX_HINT_STAGE}
          onClose={() => setHintOpen(false)}
          onNext={showHint}
          triggerRef={hintRef}
        >
          {session.reviewing && <p className="review-note">{t.reviewHelp}</p>}
          <HintPanel exercise={current} stage={session.hintStage} language={language} />
        </HintDialog>
      )}
      {leaveOpen && (
        <LeaveDialog
          t={t}
          onStay={() => setLeaveOpen(false)}
          onLeave={() => {
            setLeaveOpen(false);
            setAnswer('');
            setChoice('');
            endPractice();
          }}
        />
      )}
    </div>
  );
}
