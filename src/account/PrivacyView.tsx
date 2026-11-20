import { Screen, type Common } from './fields';
import { PrivacyList } from './PrivacyList';

export function PrivacyView({ t, headingRef }: Omit<Common, 'onPrivacy'>) {
  return (
    <Screen t={t} title={t.privacyTitle} intro={t.privacy[0]} headingRef={headingRef}>
      <PrivacyList lines={t.privacy.slice(1)} />
    </Screen>
  );
}
