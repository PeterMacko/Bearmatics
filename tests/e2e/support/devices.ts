/**
 * Defined devices (Peter's test scope) in one list. Each spec loops over a named subset that
 * keeps its own device set and order; `name` is used in test titles and messages.
 * `touch` marks touch hardware (phones, tablets, the foldable).
 */
export interface Device {
  name: string;
  width: number;
  height: number;
  touch: boolean;
}

const device = (name: string, width: number, height: number, touch: boolean): Device => ({
  name,
  width,
  height,
  touch,
});

export const DEVICE = {
  phone: device('phone', 390, 844, true),
  phone360: device('phone 360', 360, 640, true),
  smallPhone: device('small phone', 320, 568, true),
  phone369: device('phone 369', 369, 700, true),
  phoneLandscape: device('phone landscape', 844, 390, true),
  smallPhoneLandscape: device('small phone landscape', 568, 320, true),
  tablet: device('tablet', 820, 1180, true),
  tabletLandscape: device('tablet landscape', 1180, 820, true),
  foldable: device('foldable unfolded', 884, 1004, true),
  /** The real phone browser bar takes ~165 px of the unfolded foldable. */
  foldableBrowserBar: device('foldable with browser bar', 884, 838, true),
  /** Peter's unfolded foldable in Vivaldi (tab row + address bar). */
  foldableVivaldi: device('foldable in Vivaldi', 884, 600, true),
  foldableNarrow: device('foldable narrow with browser bar', 742, 702, true),
  wideShort: device('wide short', 1280, 520, false),
  wideShortSmall: device('wide short small', 733, 500, false),
  desktop: device('desktop', 1366, 900, false),
} as const;

/** Every defined device, in the canonical order. */
export const ALL_DEVICES: Device[] = Object.values(DEVICE);

/** Same device under the name a spec has always used in its titles. */
export const renamed = (d: Device, name: string): Device => ({ ...d, name });

const without = (...skip: Device[]) => ALL_DEVICES.filter((d) => !skip.includes(d));

/** App bar placement (app-bar.spec): every device except 369x700. */
export const APP_BAR_DEVICES = without(DEVICE.phone369);

/** Accounts screens (accounts.spec). */
export const ACCOUNT_DEVICES = without(
  DEVICE.phone369,
  DEVICE.foldableBrowserBar,
  DEVICE.foldableVivaldi,
  DEVICE.foldableNarrow,
);

/** Badge in the app bar (points.spec). */
export const BADGE_DEVICES = without(
  DEVICE.phone369,
  DEVICE.foldableBrowserBar,
  DEVICE.foldableNarrow,
);

/** English listen-and-choose (english-listen.spec), in its historical order. */
export const ENGLISH_LISTEN_DEVICES: Device[] = [
  DEVICE.phone,
  DEVICE.smallPhone,
  DEVICE.phone360,
  DEVICE.phoneLandscape,
  DEVICE.smallPhoneLandscape,
  DEVICE.tablet,
  DEVICE.tabletLandscape,
  DEVICE.foldable,
  DEVICE.foldableBrowserBar,
  DEVICE.foldableNarrow,
  DEVICE.wideShort,
  DEVICE.desktop,
];

/** English listen-and-write (english-write.spec): the touch devices with an on-screen keyboard. */
export const ENGLISH_WRITE_DEVICES: Device[] = ENGLISH_LISTEN_DEVICES.slice(0, 8);

/** Course choice and English home (course-choice.spec), under its historical names. */
export const COURSE_CHOICE_DEVICES: Device[] = [
  renamed(DEVICE.phone, 'phone portrait'),
  DEVICE.smallPhone,
  DEVICE.phoneLandscape,
  renamed(DEVICE.tablet, 'tablet portrait'),
  DEVICE.tabletLandscape,
  DEVICE.foldable,
  DEVICE.wideShort,
  DEVICE.desktop,
];
