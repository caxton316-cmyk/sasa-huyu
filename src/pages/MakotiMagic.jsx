import React, { useState, useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';

const MakotiMagic = observer(() => {
    const { client } = useStore();
    
    // UI State
    const [is_hunting, setIsHunting] = useState(false);
    const [stake, setStake] = useState(0.35);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);

    // Speed Refs (Bypasses React's slow render cycle)
    const hunt_active = useRef(false);
    const last_digit_ref = useRef(null);

    // 1. DYNAMIC RESULT TRACKER
    useEffect(() => {
        const result_sub = api_base.api.onMessage().subscribe((msg) => {
            const data = msg.data;
            if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract.is_sold) {
                const contract = data.proposal_open_contract;
                const win = contract.status === 'won';
                const profit = contract.profit;

                const new_result = {
                    id: contract.contract_id,
                    stake: contract.buy_price,
                    entry: contract.entry_tick_display_value.slice(-1),
                    exit: contract.exit_tick_display_value.slice(-1),
                    status: contract.status.toUpperCase(),
                    profit: profit
                };

                setResults(prev => [new_result, ...prev].slice(0, 10));
                setTotalPL(prev => prev + profit);
            }
        });
        return () => result_sub.unsubscribe();
    }, []);

    // 2. ULTRA-SPEED EXECUTION ENGINE
    const fireInstantStrike = useCallback((digit) => {
        if (!hunt_active.current) return;

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
                symbol: '1HZ100V', 
                barrier: parseInt(digit) 
            }
        });

        // Kill hunt immediately after firing to prevent multi-buying
        hunt_active.current = false;
        setIsHunting(false);
    }, [stake, client.currency]);

    // 3. PACKET INTERCEPTOR
    useEffect(() => {
        let tick_sub;
        if (is_hunting) {
            hunt_active.current = true;
            tick_sub = api_base.api.onMessage().subscribe((msg) => {
                if (hunt_active.current && msg.data.msg_type === 'tick') {
                    const quote = msg.data.tick.quote.toString();
                    const digit = quote.charAt(quote.length - 1);
                    last_digit_ref.current = digit;
                    fireInstantStrike(digit);
                }
            });
        }
        return () => { if (tick_sub) tick_sub.unsubscribe(); };
    }, [is_hunting, fireInstantStrike]);

    return (
        <div style={containerStyle}>
            <div style={headerStyle}>
                <h1>MAKOTI ULTRA-SPEED HUNTER</h1>
                <div style={statsStyle}>
                    TOTAL P/L: <span style={{ color: total_pl >= 0 ? '#0f0' : '#f00' }}>{total_pl.toFixed(2)} {client.currency}</span>
                </div>
            </div>

            <div style={controlPanelStyle}>
                <div style={inputGroupStyle}>
                    <label>STAKE AMOUNT</label>
                    <input 
                        type="number" 
                        value={stake} 
                        onChange={(e) => setStake(e.target.value)} 
                        style={inputStyle}
                    />
                </div>
                <button 
                    onClick={() => setIsHunting(true)} 
                    disabled={is_hunting}
                    style={is_hunting ? huntBtnActiveStyle : huntBtnStyle}
                >
                    {is_hunting ? "SCANNING PACKETS..." : "TRIGGER INSTANT HUNT"}
                </button>
            </div>

            <div style={tableContainerStyle}>
                <table style={tableStyle}>
                    <thead>
                        <tr>
                            <th>STAKE</th>
                            <th>ENTRY DIGIT</th>
                            <th>EXIT DIGIT</th>
                            <th>RESULT</th>
                            <th>PROFIT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((res, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                                <td>{res.stake}</td>
                                <td style={{ color: '#0f0', fontWeight: 'bold' }}>{res.entry}</td>
                                <td style={{ color: '#ff0' }}>{res.exit}</td>
                                <td style={{ color: res.status === 'WON' ? '#0f0' : '#f00' }}>{res.status}</td>
                                <td style={{ color: res.profit >= 0 ? '#0f0' : '#f00' }}>{res.profit.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

// STYLES
const containerStyle = { background: '#000', color: '#0f0', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' };
const headerStyle = { display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f0', paddingBottom: '10px', marginBottom: '20px' };
const statsStyle = { fontSize: '20px', fontWeight: 'bold' };
const controlPanelStyle = { background: '#050505', border: '1px solid #333', padding: '20px', borderRadius: '8px', textAlign: 'center', marginBottom: '20px' };
const inputGroupStyle = { marginBottom: '15px' };
const inputStyle = { background: '#000', color: '#0f0', border: '1px solid #0f0', padding: '10px', fontSize: '18px', textAlign: 'center', width: '120px' };
const huntBtnStyle = { background: '#0f0', color: '#000', padding: '15px 40px', fontSize: '20px', fontWeight: 'bold', border: 'none', cursor: 'pointer', borderRadius: '4px' };
const huntBtnActiveStyle = { ...huntBtnStyle, background: '#f00', animation: 'pulse 1s infinite' };
const tableContainerStyle = { background: '#050505', padding: '10px', borderRadius: '8px' };
const tableStyle = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };

export default MakotiMagic;
