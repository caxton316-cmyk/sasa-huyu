import React, { useState, useCallback, useRef, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';

const MakotiMagic = observer(() => {
    const { client } = useStore();
    
    const [is_flooding, setIsFlooding] = useState(false);
    const [stake, setStake] = useState(0.35);
    const [results, setResults] = useState([]);
    const [total_pl, setTotalPL] = useState(0);

    // SPEED REFS: Bypassing React's state for the firing loop
    const flood_active = useRef(false);
    const last_processed_tick_id = useRef(null);

    // 1. INDEPENDENT RESULT LISTENER (Runs in background)
    useEffect(() => {
        const sub = api_base.api.onMessage().subscribe((msg) => {
            const data = msg.data;
            if (data.msg_type === 'proposal_open_contract' && data.proposal_open_contract.is_sold) {
                const contract = data.proposal_open_contract;
                const profit = contract.profit;

                setResults(prev => [{
                    prediction: contract.barrier,
                    entry: contract.entry_tick_display_value?.slice(-1) || '?',
                    exit: contract.exit_tick_display_value?.slice(-1) || '?',
                    status: contract.status.toUpperCase(),
                    profit: profit
                }, ...prev].slice(0, 15));
                setTotalPL(prev => prev + profit);
            }
        });
        return () => sub.unsubscribe();
    }, []);

    // 2. THE FLOOD ENGINE: Fires on every tick without waiting
    const fireStreamStrike = useCallback((digit) => {
        // High-speed injection
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
    }, [stake, client.currency]);

    useEffect(() => {
        let tick_sub;
        if (is_flooding) {
            flood_active.current = true;
            tick_sub = api_base.api.onMessage().subscribe((msg) => {
                // We fire on every 'tick' message immediately
                if (flood_active.current && msg.data.msg_type === 'tick') {
                    const tick = msg.data.tick;
                    
                    // Ensure we don't double-fire on the exact same tick ID if the stream jitters
                    if (last_processed_tick_id.current !== tick.id) {
                        last_processed_tick_id.current = tick.id;
                        const digit = tick.quote.toString().slice(-1);
                        fireStreamStrike(digit);
                    }
                }
            });
        } else {
            flood_active.current = false;
        }
        return () => tick_sub?.unsubscribe();
    }, [is_flooding, fireStreamStrike]);

    return (
        <div style={ui.container}>
            <div style={ui.header}>
                <h1 style={{ color: '#0f0', letterSpacing: '3px', margin: 0 }}>STREAM FLOODER v6</h1>
                <div style={ui.pl}>PROFIT: {total_pl.toFixed(2)}</div>
            </div>

            <div style={ui.card}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ fontSize: '11px', color: '#555' }}>PACKET STAKE</label><br/>
                    <input type="number" value={stake} onChange={(e) => setStake(e.target.value)} style={ui.input} />
                </div>
                
                <button 
                    onClick={() => setIsFlooding(!is_flooding)} 
                    style={{ ...ui.btn, background: is_flooding ? '#f00' : '#0f0', boxShadow: is_flooding ? '0 0 20px #f00' : 'none' }}
                >
                    {is_flooding ? "STOP FLOODING" : "START ULTRA-FAST FLOOD"}
                </button>
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#333' }}>
                    STATUS: {is_flooding ? 'SENDING PACKETS @ 1000ms/strike' : 'SYSTEM IDLE'}
                </div>
            </div>

            <div style={ui.tableWrapper}>
                <table style={ui.table}>
                    <thead>
                        <tr style={{ color: '#444', fontSize: '10px', borderBottom: '1px solid #222' }}>
                            <th>TARGET</th>
                            <th>ENTRY</th>
                            <th>EXIT</th>
                            <th>STATUS</th>
                            <th>P/L</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((res, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                                <td style={{ color: '#0f0' }}>{res.prediction}</td>
                                <td>{res.entry}</td>
                                <td>{res.exit}</td>
                                <td style={{ color: res.status === 'WON' ? '#0f0' : '#f00', fontWeight: 'bold' }}>{res.status}</td>
                                <td style={{ color: res.profit >= 0 ? '#0f0' : '#f00' }}>{res.profit.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
});

const ui = {
    container: { background: '#000', color: '#0f0', minHeight: '100vh', padding: '15px', fontFamily: 'monospace' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #222', paddingBottom: '10px' },
    pl: { fontSize: '20px', fontWeight: 'bold', textShadow: '0 0 5px #0f0' },
    card: { background: '#050505', padding: '25px', borderRadius: '2px', textAlign: 'center', margin: '15px 0', border: '1px solid #111' },
    input: { background: '#000', color: '#0f0', border: '1px solid #0f0', padding: '10px', width: '100px', textAlign: 'center', fontSize: '18px' },
    btn: { color: '#000', padding: '20px', fontSize: '18px', fontWeight: 'bold', border: 'none', cursor: 'pointer', width: '100%', transition: '0.2s' },
    tableWrapper: { background: '#030303', padding: '5px' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }
};

export default MakotiMagic;
