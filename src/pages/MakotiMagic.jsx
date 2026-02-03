import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';

const MakotiMagic = observer(() => {
    const { client } = useStore();
    const [is_hunting, setIsHunting] = useState(false);
    const [last_digit, setLastDigit] = useState(null);
    const [stake, setStake] = useState(1.00);
    const is_active = useRef(false);

    const executeStrike = useCallback((digit) => {
        if (!api_base.api) return;
        api_base.api.send({
            buy: 1,
            price: Number(stake),
            parameters: {
                amount: Number(stake),
                basis: 'stake',
                contract_type: 'DIGITMATCH',
                currency: client.currency || 'USD',
                duration: 1,
                duration_unit: 't',
                symbol: 'R_100',
                barrier: digit 
            }
        });
        setIsHunting(false);
        is_active.current = false;
    }, [stake, client.currency]);

    useEffect(() => {
        let sub;
        if (is_hunting && api_base.api) {
            is_active.current = true;
            sub = api_base.api.onMessage().subscribe((msg) => {
                if (is_active.current && msg.data.msg_type === 'tick') {
                    const digit = msg.data.tick.quote.toString().slice(-1);
                    setLastDigit(digit);
                    executeStrike(digit);
                }
            });
        }
        return () => sub?.unsubscribe();
    }, [is_hunting, executeStrike]);

    return (
        <div style={{ background: '#000', color: '#0f0', minHeight: '100vh', padding: '40px', textAlign: 'center', fontFamily: 'monospace' }}>
            <h1 style={{ letterSpacing: '5px' }}>MAKOTI HUNTER</h1>
            <div style={{ border: '1px solid #0f0', padding: '20px', display: 'inline-block', borderRadius: '10px' }}>
                <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} style={{ background: '#000', color: '#0f0', border: '1px solid #0f0', padding: '10px', width: '100px' }} />
                <div style={{ fontSize: '150px', fontWeight: 'bold' }}>{last_digit ?? '-'}</div>
                <button 
                    onClick={() => setIsHunting(true)} 
                    disabled={is_hunting}
                    style={{ background: is_hunting ? '#222' : '#0f0', color: '#000', padding: '20px 40px', fontSize: '20px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}
                >
                    {is_hunting ? "HUNTING..." : "TRIGGER HUNT"}
                </button>
            </div>
        </div>
    );
});

export default MakotiMagic;
