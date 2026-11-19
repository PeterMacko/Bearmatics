import { useEffect, useRef, useState } from 'react';
import { AccountError } from '../account/api';
import HintDialog from '../HintDialog';
import Icon from '../Icon';
import { ignoreRepeatClick } from '../ignoreRepeatClick';
import { fill, pointsText, type Copy } from '../i18n';
import { answerStreak, type Offer, type Progress } from './api';
import { badgeFor } from './badges';
import StreakIcon from './StreakIcon';

type Step = 'offer' | 'confirm' | 'busy' | 'warmed' | 'restarted';

/** What a refused streak answer may carry: the new offer and/or the player's progress. */
type StreakErrorBody = Partial<Progress> & { offer?: Offer };

/** The error answer of a failed streak request, when the server sent one. */
function streakErrorBody(failure: unknown): StreakErrorBody | null {
  return failure instanceof AccountError &&
    typeof failure.data === 'object' &&
    failure.data !== null
    ? failure.data
    : null;
}

/** A refused answer that carries the progress (points with the streak) to show. */
const carriesProgress = (data: StreakErrorBody | null): data is Progress & StreakErrorBody =>
  typeof data?.points === 'number';

/**
 * Unlock offer after the summary (SCRUM-118 rules 4-5): offer -> Unlock -> confirmation (points
 * after paying, badge change) -> Yes pays and the streak continues; No thanks starts again at 1.
 * Closing without an answer keeps the offer for the next finished lesson today.
 */
export default function StreakOffer({
  t,
  offer: firstOffer,
  points,
  onAnswered,
  onClose,
  onWarm,
}: {
  t: Copy['points'];
  offer: Offer;
  points: number;
  onAnswered: (progress: Progress) => void;
  onClose: () => void;
  onWarm: () => void;
}) {
  const [offer, setOffer] = useState(firstOffer);
  const [currentPoints, setCurrentPoints] = useState(points);
  const [step, setStep] = useState<Step>('offer');
  const [error, setError] = useState(false);
  const [days, setDays] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(
    typeof document === 'undefined' ? null : (document.activeElement as HTMLButtonElement | null),
  );
  const body = useRef<HTMLDivElement>(null);
  // When the step changes, the new buttons appear where the old ones were. A double tap (or a
  // tap right after the change) must not answer the new question (QA131-01).
  const stepAt = useRef(0);
  const opened = useRef(false);
  useEffect(() => {
    stepAt.current = performance.now();
    if (step === 'busy') return;
    // Each later step moves focus to its main button (the old one is gone, QA131-02); the
    // first one keeps the dialog's own first focus.
    if (opened.current) body.current?.querySelector<HTMLElement>('.primary')?.focus();
    opened.current = true;
  }, [step, error]);
  const deliberate =
    (action: () => void) => (event: { detail: number; preventDefault: () => void }) => {
      if (!ignoreRepeatClick(event, performance.now() - stepAt.current < 600)) action();
    };
  // Closing uncovers the summary: a quick second tap must not land on Play again behind the
  // dialog (QA131-06), so clicks are swallowed for a moment after closing.
  const close = () => {
    const swallow = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('.summary')) return;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('click', swallow, true);
    window.setTimeout(() => document.removeEventListener('click', swallow, true), 600);
    onClose();
  };
  const after = currentPoints - offer.cost;
  const fromBadge = badgeFor(currentPoints).badge;
  const toBadge = badgeFor(after).badge;
  const answer = async (unlock: boolean) => {
    setStep('busy');
    setError(false);
    try {
      const result = await answerStreak(unlock, offer.cost);
      onAnswered(result);
      setDays(result.streak);
      setStep(unlock ? 'warmed' : 'restarted');
      if (unlock) onWarm();
    } catch (failure) {
      const data = streakErrorBody(failure);
      if (failure instanceof AccountError && failure.code === 'offer_changed' && data?.offer) {
        // The price changed (another lesson finished meanwhile): show the new offer.
        setOffer(data.offer);
        if (typeof data.points === 'number') setCurrentPoints(data.points);
        setStep('offer');
        return;
      }
      if (failure instanceof AccountError && failure.code === 'no_offer') {
        if (carriesProgress(data)) onAnswered(data);
        onClose();
        return;
      }
      setError(true);
      setStep(unlock ? 'confirm' : 'offer');
    }
  };
  const done = step === 'warmed' || step === 'restarted';
  return (
    <HintDialog
      titleId="streak-title"
      title={done ? t.streakTitle : t.offerTitle}
      closeLabel={done ? t.closeDone : t.closeOffer}
      onClose={close}
      triggerRef={trigger}
    >
      <div className={`streak-offer step-${step}`} ref={body}>
        <div className={`streak-offer-art${step === 'warmed' ? ' warm' : ''}`} aria-hidden="true">
          <StreakIcon
            look={step === 'warmed' || step === 'restarted' ? 'flame' : 'ice'}
            size={72}
            flicker={step === 'warmed'}
          />
        </div>
        {(step === 'offer' || (step === 'busy' && !done)) && (
          <>
            <p>
              {fill(t.offerText, { streak: offer.streak, cost: pointsText(t.units, offer.cost) })}
            </p>
            {step === 'offer' && (
              <div className="streak-offer-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={deliberate(() => setStep('confirm'))}
                >
                  <Icon name="unlock" />
                  {t.unlock}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={deliberate(() => void answer(false))}
                >
                  <Icon name="cross" />
                  {t.noThanks}
                </button>
              </div>
            )}
          </>
        )}
        {step === 'confirm' && (
          <>
            <p>
              {fill(t.confirmPoints, { points: pointsText(t.units, after) })}
              {fromBadge !== toBadge && (
                <>
                  {' '}
                  {toBadge > 0
                    ? fill(t.confirmBadge, { from: fromBadge, to: toBadge })
                    : fill(t.confirmLoseBadge, { from: fromBadge })}
                </>
              )}
            </p>
            <div className="streak-offer-actions">
              <button
                type="button"
                className="primary"
                onClick={deliberate(() => void answer(true))}
              >
                <Icon name="tick" />
                {t.yes}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={deliberate(() => setStep('offer'))}
              >
                <Icon name="back" />
                {t.back}
              </button>
            </div>
          </>
        )}
        {error && (
          <p className="streak-offer-error" role="alert">
            {t.answerFailed}
          </p>
        )}
        {done && (
          <>
            <p role="status">
              {fill(step === 'warmed' ? t.warmed : t.restarted, {
                days: pointsText(t.dayUnits, days),
              })}
            </p>
            <div className="streak-offer-actions">
              <button type="button" className="primary" onClick={deliberate(close)}>
                {t.ok}
              </button>
            </div>
          </>
        )}
      </div>
    </HintDialog>
  );
}
