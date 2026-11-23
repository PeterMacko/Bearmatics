import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type RefObject,
} from 'react';
import { fill, type Copy } from '../i18n';
import Icon from '../Icon';
import { ignoreRepeatClick } from '../ignoreRepeatClick';
import FeedbackLine from '../lesson/FeedbackLine';
import PracticeHeader from '../lesson/PracticeHeader';
import type { Feedback } from '../session';
import {
  encodeArrows,
  GRID_SIZE,
  MAX_ARROWS,
  sameCell,
  walkArrows,
  type Arrow,
  type BearPuzzle,
  type Cell,
} from './bearPath';
import { ArrowIcon, EyeIcon, GridBear, HoneyPot, Paw, RemoveIcon } from './LogicArt';
import LogicDemo from './LogicDemo';
import useBoardFit from './useBoardFit';

/** One step of the walk on screen (scope 4: about 0.4 s per arrow). */
export const STEP_MS = 400;
/**
 * After a wrong walk the bear waits this long, then goes back to the start. Input is open again
 * as soon as the result shows (QA271-01): a new arrow, Remove, Go or Show me sends the bear
 * back at once and cancels this wait.
 */
export const BACK_MS = 700;

const KEY_ARROWS: Record<string, Arrow> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};
/** Arrow pad order: a cross reads naturally on one row too (up, left, down, right). */
const PAD: readonly Arrow[] = ['up', 'left', 'down', 'right'];
const CELLS = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => ({
  row: Math.floor(i / GRID_SIZE),
  col: i % GRID_SIZE,
}));

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Logic level 1 lesson (SCRUM-262): plan up to 4 arrows, then Go; the bear walks one cell per
 * arrow. A wrong walk leaves paw dots, the bear goes back to the start and the arrows stay.
 * The parent owns the arrows (they count as unsent work for the leave question) and the session;
 * this view owns the walk and the demo on screen. Mount it with a new `key` per presentation.
 */
export default function LogicPracticeView({
  t,
  puzzle,
  level,
  position,
  reviewing,
  solved,
  feedback,
  arrows,
  nextLabel,
  keysActive,
  demoRun,
  nextRef,
  onArrowsChange,
  onGo,
  onWalked,
  onNext,
  onShowMe,
  onDemoDone,
  onStep,
}: {
  t: Copy;
  puzzle: BearPuzzle;
  level: number;
  position: string;
  reviewing: boolean;
  solved: boolean;
  feedback: Feedback;
  arrows: readonly Arrow[];
  nextLabel: string;
  /** False while a dialog is open: no lesson key handling then. */
  keysActive: boolean;
  /** Non-zero while the demo shows (a new number restarts it). */
  demoRun: number;
  nextRef: RefObject<HTMLButtonElement | null>;
  onArrowsChange: (arrows: Arrow[]) => void;
  /** Go was pressed with arrows (synchronously, in the gesture: sound may start). */
  onGo: () => void;
  /** The walk ended: the planned arrows as the session answer. */
  onWalked: (answer: string) => void;
  onNext: () => void;
  onShowMe: () => void;
  onDemoDone: () => void;
  /** Soft step sound (follows Mute). */
  onStep: () => void;
}) {
  const [bearAt, setBearAt] = useState<Cell>(puzzle.bear);
  const [walking, setWalking] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [bumped, setBumped] = useState<Arrow | null>(null);
  const [paws, setPaws] = useState<readonly Cell[]>([]);
  const [outcome, setOutcome] = useState<'bumped' | 'missed' | null>(null);
  /** The bear jumps (no slide) back to the start: a new walk starts right after. */
  const [snap, setSnap] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const walkingRef = useRef(false);
  const timers = useRef<number[]>([]);
  /** The pending walk back to the start after a wrong walk (null when none). */
  const backTimer = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const sectionRef = useBoardFit(demoRun, solved);
  const demo = demoRun > 0;
  const locked = walking || demo;

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );
  const later = (run: () => void, ms: number) => {
    const timer = window.setTimeout(run, ms);
    timers.current.push(timer);
    return timer;
  };
  /** Ends a pending walk back now: the bear is on the start before anything new happens. */
  const backToStart = (jump: boolean) => {
    if (backTimer.current === null) return;
    window.clearTimeout(backTimer.current);
    backTimer.current = null;
    setSnap(jump);
    setBearAt(puzzle.bear);
    setBumped(null);
  };

  // A new puzzle (mount) and the end of the demo put focus on the board, which reads the
  // bear's and the honey's cells; a solved puzzle focuses Next.
  useEffect(() => {
    if (solved) nextRef.current?.focus({ preventScroll: true });
    else if (!demo) boardRef.current?.focus({ preventScroll: true });
  }, [solved, demo, nextRef]);

  const change = (next: Arrow[]) => {
    backToStart(false);
    setPaws([]);
    setOutcome(null);
    onArrowsChange(next);
  };
  const add = (arrow: Arrow) => {
    if (locked || solved || arrows.length >= MAX_ARROWS) return;
    change([...arrows, arrow]);
  };
  const removeLast = () => {
    if (locked || solved || arrows.length === 0) return;
    change(arrows.slice(0, -1));
  };
  const go = () => {
    if (locked || solved || arrows.length === 0 || walkingRef.current) return;
    walkingRef.current = true;
    backToStart(true);
    onGo();
    const planned = [...arrows];
    const walk = walkArrows(puzzle.bear, planned);
    const right = !walk.bumped && sameCell(walk.end, puzzle.honey);
    setWalking(true);
    setPaws([]);
    setOutcome(null);
    const finish = () => {
      setActiveSlot(null);
      onWalked(encodeArrows(planned));
      if (right) {
        walkingRef.current = false;
        setWalking(false);
        return;
      }
      setPaws(walk.steps);
      setOutcome(walk.bumped ? 'bumped' : 'missed');
      // Input opens with the result; the bear walks back meanwhile (or at once on new input).
      walkingRef.current = false;
      setWalking(false);
      backTimer.current = later(() => {
        backTimer.current = null;
        setBearAt(puzzle.bear);
        setBumped(null);
      }, BACK_MS);
    };
    walk.steps.forEach((cell, i) =>
      later(
        () => {
          setActiveSlot(i);
          setSnap(false);
          setBearAt(cell);
          onStep();
        },
        STEP_MS * i + 150,
      ),
    );
    const after = STEP_MS * walk.steps.length + 150;
    if (walk.bumped)
      later(() => {
        setActiveSlot(walk.steps.length);
        setBumped(planned[walk.steps.length]);
      }, after);
    later(finish, after + (walk.bumped ? STEP_MS : 0));
  };

  // Keyboard (scope 3), only while this lesson is on screen and no dialog is open.
  const keys = useRef({ add, removeLast, go, onNext, locked, solved });
  useEffect(() => {
    keys.current = { add, removeLast, go, onNext, locked, solved };
  });
  useEffect(() => {
    if (!keysActive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (event.defaultPrevented) return;
      const k = keys.current;
      const arrow = KEY_ARROWS[event.key];
      const target = event.target instanceof Element ? event.target : null;
      const control = target?.closest('button, a, input, select, textarea, [role="dialog"]');
      if (arrow) {
        event.preventDefault();
        k.add(arrow);
      } else if (event.key === 'Backspace') {
        if (target?.closest('input, textarea')) return;
        event.preventDefault();
        k.removeLast();
      } else if (event.key === 'Enter') {
        // Enter on a focused button keeps its own meaning (Tab + Enter works everywhere).
        if (control || event.repeat) return;
        event.preventDefault();
        if (k.locked) return;
        if (k.solved) k.onNext();
        else k.go();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [keysActive]);

  const fromOne = (cell: Cell) => ({ row: cell.row + 1, col: cell.col + 1 });
  const boardLabel = fill(t.logicBoard, {
    bearRow: fromOne(puzzle.bear).row,
    bearCol: fromOne(puzzle.bear).col,
    honeyRow: fromOne(puzzle.honey).row,
    honeyCol: fromOne(puzzle.honey).col,
  });
  const slotsLabel = fill(t.arrowSlots, {
    list: arrows.length ? arrows.map((a) => t.arrowWords[a]).join(', ') : t.noArrows,
  });
  const mood = solved ? 'happy' : outcome ? 'sad' : 'neutral';
  const message =
    feedback === 'correct'
      ? t.logicCorrect
      : feedback === 'incorrect'
        ? outcome === 'bumped'
          ? t.logicBumped
          : t.logicIncorrect
        : '';

  return (
    <section
      ref={sectionRef}
      className="practice logic-practice"
      data-walking={walking || undefined}
      data-solved={solved || undefined}
    >
      <PracticeHeader t={t} level={level} position={position} />
      <h2>{reviewing ? t.logicReviewTitle : t.logicQuestion}</h2>
      <div className="logic-play">
        <div className="logic-stage">
          {demo ? (
            <LogicDemo key={demoRun} t={t} reduced={reduced} onDone={onDemoDone} />
          ) : (
            <div
              ref={boardRef}
              className="logic-board"
              role="img"
              tabIndex={-1}
              aria-label={boardLabel}
              aria-describedby="logic-keys"
            >
              {CELLS.map((cell) => (
                <span
                  key={`${cell.row}-${cell.col}`}
                  className="logic-cell"
                  data-dark={(cell.row + cell.col) % 2 === 1 || undefined}
                  data-paw={paws.some((p) => sameCell(p, cell)) || undefined}
                >
                  {sameCell(cell, puzzle.honey) && (
                    <span className="logic-honey">
                      <HoneyPot />
                    </span>
                  )}
                  {paws.some((p) => sameCell(p, cell)) && (
                    <span className="logic-paw">
                      <Paw />
                    </span>
                  )}
                </span>
              ))}
              <span
                className="logic-bear"
                data-bump={bumped ?? undefined}
                data-snap={snap || undefined}
                style={{ '--row': bearAt.row, '--col': bearAt.col } as CSSProperties}
              >
                <GridBear mood={mood} />
              </span>
            </div>
          )}
        </div>
        <div className="arrow-plan">
          <ol className="arrow-slots" aria-label={slotsLabel}>
            {Array.from({ length: MAX_ARROWS }, (_, i) => (
              <li
                key={i}
                className="arrow-slot"
                data-filled={arrows[i] ? true : undefined}
                data-current={activeSlot === i || undefined}
                aria-hidden="true"
              >
                {arrows[i] && <ArrowIcon arrow={arrows[i]} />}
              </li>
            ))}
          </ol>
          <button
            type="button"
            className="logic-remove"
            aria-label={t.removeArrow}
            aria-disabled={locked || solved || arrows.length === 0}
            onClick={removeLast}
          >
            <RemoveIcon />
          </button>
        </div>
        <div className="arrow-pad" role="group" aria-label={t.arrowPad}>
          {PAD.map((arrow) => (
            <button
              key={arrow}
              type="button"
              className={`arrow-button arrow-${arrow}`}
              aria-label={t.arrowNames[arrow]}
              aria-disabled={locked || solved || arrows.length >= MAX_ARROWS}
              onClick={() => add(arrow)}
            >
              <ArrowIcon arrow={arrow} />
            </button>
          ))}
        </div>
        <FeedbackLine kind={feedback}>{message}</FeedbackLine>
        <div className="answer-actions logic-actions">
          {solved ? (
            <button
              ref={nextRef}
              type="button"
              className="primary answer-button"
              data-state="correct"
              onClick={(event: MouseEvent) => {
                if (!ignoreRepeatClick(event)) onNext();
              }}
            >
              {nextLabel}
              <span aria-hidden="true"> →</span>
            </button>
          ) : (
            <button
              type="button"
              className="primary answer-button logic-go"
              data-state={feedback === 'incorrect' ? 'incorrect' : 'neutral'}
              aria-disabled={locked || arrows.length === 0}
              onClick={(event: MouseEvent) => {
                if (!ignoreRepeatClick(event)) go();
              }}
            >
              <Icon name="play" />
              {t.go}
            </button>
          )}
          <button
            type="button"
            className="secondary logic-show-me"
            aria-disabled={locked}
            onClick={(event: MouseEvent) => {
              if (ignoreRepeatClick(event) || locked) return;
              backToStart(true);
              onShowMe();
            }}
          >
            <EyeIcon />
            {t.showMe}
          </button>
        </div>
      </div>
      <p id="logic-keys" className="sr-only">
        {t.logicKeys}
      </p>
    </section>
  );
}
