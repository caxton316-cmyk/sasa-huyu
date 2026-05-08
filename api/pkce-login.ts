import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { code, redirect_uri, client_id, code_verifier } = req.body as Record<string, string>;
    if (!code || !redirect_uri || !client_id || !code_verifier) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        // Step 1: Exchange authorization code for access token
        const tokenRes = await fetch('https://auth.deriv.com/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri,
                client_id,
                code_verifier,
            }).toString(),
        });

        if (!tokenRes.ok) {
            const body = await tokenRes.text().catch(() => '');
            return res.status(tokenRes.status).json({
                error: `Token exchange failed (HTTP ${tokenRes.status})`,
                detail: body,
            });
        }

        const tokenData = await tokenRes.json() as Record<string, string>;
        const access_token = tokenData.access_token;
        if (!access_token) {
            return res.status(502).json({ error: 'No access_token in token response', detail: JSON.stringify(tokenData) });
        }

        // Step 2: Exchange access token for legacy Deriv account tokens
        const legacyRes = await fetch('https://auth.deriv.com/oauth2/legacy/tokens', {
            method: 'POST',
            headers: { Authorization: `Bearer ${access_token}` },
        });

        if (!legacyRes.ok) {
            const body = await legacyRes.text().catch(() => '');
            return res.status(legacyRes.status).json({
                error: `Legacy token exchange failed (HTTP ${legacyRes.status})`,
                detail: body,
            });
        }

        const legacyData = await legacyRes.json();
        return res.status(200).json(legacyData);
    } catch (err: any) {
        return res.status(502).json({ error: 'Upstream request failed', detail: err?.message });
    }
}
