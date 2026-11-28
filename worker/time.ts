// The worker's clock. `now` reads Date.now() at each call, so tests can move the clock.
import { DAY_MS } from '../shared/slovakDay';

export { DAY_MS };

export const now = () => Date.now();
