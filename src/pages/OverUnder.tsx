import React, { useState, useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';
import './over-under.scss';

const OverUnder = observer(() => {
    const { summary_card, journal, client } = useStore();
    const [digitStats, setDigitStats] = useState(Array(10).fill(0));
    const [lastDigit, setLastDigit] = useState<number | null>(null);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    
    // Trading Settings
    const [stake, setStake] = useState(1);
    const [entryDigit, setEntryDigit] = useState(7);
    const [isTurbo, setIsTurbo] = useState(false);
    const [selectedSymbol, setSelectedSymbol] = useState('R_100'); // Default Vol 100

    // List of Volatility Indices (Matching Deriv's internal IDs)
    const volatilityIndices = [
        { text: 'Volatility 10 Index', value: 'R_10' },
        { text: 'Volatility 25 Index', value: 'R_25' },
        { text: 'Volatility 50 Index', value: 'R_50' },
        { text: 'Volatility 75 Index', value: 'R_75' },
        { text: 'Volatility 100 Index', value: 'R_100' },
        { text: 'Volatility 10 (1s) Index', value: '1HZ10V' },
        { text: 'Volatility 100 (1s) Index', value: '1HZ100V' },
    ];

    // Reset stats when changing symbol
    useEffect(() => {
        setDigitStats(Array(10).fill(0));
        setLastDigit(null);
    }, [selectedSymbol]);

    useEffect(() => {
        if (!api_base?.api) return;

        // Subscribe to the selected symbol
        const ticks_sub = api_base.api.onMessage().subscribe((msg: any) => {
            // Ensure we only process ticks for our selected symbol
            if (msg.msg_type === 'tick' && msg.tick.symbol === selectedSymbol) {
                const quote = msg.tick.quote.toString();
                const digit = parseInt(quote.charAt(quote.length - 1));
                
                setLastDigit(digit);

                setDigitStats(prev => {
                    const newStats = [...prev];
                    newStats[digit] += 1;
                    return newStats;
                });

                if (isAutoRunning && digit === entryDigit) {
                    executeMultiTrade();
                }
            }
        });

        // Request the stream for the specific symbol
        api_base.api.send({ ticks: selectedSymbol });

        return () => {
            ticks_sub.unsubscribe();
            api_base.api.send({ forget_all: 'ticks' }); // Clean up stream on change/unmount
        };
    }, [isAutoRunning, entryDigit, isTurbo, selectedSymbol]);

    const executeMultiTrade = async () => {
        const common_params = {
            amount: stake,
            currency: client.currency,
            symbol: selectedSymbol,
            duration: 1,
            duration_unit: 't',
        };

        try {
            journal.pushMessage({ message: `Executing Trade on ${selectedSymbol} - Trigger: ${entryDigit}`, type: 'info' });

            const contracts = [
                api_base.api.buy({ ...common_params, contract_type: 'DIGITOVER', barrier: 5 }),
                api_base.api.buy({ ...common_params, contract_type: 'DIGITUNDER', barrier: 4 })
            ];

            const results = await Promise.all(contracts);
            
            results.forEach(res => {
                if (res.buy) {
                    summary_card.onContractStatusChange(res.buy.contract_id);
                }
            });

            if (!isTurbo) setIsAutoRunning(false);

        } catch (error: any) {
            journal.pushMessage({ message: error.message, type: 'error' });
            setIsAutoRunning(false);
        }
    };

    const totalTicks = useMemo(() => digitStats.reduce((a, b) => a + b, 0) || 1, [digitStats]);

    return (
        <div className="over-under-container">
            <div className="stats-grid">
                {digitStats.map((count, i) => {
                    const percentage = ((count / totalTicks) * 100).toFixed(1);
                    return (
                        <div key={i} className={`digit-card ${lastDigit === i ? 'active' : ''}`}>
                            <span className="digit-num">{i}</span>
                            <span className="digit-percent">{percentage}%</span>
                            <div className="digit-bar-wrapper">
                                <div className="digit-bar-fill" style={{ height: `${percentage}%` }}></div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="controls-panel">
                <div className="input-group">
                    <label>Select Market</label>
                    <select 
                        className="market-select"
                        value={selectedSymbol} 
                        onChange={(e) => setSelectedSymbol(e.target.value)}
                    >
                        {volatilityIndices.map(index => (
                            <option key={index.value} value={index.value}>{index.text}</option>
                        ))}
                    </select>
                </div>

                <div className="input-group">
                    <label>Stake (USD)</label>
                    <input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
                </div>

                <div className="input-group">
                    <label>Entry Digit</label>
                    <select value={entryDigit} onChange={(e) => setEntryDigit(Number(e.target.value))}>
                        {[0,1,2,3,4,5,6,7,8,9].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>

                <div className="toggle-group">
                    <button className={`btn-secondary ${isTurbo ? 'on' : ''}`} onClick={() => setIsTurbo(!isTurbo)}>
                        {isTurbo ? 'Turbo: ON' : 'Turbo: OFF'}
                    </button>
                </div>

                <button className={`btn-primary ${isAutoRunning ? 'running' : ''}`} onClick={() => setIsAutoRunning(!isAutoRunning)}>
                    {isAutoRunning ? 'STOP BOT' : 'START AUTO TRADE'}
                </button>
            </div>
        </div>
    );
});

export default OverUnder;
