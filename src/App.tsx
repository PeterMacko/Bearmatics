import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
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
import {
  clearLessonStart,
  lessonTimeText,
  measureLessonTime,
  startLessonClock,
} from './lessonTime';
import { nextLabel, positionText } from './lesson/lessonText';
import { useMenuLayout } from './useMenuLayout';
import { MATH_LEVELS, menuLevels, SMALL_MATH_LEVELS, shownLevel } from './courses';
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
  ARROW_LIMIT,
  bearChecker,
  encodeArrows,
  generateBearSession,
  generateStoneSession,
  LOGIC_LEVELS,
  type Arrow,
  type BearPuzzle,
  type LogicLevel,
} from './logic/bearPath';
import LogicPracticeView from './logic/LogicPracticeView';
import PatternPracticeView from './logic/PatternPracticeView';
import {
  checkPattern,
  generatePatternSession,
  PATTERN_LEVELS,
  type PatternLevel,
  type PatternRow,
} from './logic/patterns';
import { demoSeen, markDemoSeen } from './demoSeen';
import {
  generateSearchLesson,
  SEARCH_LEVELS,
  type Cell,
  type SearchLevel,
} from './wordsearch/grid';
import {
  asSession,
  createSearchLesson,
  currentPuzzle,
  findWord,
  nextPuzzle,
  tapCell,
  wrongTry,
  type SearchLesson,
} from './wordsearch/lesson';
import WordSearchView from './wordsearch/WordSearchView';
import { PickAgeScreen, PickNextScreen } from './bearPicks/BearPicksScreens';
import { pickAnother, pickGame, type Game } from './bearPicks/picker';
import { readBearPicks, writeBearPicks, type PickSize } from './bearPicks/storage';
import { AccountButton } from './AccountButton';
import AccountScreens from './account/AccountScreens';
import { useAccount, useAccountLoad } from './account/useAccount';
import StreakChip from './progress/StreakChip';
import StreakOffer from './progress/StreakOffer';
import LeaderboardDialog from './progress/LeaderboardDialog';
import SummaryStreak from './progress/SummaryStreak';
import BadgeButton from './progress/BadgeButton';
import SummaryPoints, { SignInHint } from './progress/SummaryPoints';
import { staticFrame } from './progress/animation';
import { useLessonPoints } from './progress/useLessonPoints';
import {
  MAX_HINT_STAGE,
  advance,
  bearMood,
  clearFeedback,
  createSession,
  currentExercise,
  hasProgress,
  nextHintStage,
  openHintStage,
  progressValue,
  submitAnswer,
  type Session,
} from './session';

/** The lesson on screen, whichever kind (maths, listen, write). */
type LessonKind = {
  session: Session<unknown>;
  /** What the child has typed or chosen (unsent work counts for the leave question). */
  answer: string;
  /** Name of the top progress bar. */
  trail: string;
  eyebrow?: string;
  finishedLabel?: string;
  onAgain: () => void;
  practice: () => ReactNode;
};

/** SCRUM-309: a lesson started by "Bear picks a game" (its level and exercise count). */
type PickStart = { level: number; size: number };

/** `startLanguage`: the language the app opens in (`/?lang=sk|en` from the About page, SCRUM-218). */
export default function App({ startLanguage = 'en' }: { startLanguage?: Language } = {}) {
  const [language, setLanguage] = useState<Language>(startLanguage);
  const [level, setLevel] = useState<Level>(1);
  const [size, setSize] = useState(10);
  // Small maths (SCRUM-141) keeps its own choice while the app is open.
  const [smallLevel, setSmallLevel] = useState<Level>(SMALL_MATH_LEVELS[0].value);
  const [smallSize, setSmallSize] = useState(10);
  const [session, setSession] = useState<Session | null>(null);
  // Course screen state: null is the course choice. Nothing is stored between visits.
  const [course, setCourse] = useState<Course | null>(null);
  // SCRUM-309 "Bear picks a game": the mode's screen (age or next game) with the game shown and
  // when the screen appeared (double-tap guard); the child's age and exercise count (device
  // storage); the game of the lesson running in the mode, and the last finished one.
  const [pick, setPick] = useState<{
    screen: 'age' | 'next';
    game: Game | null;
    shownAt: number;
  } | null>(null);
  const [pickAge, setPickAge] = useState<number | null>(null);
  const [pickSize, setPickSize] = useState<PickSize>(5);
  const [pickLesson, setPickLesson] = useState<Game | null>(null);
  const pickLast = useRef<Game | null>(null);
  // When Stop led to the course choice (QA321-01): the rest of its double tap must not open
  // the course card that sits where Stop was.
  const [courseSettleAt, setCourseSettleAt] = useState<number | null>(null);
  // The maths lesson's level as shown in its course menu (Small maths or Maths).
  const [mathShown, setMathShown] = useState(1);
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
  // SCRUM-262: Logic course, level 1 (bear goes to the honey). The planned arrows are unsent
  // work (leave question); `demoRun` is non-zero while the picture demo shows.
  const [logicSize, setLogicSize] = useState(10);
  // SCRUM-289: Level 2 "Around the stones". The lesson keeps the level it started with.
  // SCRUM-299: Levels 3-5 "What comes next?" picture patterns (their own session and screen).
  const [logicLevel, setLogicLevel] = useState<LogicLevel | PatternLevel>(1);
  const [logicLessonLevel, setLogicLessonLevel] = useState<LogicLevel>(1);
  const [logicSession, setLogicSession] = useState<Session<BearPuzzle> | null>(null);
  const [patternSession, setPatternSession] = useState<Session<PatternRow> | null>(null);
  const [logicArrows, setLogicArrows] = useState<Arrow[]>([]);
  const [demoRun, setDemoRun] = useState(0);
  const demoCount = useRef(0);
  const showDemo = () => setDemoRun(++demoCount.current);
  // SCRUM-241: Word search. The lesson keeps its own state; `searchSession` is its Session shape
  // for the bar, bear, leave question, summary and points.
  const [searchLevel, setSearchLevel] = useState<SearchLevel>(1);
  const [searchSize, setSearchSize] = useState(10);
  const [searchLesson, setSearchLessonState] = useState<SearchLesson | null>(null);
  // The latest lesson for tap handlers: two taps in one batch (before a render) still see each
  // other, so a quick first + last tap always counts as a pair.
  const searchRef = useRef<SearchLesson | null>(null);
  const setSearchLesson = (next: SearchLesson | null) => {
    searchRef.current = next;
    setSearchLessonState(next);
  };
  const searchSession = useMemo(() => searchLesson && asSession(searchLesson), [searchLesson]);
  // The practice on screen, maths or English: drives bear, progress, Back and feedback sounds.
  const active: Session<unknown> | null =
    session ?? englishSession ?? writeSession ?? logicSession ?? patternSession ?? searchSession;
  // Set on every screen change: the new screen's heading takes focus (effect below).
  const focusMenuHeading = useRef(false);
  // Optional account (SCRUM-97). Everything works signed out; the server may be missing.
  const accountState = useAccount(() => {
    focusMenuHeading.current = true;
  });
  const {
    account,
    setAccount,
    accountKnown,
    accountScreen,
    privacyFrom,
    accountNotice,
    googleReady,
    openAccount,
  } = accountState;
  const menuRef = useMenuLayout(
    !active && !accountScreen && !pick,
    language,
    level,
    course ?? 'choice',
  );
  const menuHeadingRef = useRef<HTMLHeadingElement>(null);
  // SCRUM-249: the dress screen open over an account form; Back closes it.
  const [closeSubView, setCloseSubView] = useState<(() => void) | null>(null);
  const onSubView = useCallback((close: (() => void) | null) => setCloseSubView(() => close), []);
  const navigate = (next: Course | null) => {
    focusMenuHeading.current = true;
    setCourse(next);
  };
  const practising = !!active;
  // After navigation (not on first load): the new screen starts at the top, so the bar is in
  // view, and focus moves to its heading (also after leaving a lesson, QA139-01/02).
  useEffect(() => {
    if (!focusMenuHeading.current) return;
    focusMenuHeading.current = false;
    window.scrollTo(0, 0);
    menuHeadingRef.current?.focus({ preventScroll: true });
  }, [course, accountScreen, practising, pick?.screen, pick?.shownAt]);
  useAccountLoad(accountState);
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
    playStep,
    playGrowl,
    // Word search plays a pop and the word for a found word, nothing for a wrong pair (scope 3),
    // so its feedback does not start the answer melodies; the completion fanfare stays.
  } = useFeedbackAudio(
    searchLesson ? undefined : active?.feedback,
    searchLesson ? undefined : active?.attempts,
    active?.done,
  );
  // SCRUM-148: the leaderboard window (from the points + bar button).
  const [boardOpen, setBoardOpen] = useState(false);
  const boardTrigger = useRef<HTMLButtonElement | null>(null);
  const finishedFirstTry = active?.done ? active.firstTry : null;
  const {
    points,
    streak,
    showProgress,
    streakAtStart,
    offer,
    offerOpen,
    closeOffer,
    warming,
    setWarming,
    lessonSave,
    beginLesson,
    saveLesson,
    endLesson,
    newBadge,
    shownFrame,
    nextMultiplier,
  } = useLessonPoints({ account, accountKnown, finishedFirstTry, playBadge });
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
  // Every lesson's typed or chosen answer; each start sets its own again anyway.
  const resetAnswers = () => {
    setAnswer('');
    setChoice('');
    setWritten('');
    setWriteNote(null);
    setWrongAnswer(null);
    setLogicArrows([]);
  };
  // Both ways out of a lesson (Back/summary and the leave dialog) end here.
  const endPractice = () => {
    endLesson();
    clearLessonStart(); // SCRUM-211: leaving a lesson removes its start time
    focusMenuHeading.current = true;
    words.stop();
    setSession(null);
    setEnglishSession(null);
    setWriteSession(null);
    setLogicSession(null);
    setPatternSession(null);
    setSearchLesson(null);
    setDemoRun(0);
    resetAnswers();
    // SCRUM-309: leaving a lesson or its summary ends "Bear picks a game" (Next game opens it
    // again right after this).
    setPick(null);
    setPickLesson(null);
  };
  // What to open after leaving a lesson (the profile button asks like Back, then opens it).
  const afterLeave = useRef<(() => void) | null>(null);
  const requestLeave = (then: (() => void) | null = null) => {
    if (settingsOpen || hintOpen || leaveOpen) return;
    afterLeave.current = then;
    if (lessonKind && hasProgress(lessonKind.session, lessonKind.answer)) setLeaveOpen(true);
    else {
      endPractice();
      then?.();
    }
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
  useEffect(() => {
    if (logicSession?.done) summaryRef.current?.focus();
  }, [logicSession?.done]);
  useEffect(() => {
    if (patternSession?.done) summaryRef.current?.focus();
  }, [patternSession?.done]);
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
  // `pick`: started by "Bear picks a game" with its own level and size (SCRUM-309).
  const start = (pick?: PickStart & { small: boolean }) => {
    const small = pick ? pick.small : course === 'small';
    const lessonLevel = pick ? (pick.level as Level) : small ? smallLevel : level;
    const lessonSize = pick ? pick.size : small ? smallSize : size;
    const shown = shownLevel(small ? SMALL_MATH_LEVELS : MATH_LEVELS, lessonLevel);
    setPresentation((n) => n + 1);
    resetForNewSession();
    void activateSound();
    setAnswer('');
    // SCRUM-211: the first example appears with this tap; a new lesson overwrites the start.
    startLessonClock(lessonSize);
    beginLesson(lessonSize, {
      course: small ? 'small' : 'math',
      level: shown,
      ...(pick && { bearPicks: true }),
    });
    setMathShown(shown);
    setSession(createSession(generateSession(lessonLevel, lessonSize)));
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
  // SCRUM-262: a Logic lesson starts with the picture demo (SCRUM-289: only until it has been
  // seen once on this device), then the first puzzle.
  const startLogic = (pick?: PickStart) => {
    const lessonLevel = pick ? (pick.level as LogicLevel | PatternLevel) : logicLevel;
    const lessonSize = pick ? pick.size : logicSize;
    setPresentation((n) => n + 1);
    resetForNewSession();
    void activateSound();
    startLessonClock(lessonSize);
    beginLesson(lessonSize, {
      course: 'logic',
      level: lessonLevel,
      ...(pick && { bearPicks: true }),
    });
    setLogicArrows([]);
    // SCRUM-289 / SCRUM-299: each game's demo plays until it has been seen to the end once on
    // this device (one shared helper, one flag per game).
    if (demoSeen(lessonLevel >= 3 ? 'patterns' : 'bear-path')) setDemoRun(0);
    else showDemo();
    if (lessonLevel >= 3) {
      setPatternSession(
        createSession(generatePatternSession(lessonLevel as PatternLevel, lessonSize)),
      );
      return;
    }
    setLogicLessonLevel(lessonLevel as LogicLevel);
    setLogicSession(
      createSession(
        lessonLevel === 2 ? generateStoneSession(lessonSize) : generateBearSession(lessonSize),
      ),
    );
  };
  const nextLogic = () => {
    void activateSound();
    setPresentation((n) => n + 1);
    setLogicArrows([]);
    setLogicSession((previous) => previous && advance(previous));
  };
  const logicPuzzle = logicSession ? currentExercise(logicSession) : undefined;
  const patternRow = patternSession ? currentExercise(patternSession) : undefined;
  const choosePattern = (key: string) => {
    void activateSound();
    setPatternSession((previous) => previous && submitAnswer(previous, key, checkPattern));
  };
  const nextPattern = () => {
    void activateSound();
    setPresentation((n) => n + 1);
    setPatternSession((previous) => previous && advance(previous));
  };
  // SCRUM-241: a word search lesson of 5/10/20 words = 1/2/4 new grids.
  const startSearch = (pick?: PickStart) => {
    const lessonLevel = pick ? (pick.level as SearchLevel) : searchLevel;
    const lessonSize = pick ? pick.size : searchSize;
    setPresentation((n) => n + 1);
    resetForNewSession();
    void activateSound();
    words.stop();
    startLessonClock(lessonSize);
    beginLesson(lessonSize, {
      course: 'wordsearch',
      level: lessonLevel,
      ...(pick && { bearPicks: true }),
    });
    setSearchLesson(createSearchLesson(lessonLevel, generateSearchLesson(lessonLevel, lessonSize)));
  };
  /** A found word: a pop (follows Mute) and the word itself (always), from the tap's gesture. */
  const afterSearch = (before: SearchLesson, after: SearchLesson) => {
    if (after === before) return;
    setSearchLesson(after);
    if (after.event === before.event || after.event?.kind !== 'found') return;
    playPop();
    setPlaySource('found');
    void words.play(currentPuzzle(after).words[after.event.word].word);
  };
  const tapSearch = (cell: Cell) => {
    const current = searchRef.current;
    if (!current) return;
    void activateSound();
    afterSearch(current, tapCell(current, cell));
  };
  const nextSearch = () => {
    const current = searchRef.current;
    if (!current) return;
    void activateSound();
    words.stop();
    setPresentation((n) => n + 1);
    setSearchLesson(nextPuzzle(current));
  };
  const searchPuzzle = searchLesson && !searchLesson.done ? currentPuzzle(searchLesson) : null;
  useEffect(() => {
    if (searchPuzzle) words.preload(searchPuzzle.words.map((w) => w.word));
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- preload once per grid
  }, [searchPuzzle]);
  useEffect(() => {
    if (searchLesson?.done) summaryRef.current?.focus();
  }, [searchLesson?.done]);
  // English: the Start/Next tap is the gesture that lets the new word play straight away.
  const startEnglish = (pick?: PickStart) => {
    const lessonLevel = pick ? (pick.level as EnglishLevel) : englishLevel;
    const lessonSize = pick ? pick.size : englishSize;
    startLessonClock(lessonSize);
    beginLesson(lessonSize, {
      course: 'english',
      level: lessonLevel,
      ...(pick && { bearPicks: true }),
    });
    resetForNewSession();
    void activateSound();
    let first: string;
    if (lessonLevel === 3) {
      setWritten('');
      setWriteNote(null);
      setWrongAnswer(null);
      const created = createSession(generateWriteSession(lessonSize));
      setWriteSession(created);
      first = created.exercises[0].target;
    } else {
      setChoice('');
      const created = createSession(generateWordSession(lessonLevel, lessonSize));
      setEnglishSession(created);
      first = created.exercises[0].target;
    }
    setPlaySource('speaker');
    void words.play(first);
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
  // After Next in an English lesson: the new word plays from this tap; the summary is quiet.
  const playFollowing = <E extends { target: string }>(following: Session<E>) => {
    const question = currentExercise(following);
    setPlaySource('speaker');
    if (!following.done && question) void words.play(question.target);
    else words.stop();
  };
  const nextWrite = () => {
    if (!writeSession) return;
    void activateSound();
    const following = advance(writeSession);
    setWriteSession(following);
    setWritten('');
    setWriteNote(null);
    setWrongAnswer(null);
    playFollowing(following);
  };
  const nextWord = () => {
    if (!englishSession) return;
    void activateSound();
    const following = advance(englishSession);
    setEnglishSession(following);
    setChoice('');
    playFollowing(following);
  };

  // SCRUM-309 "Bear picks a game": random games that suit the child's age, one after another.
  const showPick = (screen: 'age' | 'next', game: Game | null) => {
    focusMenuHeading.current = true;
    setPick({ screen, game, shownAt: performance.now() });
  };
  const openBearPicks = () => {
    // A fresh run: the age and count from the device (blocked storage: ask, start at 5).
    const stored = readBearPicks();
    setPickAge(stored.age);
    setPickSize(stored.size);
    pickLast.current = null;
    if (stored.age === null) showPick('age', null);
    else showPick('next', pickGame(stored.age, [], Math.random));
  };
  const choosePickAge = (age: number) => {
    setPickAge(age);
    writeBearPicks({ age, size: pickSize });
    showPick('next', pickGame(age, [pickLast.current], Math.random));
  };
  const choosePickSize = (n: number) => {
    setPickSize(n as PickSize);
    writeBearPicks({ age: pickAge, size: n as PickSize });
  };
  const chooseAnother = () => {
    if (!pick?.game || pickAge === null) return;
    // Same screen (no new heading focus), but a new game under the finger: the guard time
    // restarts, so a double tap picks once in every engine (QA321-04) and cannot start Play.
    setPick({
      ...pick,
      game: pickAnother(pickAge, pick.game, pickLast.current, Math.random),
      shownAt: performance.now(),
    });
  };
  const stopPick = () => {
    focusMenuHeading.current = true;
    setPick(null);
    setCourseSettleAt(performance.now());
  };
  /** Summary "Stop" in the mode: the course choice, guarded like Stop on the next-game screen. */
  const stopPickSummary = () => {
    endPractice();
    setCourseSettleAt(performance.now());
  };
  const playPick = () => {
    const game = pick?.game;
    if (!game) return;
    const at = { level: game.shown, size: pickSize };
    setPick(null);
    setPickLesson(game);
    // Started from this tap (the English word plays from it, as from Start).
    if (game.course === 'small')
      start({
        ...at,
        small: true,
        level: SMALL_MATH_LEVELS.find((l) => l.shown === game.shown)!.value,
      });
    else if (game.course === 'math') start({ ...at, small: false });
    else if (game.course === 'logic') startLogic(at);
    else if (game.course === 'english') startEnglish(at);
    else startSearch(at);
  };
  /** Summary "Next game": the finished game is the last one and stays out of the next pick. */
  const nextPickGame = () => {
    const last = pickLesson;
    endPractice();
    pickLast.current = last;
    if (pickAge === null) showPick('age', null);
    else showPick('next', pickGame(pickAge, [last], Math.random));
  };

  const modalOpen = leaveOpen || hintOpen || settingsOpen || offerOpen || boardOpen;
  // The lesson on screen, whichever kind: one summary, one position text and one Next label.
  const lessonKind: LessonKind | null =
    searchLesson && searchSession
      ? {
          session: searchSession,
          // A first letter tapped is unsent work (the leave question).
          answer: searchLesson.selected ? 'selected' : '',
          trail: t.searchTrail,
          eyebrow: t.searchTrail,
          finishedLabel: t.searchFinished,
          onAgain: startSearch,
          practice: () =>
            searchPuzzle && (
              <WordSearchView
                key={presentation}
                t={t}
                lesson={searchLesson}
                // "1 of 2" stays on one line where the position wraps beside the bear.
                position={`${t.searchPuzzle} ${searchLesson.index + 1}\u00a0${t.of}\u00a0${searchLesson.puzzles.length}`}
                playing={words.playing ? playSource : null}
                playFailed={words.failed}
                nextLabel={
                  searchLesson.index === searchLesson.puzzles.length - 1 ? t.finish : t.searchNext
                }
                nextRef={nextRef}
                onTap={tapSearch}
                onPlay={(index, source) => {
                  setPlaySource(source);
                  void words.play(searchPuzzle.words[index].word);
                }}
                onFoundByLetters={(index) => {
                  const current = searchRef.current;
                  if (!current) return;
                  void activateSound();
                  afterSearch(current, findWord(current, index));
                }}
                onWrongLetter={() => {
                  const current = searchRef.current;
                  if (current) setSearchLesson(wrongTry(current));
                }}
                onRetryPlay={() => void words.retry()}
                onNext={nextSearch}
              />
            ),
        }
      : patternSession
        ? {
            session: patternSession,
            answer: '',
            trail: t.logicTrail,
            eyebrow: t.logicTrail,
            onAgain: startLogic,
            practice: () =>
              patternRow && (
                <PatternPracticeView
                  key={presentation}
                  t={t}
                  row={patternRow}
                  position={positionText(t, patternSession, t.exercise)}
                  reviewing={patternSession.reviewing}
                  solved={patternSession.solved}
                  feedback={patternSession.feedback}
                  nextLabel={nextLabel(t, patternSession)}
                  demoRun={demoRun}
                  nextRef={nextRef}
                  onChoose={choosePattern}
                  onNext={nextPattern}
                  onShowMe={showDemo}
                  onDemoDone={() => {
                    // Played to its end (leaving earlier unmounts it without this call).
                    markDemoSeen('patterns');
                    setDemoRun(0);
                  }}
                />
              ),
          }
        : logicSession
          ? {
              session: logicSession,
              answer: encodeArrows(logicArrows),
              trail: t.logicTrail,
              eyebrow: t.logicTrail,
              onAgain: startLogic,
              practice: () =>
                logicPuzzle && (
                  <LogicPracticeView
                    key={presentation}
                    t={t}
                    puzzle={logicPuzzle}
                    level={logicLessonLevel}
                    maxArrows={ARROW_LIMIT[logicLessonLevel]}
                    first={logicSession.index === 0 && !logicSession.reviewing}
                    position={positionText(t, logicSession, t.exercise)}
                    reviewing={logicSession.reviewing}
                    solved={logicSession.solved}
                    feedback={logicSession.feedback}
                    arrows={logicArrows}
                    nextLabel={nextLabel(t, logicSession)}
                    keysActive={!modalOpen}
                    demoRun={demoRun}
                    nextRef={nextRef}
                    onArrowsChange={(next) => {
                      setLogicArrows(next);
                      setLogicSession((previous) => previous && clearFeedback(previous));
                    }}
                    onGo={() => void activateSound()}
                    onWalked={(walked) =>
                      setLogicSession(
                        (previous) =>
                          previous && submitAnswer(previous, walked, bearChecker(logicLessonLevel)),
                      )
                    }
                    onNext={nextLogic}
                    onShowMe={showDemo}
                    onDemoDone={() => {
                      // Played to its end (leaving earlier unmounts it without this call).
                      markDemoSeen('bear-path');
                      setDemoRun(0);
                    }}
                    onStep={playStep}
                  />
                ),
            }
          : writeSession
            ? {
                session: writeSession,
                answer: written,
                trail: t.englishTrail,
                eyebrow: t.englishTrail,
                finishedLabel: t.writeFinished,
                onAgain: startEnglish,
                practice: () =>
                  writeQuestion && (
                    <EnglishWriteView
                      t={t}
                      question={writeQuestion}
                      position={positionText(t, writeSession, t.englishWord)}
                      reviewing={writeSession.reviewing}
                      solved={writeSession.solved}
                      feedback={writeSession.feedback}
                      attempts={writeSession.attempts}
                      wrongAnswer={wrongAnswer}
                      prompt={writeNote}
                      answer={written}
                      playing={!!words.playing && playSource === 'speaker'}
                      playFailed={words.failed}
                      nextLabel={nextLabel(t, writeSession, true)}
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
                  ),
              }
            : englishSession
              ? {
                  session: englishSession,
                  answer: choice,
                  trail: t.englishTrail,
                  eyebrow: t.englishTrail,
                  finishedLabel: t.englishFinished,
                  onAgain: startEnglish,
                  practice: () =>
                    englishQuestion && (
                      <EnglishPracticeView
                        t={t}
                        question={englishQuestion}
                        position={positionText(t, englishSession, t.englishWord)}
                        reviewing={englishSession.reviewing}
                        solved={englishSession.solved}
                        feedback={englishSession.feedback}
                        choice={choice}
                        playing={words.playing ? playSource : null}
                        playFailed={words.failed}
                        nextLabel={nextLabel(t, englishSession, true)}
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
                    ),
                }
              : session
                ? {
                    session,
                    answer,
                    trail: t.trail,
                    onAgain: start,
                    practice: () =>
                      current && (
                        <PracticeView
                          t={t}
                          level={mathShown}
                          current={current}
                          pictureTheme={pictureTheme}
                          presentation={presentation}
                          onPop={playPop}
                          position={positionText(t, session, t.exercise)}
                          reviewing={session.reviewing}
                          solved={session.solved}
                          feedback={session.feedback}
                          nextLabel={nextLabel(t, session)}
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
                      ),
                  }
                : null;

  // A lesson in progress (not its summary): the bar shows no profile, so a child cannot leave
  // the lesson by mistake (SCRUM-133). Back still asks before leaving.
  const inLesson = !!active && !active.done;
  const back: BarBack | null = active
    ? {
        // SCRUM-309: a "Bear picks a game" lesson goes back to the course choice.
        label: pickLesson ? t.backToCourses : t.back,
        onClick: active.done ? endPractice : () => requestLeave(),
      }
    : accountScreen
      ? {
          label: t.account.back,
          // SCRUM-249: on the dress screen Back cancels it (back to the form it came from).
          onClick: () =>
            closeSubView
              ? closeSubView()
              : openAccount(
                  accountScreen === 'privacy'
                    ? privacyFrom
                    : accountScreen === 'signup'
                      ? 'signin'
                      : null,
                ),
        }
      : pick
        ? { label: t.backToCourses, onClick: stopPick }
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
  // SCRUM-211: measured once when the summary appears (a finished session object never changes),
  // so switching language later does not move the time on.
  const doneSession = active?.done ? active : null;
  const lessonTime = useMemo(() => (doneSession ? measureLessonTime() : null), [doneSession]);
  const summaryFooter = accountKnown && !account ? <SignInHint t={t.points} /> : null;
  const summaryStreak =
    account && streak && lessonSave?.state === 'saved' ? (
      <SummaryStreak t={t.points} before={streakAtStart.current} streak={streak} />
    ) : null;

  return (
    <div
      className={`app-shell ${!active && !accountScreen ? 'menu-shell' : ''} ${!active && accountScreen ? 'account-shell' : ''} ${compact && active && !active.done ? 'compact-practice' : ''}`}
    >
      {lessonKind && !lessonKind.session.done && (
        <progress
          className="viewport-progress"
          aria-label={lessonKind.trail}
          max={lessonKind.session.exercises.length}
          value={progressValue(lessonKind.session)}
        />
      )}
      <h1 className="sr-only">Bearmatics</h1>
      <AppBar
        label={t.appBar}
        back={back}
        inert={modalOpen}
        layoutKey={`${language}:${course}:${pick?.screen}:${accountScreen}:${!!active}:${account?.nickname}`}
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
        {/* The same bar on every screen: in a lesson the profile asks first, like Back. */}
        <AccountButton
          t={t.account}
          account={account}
          onClick={() => {
            const open = () => openAccount(account ? 'profile' : 'signin');
            if (inLesson) requestLeave(open);
            else {
              if (active) endPractice(); // the summary: nothing left to lose
              setPick(null); // the profile ends "Bear picks a game" like Stop
              open();
            }
          }}
        />
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
      <main ref={menuRef} className={`workspace ${active ? 'in-session' : ''}`} inert={modalOpen}>
        <aside className="companion">
          <div className="bear-scene">
            <span className="scene-ring" />
            <Bear
              idleWink={!active}
              key={`${active?.done}:${active?.feedback}:${active?.attempts}`}
              mood={bearMood(active)}
              reacting={
                !!active &&
                !active.done &&
                (active.feedback === 'correct' || active.feedback === 'incorrect')
              }
              bubble={t.bearTap}
              onTap={playGrowl}
            />
            <span className="scene-leaf leaf-one" />
            <span className="scene-leaf leaf-two" />
          </div>
        </aside>
        {lessonKind ? (
          lessonKind.session.done ? (
            <SummaryView
              t={t}
              eyebrow={lessonKind.eyebrow}
              finishedLabel={lessonKind.finishedLabel}
              total={lessonKind.session.exercises.length}
              firstTry={lessonKind.session.firstTry}
              headingRef={summaryRef}
              time={lessonTime && lessonTimeText(t.lessonTime, lessonTime)}
              points={summaryPoints}
              footer={summaryFooter}
              streak={summaryStreak}
              onAgain={pickLesson ? nextPickGame : lessonKind.onAgain}
              onBack={pickLesson ? stopPickSummary : endPractice}
              againLabel={pickLesson ? t.bearPicks.nextGame : undefined}
              backLabel={pickLesson ? t.bearPicks.stop : undefined}
            />
          ) : (
            lessonKind.practice()
          )
        ) : accountScreen ? (
          <AccountScreens
            t={t.account}
            screen={accountScreen}
            account={account}
            notice={accountNotice}
            googleReady={googleReady}
            headingRef={menuHeadingRef}
            onAccount={setAccount}
            onOpen={openAccount}
            onSubView={onSubView}
          />
        ) : pick ? (
          pick.screen === 'next' && pick.game && pickAge !== null ? (
            <PickNextScreen
              t={t}
              game={pick.game}
              age={pickAge}
              size={pickSize}
              multiplier={nextMultiplier({ course: pick.game.course, level: pick.game.shown })}
              shownAt={pick.shownAt}
              headingRef={menuHeadingRef}
              onSize={choosePickSize}
              onPlay={playPick}
              onAnother={chooseAnother}
              onStop={stopPick}
              onChangeAge={() => showPick('age', null)}
            />
          ) : (
            <PickAgeScreen
              t={t}
              age={pickAge}
              shownAt={pick.shownAt}
              headingRef={menuHeadingRef}
              onAge={choosePickAge}
            />
          )
        ) : course === 'small' ? (
          <LevelMenu
            t={t}
            levels={menuLevels(t, SMALL_MATH_LEVELS)}
            heading={{ eyebrow: t.smallTrail, title: t.smallChoose, intro: t.smallIntro }}
            startLabel={t.start}
            headingRef={menuHeadingRef}
            level={smallLevel}
            size={smallSize}
            course="small"
            nextMultiplier={(shown) => nextMultiplier({ course: 'small', level: shown })}
            onLevelChange={setSmallLevel}
            onSizeChange={setSmallSize}
            onStart={start}
          />
        ) : course === 'logic' ? (
          <LevelMenu
            t={t}
            className="selection logic-home"
            levels={[...LOGIC_LEVELS, ...PATTERN_LEVELS].map((value) => ({
              value,
              shown: value,
              title: t.logicLevels[value],
              detail: t.logicDetails[value],
            }))}
            heading={{ eyebrow: t.logicTrail, title: t.logicChoose, intro: t.logicIntro }}
            startLabel={t.logicStart}
            startType="button"
            levelName="logic-level"
            sizeName="logic-size"
            headingRef={menuHeadingRef}
            level={logicLevel}
            size={logicSize}
            course="logic"
            nextMultiplier={(shown) => nextMultiplier({ course: 'logic', level: shown })}
            onLevelChange={setLogicLevel}
            onSizeChange={setLogicSize}
            onStart={startLogic}
          />
        ) : course === 'wordsearch' ? (
          <LevelMenu
            t={t}
            className="selection wordsearch-home"
            levels={SEARCH_LEVELS.map((value) => ({
              value,
              shown: value,
              title: t.searchLevels[value],
              detail: t.searchDetails[value],
            }))}
            heading={{ eyebrow: t.searchTrail, title: t.searchChoose, intro: t.searchIntro }}
            startLabel={t.searchStart}
            startType="button"
            levelName="search-level"
            sizeName="search-size"
            headingRef={menuHeadingRef}
            level={searchLevel}
            size={searchSize}
            course="wordsearch"
            nextMultiplier={(shown) => nextMultiplier({ course: 'wordsearch', level: shown })}
            onLevelChange={setSearchLevel}
            onSizeChange={setSearchSize}
            onStart={startSearch}
          />
        ) : course === 'math' ? (
          <LevelMenu
            t={t}
            levels={menuLevels(t, MATH_LEVELS)}
            heading={{ eyebrow: t.trail, title: t.choose, intro: t.intro }}
            startLabel={t.start}
            headingRef={menuHeadingRef}
            level={level}
            size={size}
            course="math"
            nextMultiplier={(shown) => nextMultiplier({ course: 'math', level: shown })}
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
            nextMultiplier={(shown) => nextMultiplier({ course: 'english', level: shown })}
            onLevelChange={setEnglishLevel}
            onSizeChange={setEnglishSize}
            onStart={startEnglish}
          />
        ) : (
          <CourseChoice
            t={t}
            headingRef={menuHeadingRef}
            onChoose={navigate}
            onBearPicks={openBearPicks}
            settleSince={courseSettleAt}
          />
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
          onAbout={(event) => {
            // SCRUM-218: the About page replaces the app; work in a lesson is asked about first.
            if (!inLesson || !lessonKind || !hasProgress(lessonKind.session, lessonKind.answer)) {
              clearLessonStart(); // leaving for the About page leaves the lesson too
              return;
            }
            event.preventDefault();
            const href = event.currentTarget.href;
            setSettingsOpen(false);
            afterLeave.current = () => window.location.assign(href);
            setLeaveOpen(true);
          }}
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
          onStay={() => {
            afterLeave.current = null;
            setLeaveOpen(false);
          }}
          onLeave={() => {
            setLeaveOpen(false);
            endPractice();
            afterLeave.current?.();
            afterLeave.current = null;
          }}
        />
      )}
    </div>
  );
}
