import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { checkAnswer, generateSession, type Level, type Exercise } from './math/engine';
import { copy, type Language } from './i18n';
import Bear from './Bear';
import { useCompactPractice, useTouchCapability } from './useCompactPractice';
import HintPanel from './HintPanel';
import HintDialog from './HintDialog';
import { FeedbackAudio } from './audio';

type Feedback = 'ready' | 'correct' | 'incorrect' | 'invalid';
type Session = { exercises: readonly Exercise[]; index: number; firstTry: number; attempts: number; solved: boolean; done: boolean; feedback: Feedback; hintStage: number; reviewing: boolean; reviewQueue: readonly Exercise[] };
const symbols = { '+': '+', '-': '−', '*': '×', '/': '÷' } as const;

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [level, setLevel] = useState<Level>(1);
  const [size, setSize] = useState(10);
  const [session, setSession] = useState<Session | null>(null);
  const [answer, setAnswer] = useState('');
  const compact = useCompactPractice();
  const touch = useTouchCapability();
  const [inputMode, setInputMode] = useState<'pad' | 'native'>('native');
  const padMode = touch || inputMode === 'pad';
  const editAnswer = (value: string) => {
    if (!session || session.solved || session.done) return;
    setAnswer(value);
    setSession(previous => previous && !previous.solved ? { ...previous, feedback: 'ready' } : previous);
  };
  const padEdit = (key: string) => {
    editAnswer(key === 'clear' ? '' : key === 'backspace' ? answer.slice(0, -1) : (answer + key).slice(0, 3));
  };
  const handleAnswerKey = (event: KeyboardEvent<HTMLElement>) => {
    if (!padMode || session?.solved || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
    if (/^[0-9]$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      padEdit(event.key === 'Backspace' ? 'backspace' : event.key === 'Delete' ? 'clear' : event.key);
    }
  };
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);
  const [audio] = useState(() => new FeedbackAudio());
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundBusy, setSoundBusy] = useState(false);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const lastReaction = useRef('');
  useEffect(() => () => audio.dispose(), [audio]);
  useEffect(() => {
    const feedback = session?.feedback;
    if (feedback !== 'correct' && feedback !== 'incorrect') { lastReaction.current = ''; return; }
    const key = `${feedback}:${session?.attempts}`;
    if (lastReaction.current === key) return;
    lastReaction.current = key;
    if (soundEnabled && !audio.play(feedback)) { setSoundEnabled(false); setAudioUnavailable(true); }
  }, [session?.feedback, session?.attempts, soundEnabled, audio]);
  const toggleSound = async () => {
    setSoundBusy(true);
    const target = !soundEnabled;
    const enabled = await audio.setEnabled(target);
    setSoundEnabled(enabled); setAudioUnavailable(target && !enabled); setSoundBusy(false);
  };
  const dialogRef = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    if (!leaveOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { if (previousFocus?.isConnected) previousFocus.focus(); };
  }, [leaveOpen]);
  const requestLeave = () => {
    if (settingsOpen || hintOpen || leaveOpen) return;
    if (session && (session.index > 0 || session.attempts > 0 || session.hintStage > 0 || answer.trim())) setLeaveOpen(true);
    else setSession(null);
  };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    if (session?.done) summaryRef.current?.focus();
    else if (session?.solved) nextRef.current?.focus();
    else if (session) inputRef.current?.focus();
  }, [session?.index, session?.solved, session?.done]);
  const current = session ? (session.reviewing ? session.reviewQueue[0] : session.exercises[session.index]) : undefined;
  const start = () => {
    setAnswer('');
    setSession({ exercises: generateSession(level, size), index: 0, firstTry: 0, attempts: 0, solved: false, done: false, feedback: 'ready', hintStage: 0, reviewing: false, reviewQueue: [] });
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    setSession(previous => {
      if (!previous || previous.solved || previous.done) return previous;
      const result = checkAnswer(previous.reviewing ? previous.reviewQueue[0] : previous.exercises[previous.index], answer);
      if (result === 'invalid-input') return { ...previous, feedback: 'invalid' };
      const solved = result === 'correct';
      return { ...previous, solved, attempts: previous.attempts + 1, firstTry: previous.firstTry + (solved && !previous.reviewing && previous.attempts === 0 && previous.hintStage === 0 ? 1 : 0), feedback: result };
    });
  }
  const next = () => {
    setHintOpen(false);
    setSession(previous => {
      if (!previous || !previous.solved || previous.done) return previous;
      const reset = { attempts: 0, hintStage: 0, solved: false, feedback: 'ready' as const };
      if (previous.reviewing) {
        const [reviewed, ...remaining] = previous.reviewQueue;
        const reviewQueue = previous.attempts === 1 && previous.hintStage === 0 ? remaining : [...remaining, reviewed];
        return { ...previous, ...reset, reviewQueue, done: reviewQueue.length === 0 };
      }
      const reviewQueue = previous.attempts > 1 ? [...previous.reviewQueue, previous.exercises[previous.index]] : previous.reviewQueue;
      if (previous.index === previous.exercises.length - 1) return { ...previous, ...reset, reviewQueue, reviewing: reviewQueue.length > 0, done: reviewQueue.length === 0 };
      return { ...previous, ...reset, reviewQueue, index: previous.index + 1 };
    });
    setAnswer('');
  };
  const openHint = () => {
    if (settingsOpen || hintOpen || leaveOpen) return;
    setSession(previous => previous && !previous.solved && !previous.done && previous.hintStage === 0 ? { ...previous, hintStage: 1 } : previous);
    setHintOpen(true);
  };
  const showHint = () => setSession(previous => {
    if (!previous || previous.done || previous.solved || previous.hintStage >= 3) return previous;
    return { ...previous, hintStage: previous.hintStage + 1 };
  });
  const equationDescription = current ? `${current.blank === 0 ? t.blank : current.values[0]} ${t.operators[current.operation]} ${current.blank === 1 ? t.blank : current.values[1]} ${t.equals} ${current.blank === 2 ? t.blank : current.values[2]}` : '';

  return <div className={`app-shell ${compact && session && !session.done ? 'compact-practice' : ''}`}>
    {session && !session.done && <progress className="viewport-progress" aria-label={t.trail} max={session.exercises.length} value={session.reviewing ? session.exercises.length : session.index + (session.solved ? 1 : 0)} />}
    <header className="site-header" inert={leaveOpen || hintOpen || settingsOpen}>{session && <button className="corner-button back-button" aria-label={t.back} onClick={session.done ? () => setSession(null) : requestLeave}><span aria-hidden="true">←</span></button>}<div className="wordmark"><span className="brand-mark" aria-hidden="true">b.</span><h1 className="sr-only">Bearmatics</h1></div>
      <button ref={settingsRef} className="corner-button settings-button" type="button" aria-label={t.settings} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => { if (!hintOpen && !leaveOpen) setSettingsOpen(true); }}><span aria-hidden="true">⚙</span></button>
    </header>
    <main className={`workspace ${session ? 'in-session' : ''}`} inert={leaveOpen || hintOpen || settingsOpen}><aside className="companion"><div className="bear-scene"><span className="scene-ring" /><Bear key={`${session?.done}:${session?.feedback}:${session?.attempts}`} mood={session?.done || session?.feedback === 'correct' ? 'happy' : session?.feedback === 'incorrect' ? 'sad' : 'neutral'} /><span className="scene-leaf leaf-one" /><span className="scene-leaf leaf-two" /></div></aside>
      {!session ? <section className="selection"><p className="eyebrow">{t.trail}</p><h2>{t.choose}</h2><p className="intro">{t.intro}</p>
        <fieldset className="level-options"><legend className="sr-only">{t.level}</legend>{([1, 2, 3, 4, 5, 6] as const).map(n => <label className={`level-option level-${n}`} key={n}><input type="radio" name="level" value={n} checked={level === n} onChange={() => setLevel(n)} /><span className="level-number" aria-hidden="true">{n}</span><span><span className="level-title">{t.level} {n} · {t.levels[n - 1]}</span><span className="level-detail">{t.details[n - 1]}</span></span><span className="selection-dot" aria-hidden="true" /></label>)}</fieldset>
        <fieldset className="session-options"><legend>{t.count}</legend>{[5, 10, 20].map(n => <label key={n}><input type="radio" name="size" checked={size === n} onChange={() => setSize(n)} /><span>{n} <span>{t.exercises}</span></span></label>)}</fieldset>
        <button className="primary start-button" onClick={start}>{t.start}<span aria-hidden="true"> →</span></button>
      </section> : session.done ? <section className="summary"><p className="eyebrow">{t.trail}</p><span className="completion-mark" aria-hidden="true">✓</span><h2 ref={summaryRef} tabIndex={-1}>{t.complete}</h2><p className="intro">{t.summary}</p><p className="completed-total">{session.exercises.length} {t.finished}</p><p className="first-try">{t.first} <strong>{session.firstTry} / {session.exercises.length}</strong></p><button className="primary" onClick={start}>{t.again}</button><button className="text-button" onClick={() => setSession(null)}>{t.back}</button></section>
        : current && <section className="practice"><div className="practice-header"><div className="practice-top"><span className="level-pill">{t.level} {level}</span></div><p className="exercise-position" aria-live="polite">{session.reviewing ? `${t.review} · ${session.reviewQueue.length} ${t.remaining}` : `${t.exercise} ${session.index + 1} ${t.of} ${session.exercises.length}`}</p></div><h2>{session.reviewing ? t.reviewTitle : t.ready}</h2>
          <form onSubmit={submit} onKeyDown={event => {
            if (event.key === 'Enter' && event.repeat && (event.target === inputRef.current || (event.target as HTMLElement).classList.contains('answer-button'))) event.preventDefault();
          }} noValidate><div className="equation" data-feedback={session.feedback} role="group" aria-label={equationDescription}>{current.values.map((n, i) => <span className="equation-part" key={i}>{i === 1 && <span className="operator" aria-hidden="true">{symbols[current.operation]}</span>}{i === 2 && <span className="operator" aria-hidden="true">=</span>}<span data-term={i}>{i === current.blank ? <input ref={inputRef} type="text" onKeyDown={handleAnswerKey} readOnly={padMode} inputMode={padMode ? 'none' : 'numeric'} autoComplete="off" aria-label={`${t.missing}, ${t.positions[i]}`} aria-describedby={padMode ? 'answer-feedback answer-instructions' : 'answer-feedback'} aria-invalid={session.feedback === 'invalid' || session.feedback === 'incorrect'} value={answer} disabled={session.solved} onChange={e => editAnswer(e.target.value)} /> : <span aria-hidden="true">{n}</span>}</span></span>)}</div>
            <p id="answer-feedback" className={`feedback feedback-${session.feedback}`} role="status" aria-live="polite" aria-atomic="true">{session.feedback === 'ready' ? '' : t[session.feedback]}</p>
            <span id="answer-instructions" className="sr-only">{t.padInstructions}</span>
            <span className="sr-only" data-testid="answer-announcement" aria-live="polite" aria-atomic="true">{padMode ? `${t.answerLabel}: ${answer || t.emptyAnswer}` : ''}</span>
            {padMode && <div className="number-pad" onKeyDown={handleAnswerKey} role="group" aria-label={t.numberPad}>{['7', '8', '9', '0', '4', '5', '6', 'clear', '1', '2', '3', 'backspace'].map(key => <button key={key} className={key === 'clear' ? 'pad-clear' : undefined} type="button" disabled={session.solved} aria-label={key === 'clear' ? t.clearAnswer : key === 'backspace' ? t.backspace : key} onClick={() => padEdit(key)}>{key === 'clear' ? t.clear : key === 'backspace' ? '⌫' : key}</button>)}</div>}
            <div className="answer-actions">{session.solved ? <button ref={nextRef} type="button" className="primary answer-button" data-state="correct" onClick={event => { event.preventDefault(); next(); }}>{session.reviewing ? (session.reviewQueue.length === 1 && session.attempts === 1 && session.hintStage === 0 ? t.finish : t.next) : session.index === session.exercises.length - 1 ? (session.reviewQueue.length > 0 || session.attempts > 1 ? t.reviewStart : t.finish) : t.next}<span aria-hidden="true"> →</span></button> : <button type="submit" className="primary answer-button" data-state={session.feedback === 'incorrect' ? 'incorrect' : 'neutral'}>{t.check}</button>}
            <button ref={hintRef} type="button" className="hint-button" aria-label={t.showHint} title={t.showHint} aria-haspopup="dialog" aria-controls={hintOpen ? 'hint-dialog' : undefined} aria-expanded={hintOpen} disabled={session.solved} onClick={openHint}><span aria-hidden="true">i</span></button></div>
            {!touch && <div className="practice-tools"><button type="button" className="input-mode-button" disabled={session.solved} onClick={toggleInputMode}>{padMode ? t.useNative : t.usePad}</button></div>}
          </form>
        </section>}
    </main>
    {settingsOpen && <HintDialog titleId="settings-title" title={t.settings} closeLabel={t.closeSettings} onClose={() => setSettingsOpen(false)} triggerRef={settingsRef}>
      <div className="header-controls"><button className="sound-toggle" type="button" onClick={() => void toggleSound()} disabled={soundBusy} aria-busy={soundBusy} aria-pressed={soundEnabled}><span aria-hidden="true">{soundEnabled ? '♪' : '♩'}</span> {soundEnabled ? t.soundOn : t.soundOff}</button><nav className="language-switch" aria-label="Language / Jazyk"><button type="button" aria-pressed={language === 'sk'} onClick={() => setLanguage('sk')}>Slovenčina</button><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button></nav></div>
      {audioUnavailable && <span className="audio-notice" aria-live="polite">{t.audioUnavailable}</span>}
    </HintDialog>}
    {hintOpen && session && current && <HintDialog title={t.hint} closeLabel={t.closeHint} nextLabel={session.hintStage >= 3 ? t.allHints : t.nextHint} nextDisabled={session.hintStage >= 3} onClose={() => setHintOpen(false)} onNext={showHint} triggerRef={hintRef}>{session.reviewing && <p className="review-note">{t.reviewHelp}</p>}<HintPanel exercise={current} stage={session.hintStage} language={language} /></HintDialog>}
    {leaveOpen && <div className="modal-backdrop"><div ref={dialogRef} className="leave-dialog" role="dialog" aria-modal="true" aria-labelledby="leave-title" aria-describedby="leave-description" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setLeaveOpen(false); }
      if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>('button');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }}><h2 id="leave-title">{t.leaveTitle}</h2><p id="leave-description">{t.leaveText}</p><button className="primary" onClick={() => setLeaveOpen(false)}>{t.stay}</button><button className="text-button" onClick={() => { setLeaveOpen(false); setAnswer(''); setSession(null); }}>{t.leave}</button></div></div>}

  </div>;
}
