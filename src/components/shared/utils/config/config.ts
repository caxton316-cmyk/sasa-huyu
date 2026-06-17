
import { LocalStorageConstants, LocalStorageUtils, URLUtils } from '@deriv-com/utils';
import { isStaging } from '../url/helpers';

// ─── SINGLE SOURCE OF TRUTH ───────────────────────────────────────────────────
// Change any value here and it propagates to every tool, tab, and widget.

/** OAuth client ID for PKCE flows. This is the single source of truth for authentication. */
export const OAUTH_CLIENT_ID = '33zRoZspTijCoSs1d5qio';

/** The Deriv OAuth2 authorization endpoint (redirects the user to login). */
export const OAUTH_AUTH_URL = 'https://auth.deriv.com/oauth2/auth';

/** The Deriv OAuth2 token endpoint (exchanges auth code for access token). */
export const OAUTH_TOKEN_URL = 'https://auth.deriv.com/oauth2/token';

/** The public Deriv trading WebSocket (no auth required). */
export const PUBLIC_TRADING_WS_URL = 'wss://api.derivws.com/trading/v1/options/ws/public';

/** Returns the full OAuth2 callback URL for the current origin. */
export const getCallbackURL = () => `${window.location.origin}/callback`;

// ─────────────────────────────────────────────────────────────────────────────

export const livechat_license_id = 12049137;
export const livechat_client_id = '66aa088aad5a414484c1fd1fa8a5ace7';

// All other App ID and domain-switching logic has been removed to ensure consistency.

export const isProduction = () => {
    // This can be simplified as we no longer rely on domain for App ID.
    return !/localhost|binary\.sx|pages\.dev/i.test(window.location.hostname);
};

export const isTestLink = () => {
    return (
        window.location.origin?.includes('.binary.sx') ||
        window.location.origin?.includes('bot-65f.pages.dev') ||
        isLocal()
    );
};

export const isLocal = () => /localhost(:\d+)?$/i.test(window.location.hostname);

const getDefaultServerURL = () => {
    const server = 'ws';
    const server_url = `${server}.derivws.com`;
    return server_url;
};

/**
 * Returns the App ID for the application.
 * This function is now simplified to always return the single, correct App ID.
 */
export const getAppId = () => {
    return OAUTH_CLIENT_ID;
};

export const switchAppIdAfterTrade = () => null;

export const forceUpdateAppId = () => OAUTH_CLIENT_ID;

export const getSocketURL = () => {
    const local_storage_server_url = window.localStorage.getItem('config.server_url');
    if (local_storage_server_url) return local_storage_server_url;

    const server_url = getDefaultServerURL();
    return server_url;
};

export const checkAndSetEndpointFromUrl = () => {
    if (isTestLink()) {
        const url_params = new URLSearchParams(location.search.slice(1));

        if (url_params.has('qa_server') && url_params.has('app_id')) {
            const qa_server = url_params.get('qa_server') || '';
            const app_id = url_params.get('app_id') || '';

            url_params.delete('qa_server');
            url_params.delete('app_id');

            if (/^(^(www\.)?qa[0-9]{1,4}\.deriv.dev|(.*)\.derivws\.com)$/.test(qa_server) && /^[0-9]+$/.test(app_id)) {
                localStorage.setItem('config.app_id', app_id);
                localStorage.setItem('config.server_url', qa_server.replace(/"/g, ''));
            }

            const params = url_params.toString();
            const hash = location.hash;

            location.href = `${location.protocol}//${location.hostname}${location.pathname}${
                params ? `?${params}` : ''
            }${hash || ''}`;

            return true;
        }
    }

    return false;
};

export const getDebugServiceWorker = () => {
    const debug_service_worker_flag = window.localStorage.getItem('debug_service_worker');
    if (debug_service_worker_flag) return !!parseInt(debug_service_worker_flag);

    return false;
};

export const generateOAuthURL = (is_new_account = false, state = '') => {
    const language = 'EN';
    const server_url = localStorage.getItem('config.server_url');
    const redirect_uri = `${window.location.origin}/callback`;
    const client_id = OAUTH_CLIENT_ID;
    const state_param = state ? `&state=${state}` : '';

    if (server_url && /qa/.test(server_url)) {
        return `https://${server_url}/oauth2/authorize?client_id=${client_id}&l=${language}&redirect_uri=${redirect_uri}&brand=deriv&redirect=home${state_param}`;
    }

    const endpoint = 'auth.deriv.com';

    return `https://${endpoint}/oauth2/authorize?client_id=${client_id}&l=${language}&redirect_uri=${redirect_uri}&brand=deriv&redirect=home${state_param}`;
};
