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
  const [englishSession, setEnglishSession] = useState<Session<WordQuestion> | null>(null);
  const [choice, setChoice] = useState('');
  // English level 3 (listen and write).
  const [writeSession, setWriteSession] = useState<Session<WriteQuestion> | null>(null);
  const [written, setWritten] = useState('');
  const [writeNote, setWriteNote] = useState<'empty' | 'letters' | null>(null);
  const writeInputRef = useRef<HTMLInputElement>(null);
  const keyboard = useKeyboardViewport(writeInputRef, !!writeSession && !writeSession.done);
  // What started the current sound: the speaker or one word button. Only that control animates,
  // so playing the target never highlights its button and a word tap never animates the speaker.
  const [playSource, setPlaySource] = useState<string | null>(null);
  const words = useWordPlayer();
  // The practice on screen, maths or English: drives bear, progress, Back and feedback sounds.
  const active: Session<unknown> | null = session ?? englishSession ?? writeSession;
  const menuRef = useMenuLayout(!active, language, level, course ?? 'choice');
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
  } = useFeedbackAudio(active?.feedback, active?.attempts, active?.done);
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
    words.stop();
    setSession(null);
    setEnglishSession(null);
    setWriteSession(null);
    setWritten('');
    setWriteNote(null);
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
  // English: the Start/Next tap is the gesture that lets the new word play straight away.
  const startEnglish = () => {
    if (englishLevel === 3) {
      resetForNewSession();
      void activateSound();
      setWritten('');
      setWriteNote(null);
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
    if (checked.feedback === 'incorrect') setWritten('');
  };
  const nextWrite = () => {
    if (!writeSession) return;
    void activateSound();
    const following = advance(writeSession);
    setWriteSession(following);
    setWritten('');
    setWriteNote(null);
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

  return (
    <div
      className={`app-shell ${!active ? 'menu-shell' : ''} ${compact && active && !active.done ? 'compact-practice' : ''}`}
    >
      {active && !active.done && (
        <progress
          className="viewport-progress"
          aria-label={session ? t.trail : t.englishTrail}
          max={active.exercises.length}
          value={progressValue(active)}
        />
      )}
      <header className="site-header" inert={leaveOpen || hintOpen || settingsOpen}>
        {active && (
          <button
            className="corner-button back-button"
            aria-label={t.back}
            onClick={active.done ? endPractice : requestLeave}
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
        className={`workspace ${active ? 'in-session' : ''}`}
        inert={leaveOpen || hintOpen || settingsOpen}
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
              finishedLabel={t.englishFinished}
              total={writeSession.exercises.length}
              firstTry={writeSession.firstTry}
              headingRef={summaryRef}
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
        ) : !session ? (
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
            setChoice('');
            endPractice();
          }}
        />
      )}
    </div>
  );
}
