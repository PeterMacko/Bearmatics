import { useEffect, useRef, useState } from 'react';
import { AccountError } from '../account/api';
import HintDialog from '../HintDialog';
import { fill, pointsText, type Copy } from '../i18n';
import { answerStreak, type Offer, type Progress } from './api';
import { badgeFor } from './badges';
import StreakIcon from './StreakIcon';

type Step = 'offer' | 'confirm' | 'busy' | 'warmed' | 'restarted';

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
  useEffect(() => {
    // Each step moves focus to its main button (the old one is gone).
    if (step === 'busy') return;
    const target = body.current?.querySelector<HTMLElement>('.primary') ?? null;
    if (step !== 'offer' || error) target?.focus();
  }, [step, error]);
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
      const data =
        failure instanceof AccountError
          ? (failure.data as Partial<Progress & { offer: Offer }>)
          : null;
      if (failure instanceof AccountError && failure.code === 'offer_changed' && data?.offer) {
        // The price changed (another lesson finished meanwhile): show the new offer.
        setOffer(data.offer);
        if (typeof data.points === 'number') setCurrentPoints(data.points);
        setStep('offer');
        return;
      }
      if (failure instanceof AccountError && failure.code === 'no_offer') {
        if (data && typeof data.points === 'number') onAnswered(data as Progress);
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
      closeLabel={done ? t.ok : t.closeOffer}
      onClose={onClose}
      triggerRef={trigger}
    >
      <div className={`streak-offer step-${step}`} ref={body}>
        <div className={`streak-offer-art${step === 'warmed' ? ' warm' : ''}`} aria-hidden="true">
          <StreakIcon frozen={step !== 'warmed' && step !== 'restarted'} size={72} />
        </div>
        {(step === 'offer' || (step === 'busy' && !done)) && (
          <>
            <p>
              {fill(t.offerText, { streak: offer.streak, cost: pointsText(t.units, offer.cost) })}
            </p>
            {step === 'offer' && (
              <div className="streak-offer-actions">
                <button type="button" className="primary" onClick={() => setStep('confirm')}>
                  {t.unlock}
                </button>
                <button type="button" className="text-button" onClick={() => void answer(false)}>
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
              <button type="button" className="primary" onClick={() => void answer(true)}>
                {t.yes}
              </button>
              <button type="button" className="text-button" onClick={() => setStep('offer')}>
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
          <p role="status">
            {fill(step === 'warmed' ? t.warmed : t.restarted, {
              days: pointsText(t.dayUnits, days),
            })}
          </p>
        )}
      </div>
    </HintDialog>
  );
}
