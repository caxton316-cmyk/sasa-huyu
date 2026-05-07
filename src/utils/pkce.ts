/**
 * PKCE (Proof Key for Code Exchange) helpers for the "Login (new accounts)" button.
 *
 * CROSS-DOMAIN FLOW EXPLANATION
 * ──────────────────────────────
 * This app (Replit) initiates auth and the callback lands on a DIFFERENT domain
 * (makotitraderss.vercel.app). Because localStorage/sessionStorage is per-origin,
 * the standard @deriv-com/auth-client Callback component CANNOT be used on the
 * Vercel side — its signinCallback() looks for oidc-client-ts state in Vercel's
 * own localStorage, which won't have anything stored by THIS app.
 *
 * SOLUTION: encode the PKCE verifier inside the `state` URL parameter so the
 * Vercel callback can extract it and do a manual token exchange without needing
 * any shared storage.
 *
 * STATE FORMAT (base64url-encoded JSON):
 *   { s: "<random_state>", v: "<pkce_verifier>" }
 *
 * VERCEL CALLBACK MUST DO (manual token exchange):
 *   1. const { s, v } = decodeNewAccountsState(url.searchParams.get('state'))
 *   2. POST https://auth.deriv.com/oauth2/token
 *        grant_type=authorization_code
 *        code=<code from URL>
 *        redirect_uri=https://makotitraderss.vercel.app/callback
 *        client_id=337DJLKi2OJ4VsyFSLIt9
 *        code_verifier=<v>
 *   3. POST https://auth.deriv.com/oauth2/legacy/tokens
 *        Authorization: Bearer <access_token from step 2>
 *   4. Store resulting acct1/token1/cur1 tokens and redirect to app
 *
 * Uses Web Crypto API — available in all modern browsers on HTTPS.
 */

export const NEW_ACCOUNTS_CLIENT_ID = '337DJLKi2OJ4VsyFSLIt9';
export const NEW_ACCOUNTS_REDIRECT_URI = 'https://makotitraderss.vercel.app/callback';
export const NEW_ACCOUNTS_AUTH_BASE = 'https://auth.deriv.com/oauth2/auth';
/** Token endpoint for exchanging the authorization code */
export const NEW_ACCOUNTS_TOKEN_ENDPOINT = 'https://auth.deriv.com/oauth2/token';
/** Legacy Deriv tokens endpoint — call with Bearer <access_token> */
export const NEW_ACCOUNTS_LEGACY_TOKEN_ENDPOINT = 'https://auth.deriv.com/oauth2/legacy/tokens';

export const PKCE_VERIFIER_KEY = 'new_accounts_pkce_verifier';
export const PKCE_STATE_KEY = 'new_accounts_pkce_state';

function base64UrlEncode(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
    if (!window.crypto?.subtle) {
        throw new Error('Web Crypto API (crypto.subtle) is not available. Ensure the page is served over HTTPS.');
    }
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const verifier = base64UrlEncode(array.buffer);
    const encoded = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    const challenge = base64UrlEncode(digest);
    return { verifier, challenge };
}

export function generateState(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return base64UrlEncode(array.buffer);
}

/**
 * Encodes { s: state, v: verifier } into a URL-safe base64url string.
 * This is the `state` parameter sent to auth.deriv.com. The Vercel callback
 * receives it back and must call decodeNewAccountsState() to extract the verifier.
 */
export function encodeNewAccountsState(state: string, verifier: string): string {
    const json = JSON.stringify({ s: state, v: verifier });
    return btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decodes the state parameter returned to the Vercel callback.
 * Returns null if the state cannot be decoded (e.g. it came from a different login flow).
 *
 * @example
 * // In the Vercel callback page:
 * const stateParam = new URLSearchParams(window.location.search).get('state');
 * const decoded = decodeNewAccountsState(stateParam);
 * if (!decoded) throw new Error('Invalid state');
 * const { v: codeVerifier } = decoded;
 * // Now use codeVerifier in the token exchange POST
 */
export function decodeNewAccountsState(encodedState: string | null): { s: string; v: string } | null {
    if (!encodedState) return null;
    try {
        const padded = encodedState.replace(/-/g, '+').replace(/_/g, '/');
        const padding = (4 - (padded.length % 4)) % 4;
        const base64 = padded + '='.repeat(padding);
        const json = atob(base64);
        const parsed = JSON.parse(json);
        if (typeof parsed.s === 'string' && typeof parsed.v === 'string') {
            return parsed as { s: string; v: string };
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Initiates the "Login (new accounts)" PKCE auth flow.
 *
 * Redirects the browser to auth.deriv.com with:
 *   - client_id = 337DJLKi2OJ4VsyFSLIt9  (the new-accounts app registration)
 *   - redirect_uri = https://makotitraderss.vercel.app/callback
 *   - scope = trade
 *   - PKCE code_challenge (S256)
 *   - state = base64url({ s: randomState, v: codeVerifier })
 *
 * The Vercel callback must use decodeNewAccountsState() and then call the
 * token endpoint manually (see module-level comment above for full steps).
 */
export async function redirectToNewAccountsLogin(): Promise<void> {
    const { verifier, challenge } = await generatePKCE();
    const state = generateState();

    try {
        localStorage.setItem(PKCE_VERIFIER_KEY, verifier);
        localStorage.setItem(PKCE_STATE_KEY, state);
    } catch {
        // localStorage unavailable — verifier-in-state is the primary mechanism
    }

    const statePayload = encodeNewAccountsState(state, verifier);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: NEW_ACCOUNTS_CLIENT_ID,
        redirect_uri: NEW_ACCOUNTS_REDIRECT_URI,
        scope: 'trade',
        state: statePayload,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    });

    window.location.href = `${NEW_ACCOUNTS_AUTH_BASE}?${params.toString()}`;
}
