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
import SummaryView from './SummaryView';
import { useMenuLayout } from './useMenuLayout';
import { useFeedbackAudio } from './useFeedbackAudio';
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
  const [session, setSession] = useState<Session | null>(null);
  // Course screen state: null is the course choice. Nothing is stored between visits.
  const [course, setCourse] = useState<Course | null>(null);
  const [englishLevel, setEnglishLevel] = useState<EnglishLevel>(1);
  const [englishSize, setEnglishSize] = useState(10);
  const menuRef = useMenuLayout(!session, language, level, course ?? 'choice');
  const menuHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusMenuHeading = useRef(false);
  const navigate = (next: Course | null) => {
    focusMenuHeading.current = true;
    setCourse(next);
  };
  // Move focus to the new screen's heading after course navigation (not on first load).
  useEffect(() => {
    if (!focusMenuHeading.current) return;
    focusMenuHeading.current = false;
    menuHeadingRef.current?.focus();
  }, [course]);
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
  } = useFeedbackAudio(session?.feedback, session?.attempts, session?.done);
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
  const requestLeave = () => {
    if (settingsOpen || hintOpen || leaveOpen) return;
    if (session && hasProgress(session, answer)) setLeaveOpen(true);
    else setSession(null);
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
  const current = session ? currentExercise(session) : undefined;
  const pictureTheme =
    session && current
      ? PICTURE_THEMES[session.exercises.indexOf(current) % PICTURE_THEMES.length]
      : PICTURE_THEMES[0];
  const start = () => {
    resetForNewSession();
    void activateSound();
    setAnswer('');
    setSession(createSession(generateSession(level, size)));
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    void activateSound();
    setSession((previous) => previous && submitAnswer(previous, answer));
  }
  const next = () => {
    void activateSound();
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

  return (
    <div
      className={`app-shell ${!session ? 'menu-shell' : ''} ${compact && session && !session.done ? 'compact-practice' : ''}`}
    >
      {session && !session.done && (
        <progress
          className="viewport-progress"
          aria-label={t.trail}
          max={session.exercises.length}
          value={progressValue(session)}
        />
      )}
      <header className="site-header" inert={leaveOpen || hintOpen || settingsOpen}>
        {session && (
          <button
            className="corner-button back-button"
            aria-label={t.back}
            onClick={session.done ? () => setSession(null) : requestLeave}
          >
            <span aria-hidden="true">←</span>
          </button>
        )}
        <div className="wordmark">
          <h1 className="sr-only">Bearmatics</h1>
        </div>
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
      </header>
      <main
        ref={menuRef}
        className={`workspace ${session ? 'in-session' : ''}`}
        inert={leaveOpen || hintOpen || settingsOpen}
      >
        <aside className="companion">
          <div className="bear-scene">
            <span className="scene-ring" />
            <Bear
              idleWink={!session}
              key={`${session?.done}:${session?.feedback}:${session?.attempts}`}
              mood={bearMood(session)}
            />
            <span className="scene-leaf leaf-one" />
            <span className="scene-leaf leaf-two" />
          </div>
        </aside>
        {!session ? (
          course === 'math' ? (
            <LevelMenu
              t={t}
              headingRef={menuHeadingRef}
              onBack={() => navigate(null)}
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
              onBack={() => navigate(null)}
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
            onAgain={start}
            onBack={() => setSession(null)}
          />
        ) : (
          current && (
            <PracticeView
              t={t}
              level={level}
              current={current}
              pictureTheme={pictureTheme}
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
            setSession(null);
          }}
        />
      )}
    </div>
  );
}
