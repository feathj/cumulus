import 'server-only';

import { cache } from 'react';

import { db } from '../db';
import type { Context } from './init';

/**
 * One context per request. `cache` makes Server Components that prefetch in
 * the same render share it. Tests skip this and hand the router a test
 * database directly.
 */
export const createContext = cache((): Context => ({ db }));
