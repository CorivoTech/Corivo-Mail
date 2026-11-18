import { Router } from 'express';

/**
 * B3 — Public API tokens, webhooks, integrations marketplace and the `/api/v1` bearer-token API.
 * Registered BEFORE workspaceRouter so `/api/integrations` resolves here.
 */
export const platformApiRouter = Router();
