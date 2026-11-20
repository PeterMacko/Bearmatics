import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
afterEach(cleanup);
// SCRUM-202: daily play counts live in localStorage; every test starts with none.
afterEach(() => localStorage.clear());
