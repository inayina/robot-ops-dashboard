export { DashboardConfigSchema, parseDashboardConfig } from './config/env';
export * from './api/errors';
export * from './api/httpClient';
export * from './api/platformClient';
export * from './contracts/common';
export * from './contracts/dataPlatform';
export * from './contracts/dashboard';
export * from './contracts/hoc';
export * from './contracts/management';

// Stage 5C keeps the proven DOM renderer while moving its runtime boundary
// behind Vite so TypeScript contracts, state, transport and feature modules are
// part of the page's actual dependency graph.
import '../app.js';

export const DASHBOARD_FRONTEND_VERSION = 'stage-5c.v1' as const;
