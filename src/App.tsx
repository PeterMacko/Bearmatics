import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { checkAnswer, generateSession, type Level } from './math/engine';
import { copy, type Language } from './i18n';
import Bear from './Bear';
import { PICTURE_THEMES } from './PictureGroup';
import { useCompactPractice, useTouchCapability } from './useCompactPractice';
import HintPanel from './HintPanel';
import HintDialog from './HintDialog';
import LeaveDialog from './LeaveDialog';
import LevelMenu from './LevelMenu';
import PracticeView from './PracticeView';
import SettingsDialog from './SettingsDialog';
import SummaryView from './SummaryView';
import { FeedbackAudio } from './audio';
import { useMenuLayout } from './useMenuLayout';

import type { Session } from './session';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [level, setLevel] = useState<Level>(1);
  const [size, setSize] = useState(10);
  const [session, setSession] = useState<Session | null>(null);
  const menuRef = useMenuLayout(!session, language, level);
  const [answer, setAnswer] = useState('');
  const compact = useCompactPractice();
  const touch = useTouchCapability();
  const [inputMode, setInputMode] = useState<'pad' | 'native'>('native');
  const padMode = touch || inputMode === 'pad';
  const editAnswer = (value: string) => {
    if (!session || session.solved || session.done) return;
    setAnswer(value);
    setSession((previous) =>
      previous && !previous.solved ? { ...previous, feedback: 'ready' } : previous,
    );
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
  const [audio] = useState(() => new FeedbackAudio());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundReady, setSoundReady] = useState(false);
  const desiredSound = useRef(true);
  const readySound = useRef(false);
  const activation = useRef(0);
  const pendingSound = useRef(false);
  const [soundBusy, setSoundBusy] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const lastReaction = useRef('');
  const completionConsumed = useRef(false);
  useEffect(
    () => () => {
      ++activation.current;
      pendingSound.current = false;
      readySound.current = false;
      audio.dispose();
    },
    [audio],
  );
  useEffect(() => {
    const feedback = session?.feedback;
    if (feedback !== 'correct' && feedback !== 'incorrect') {
      lastReaction.current = '';
      return;
    }
    const key = `${feedback}:${session?.attempts}`;
    if (lastReaction.current === key) return;
    lastReaction.current = key;
    if (desiredSound.current && readySound.current && !audio.play(feedback)) {
      readySound.current = false;
      setSoundReady(false);
      setAudioUnavailable(true);
    }
  }, [session?.feedback, session?.attempts, soundEnabled, audio]);
  useEffect(() => {
    if (!session?.done || completionConsumed.current) return;
    // Consume even when muted/blocked/pending: activation must not replay history.
    completionConsumed.current = true;
    if (desiredSound.current && readySound.current && !audio.play('complete')) {
      readySound.current = false;
      setSoundReady(false);
      setAudioUnavailable(true);
    }
  }, [session?.done, audio]);
  // Only invoke synchronously from interaction handlers, never from effects.
  const activateSound = async () => {
    if (!desiredSound.current || readySound.current || pendingSound.current) return;
    const revision = ++activation.current;
    pendingSound.current = true;
    setSoundBusy(true);
    const enabled = await audio.setEnabled(true);
    if (revision !== activation.current) return;
    pendingSound.current = false;
    readySound.current = enabled;
    setSoundReady(enabled);
    setAudioUnavailable(!enabled);
    setSoundBusy(false);
  };
  const toggleSound = () => {
    const target = !desiredSound.current;
    desiredSound.current = target;
    setSoundEnabled(target);
    if (target) void activateSound();
    else {
      ++activation.current;
      pendingSound.current = false;
      readySound.current = false;
      void audio.setEnabled(false);
      setSoundReady(false);
      setSoundBusy(false);
      setAudioUnavailable(false);
    }
  };
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
    if (
      session &&
      (session.index > 0 || session.attempts > 0 || session.hintStage > 0 || answer.trim())
    )
      setLeaveOpen(true);
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
  const current = session
    ? session.reviewing
      ? session.reviewQueue[0]
      : session.exercises[session.index]
    : undefined;
  const pictureTheme =
    session && current
      ? PICTURE_THEMES[session.exercises.indexOf(current) % PICTURE_THEMES.length]
      : PICTURE_THEMES[0];
  const start = () => {
    completionConsumed.current = false;
    lastReaction.current = '';
    void activateSound();
    setAnswer('');
    setSession({
      exercises: generateSession(level, size),
      index: 0,
      firstTry: 0,
      attempts: 0,
      solved: false,
      done: false,
      feedback: 'ready',
      hintStage: 0,
      reviewing: false,
      reviewQueue: [],
    });
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    void activateSound();
    setSession((previous) => {
      if (!previous || previous.solved || previous.done) return previous;
      const result = checkAnswer(
        previous.reviewing ? previous.reviewQueue[0] : previous.exercises[previous.index],
        answer,
      );
      if (result === 'invalid-input') return { ...previous, feedback: 'invalid' };
      const solved = result === 'correct';
      return {
        ...previous,
        solved,
        attempts: previous.attempts + 1,
        firstTry:
          previous.firstTry +
          (solved && !previous.reviewing && previous.attempts === 0 && previous.hintStage === 0
            ? 1
            : 0),
        feedback: result,
      };
    });
  }
  const next = () => {
    void activateSound();
    setHintOpen(false);
    setSession((previous) => {
      if (!previous || !previous.solved || previous.done) return previous;
      const reset = { attempts: 0, hintStage: 0, solved: false, feedback: 'ready' as const };
      if (previous.reviewing) {
        const [reviewed, ...remaining] = previous.reviewQueue;
        const reviewQueue =
          previous.attempts === 1 && previous.hintStage === 0
            ? remaining
            : [...remaining, reviewed];
        return { ...previous, ...reset, reviewQueue, done: reviewQueue.length === 0 };
      }
      const reviewQueue =
        previous.attempts > 1
          ? [...previous.reviewQueue, previous.exercises[previous.index]]
          : previous.reviewQueue;
      if (previous.index === previous.exercises.length - 1)
        return {
          ...previous,
          ...reset,
          reviewQueue,
          reviewing: reviewQueue.length > 0,
          done: reviewQueue.length === 0,
        };
      return { ...previous, ...reset, reviewQueue, index: previous.index + 1 };
    });
    setAnswer('');
  };
  const openHint = () => {
    if (settingsOpen || hintOpen || leaveOpen) return;
    setSession((previous) =>
      previous && !previous.solved && !previous.done && previous.hintStage === 0
        ? { ...previous, hintStage: 1 }
        : previous,
    );
    setHintOpen(true);
  };
  const showHint = () =>
    setSession((previous) => {
      if (!previous || previous.done || previous.solved || previous.hintStage >= 3) return previous;
      return { ...previous, hintStage: previous.hintStage + 1 };
    });

  return (
    <div
      className={`app-shell ${!session ? 'menu-shell' : ''} ${compact && session && !session.done ? 'compact-practice' : ''}`}
    >
      {session && !session.done && (
        <progress
          className="viewport-progress"
          aria-label={t.trail}
          max={session.exercises.length}
          value={
            session.reviewing ? session.exercises.length : session.index + (session.solved ? 1 : 0)
          }
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
              mood={
                session?.done || session?.feedback === 'correct'
                  ? 'happy'
                  : session?.feedback === 'incorrect'
                    ? 'sad'
                    : 'neutral'
              }
            />
            <span className="scene-leaf leaf-one" />
            <span className="scene-leaf leaf-two" />
          </div>
        </aside>
        {!session ? (
          <LevelMenu
            t={t}
            level={level}
            size={size}
            onLevelChange={setLevel}
            onSizeChange={setSize}
            onStart={start}
          />
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
              nextLabel={
                session.reviewing
                  ? session.reviewQueue.length === 1 &&
                    session.attempts === 1 &&
                    session.hintStage === 0
                    ? t.finish
                    : t.next
                  : session.index === session.exercises.length - 1
                    ? session.reviewQueue.length > 0 || session.attempts > 1
                      ? t.reviewStart
                      : t.finish
                    : t.next
              }
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
          nextLabel={session.hintStage >= 3 ? t.allHints : t.nextHint}
          nextDisabled={session.hintStage >= 3}
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
