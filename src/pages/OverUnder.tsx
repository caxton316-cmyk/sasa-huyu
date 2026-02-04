import React, { useState, useEffect, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { CONNECTION_STATUS } from '@/external/bot-skeleton/services/api/observables/connection-status-stream';
import './over-under.scss';

const OverUnder = observer(() => {
    const { summary_card, journal, client } = useStore();
    const { connectionStatus } = useApiBase();
    
    const [digitStats, setDigitStats] = useState(Array(10).fill(0));
    const [lastDigit, setLastDigit] = useState<number | null>(null);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    
    // Trading Settings
    const [stake, setStake] = useState(1);
    const [entryDigit, setEntryDigit] = useState(7);
    const [isTurbo, setIsTurbo] = useState(false);
    const [selectedSymbol, setSelectedSymbol] = useState('R_100');

    const ticks_subscription = useRef<any>(null);

    const volatilityIndices = [
        { text: 'Volatility 10 Index', value: 'R_10' },
        { text: 'Volatility 25 Index', value: 'R_25' },
        { text: 'Volatility 50 Index', value: 'R_50' },
        { text: 'Volatility 75 Index', value: 'R_75' },
        { text: 'Volatility 100 Index', value: 'R_100' },
        { text: 'Volatility 10 (1s) Index', value: '1HZ10V' },
        { text: 'Volatility 100 (1s) Index', value: '1HZ100V' },
    ];

    // Effect to force WS reconnection on App ID change
    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === 'current_trading_app_id' && api_base?.api?.connection) {
                journal.pushMessage({ message: 'App ID changed. Forcing WebSocket reconnection...', type: 'info' });
                api_base.api.connection.close();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [journal]);

    // Main effect for subscribing to ticks based on connection status and symbol
    useEffect(() => {
        const subscribeToTicks = () => {
            journal.pushMessage({ message: `Subscribing to ${selectedSymbol}...`, type: 'info' });
            // Unsubscribe from any existing stream first
            if (ticks_subscription.current) {
                ticks_subscription.current.unsubscribe();
            }
            api_base.api.send({ forget_all: 'ticks' });

            // Reset stats for the new subscription
            setDigitStats(Array(10).fill(0));
            setLastDigit(null);

            ticks_subscription.current = api_base.api.onMessage().subscribe((msg: any) => {
                if (msg.error) {
                    journal.pushMessage({ message: `Tick stream error: ${msg.error.message}`, type: 'error' });
                    return;
                }
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

            api_base.api.send({ ticks: selectedSymbol, subscribe: 1 });
        };

        if (connectionStatus === CONNECTION_STATUS.OPENED && api_base?.api) {
            subscribeToTicks();
        } else {
            journal.pushMessage({ message: 'Waiting for WebSocket connection...', type: 'info' });
        }

        return () => {
            if (ticks_subscription.current) {
                ticks_subscription.current.unsubscribe();
                if (api_base?.api?.connection?.readyState === 1) {
                    api_base.api.send({ forget_all: 'ticks' });
                }
            }
        };
    }, [connectionStatus, selectedSymbol, journal]);

    // Keep-alive for WebSocket
    useEffect(() => {
        const keep_alive = setInterval(() => {
            if (api_base?.api?.connection?.readyState === 1) {
                api_base.api.send({ ping: 1 });
            }
        }, 15000);
        return () => clearInterval(keep_alive);
    }, []);

    const executeMultiTrade = async () => {
        const common_params = {
            amount: stake,
            currency: client.currency,
            symbol: selectedSymbol,
            duration: 1,
            duration_unit: 't',
        };

        try {
            journal.pushMessage({ message: `🎯 Trigger Hit: ${entryDigit}. Executing Dual Trade...`, type: 'info' });

            const contracts = [
                api_base.api.buy({ ...common_params, contract_type: 'DIGITOVER', barrier: 5 }),
                api_base.api.buy({ ...common_params, contract_type: 'DIGITUNDER', barrier: 4 })
            ];

            const results = await Promise.all(contracts);
            results.forEach(res => {
                if (res.buy) summary_card.onContractStatusChange(res.buy.contract_id);
            });

            if (!isTurbo) setIsAutoRunning(false);

        } catch (error: any) {
            journal.pushMessage({ message: `Trade Error: ${error.message}`, type: 'error' });
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
                    <label>Connection</label>
                    <div className={`connection-status ${connectionStatus === CONNECTION_STATUS.OPENED ? 'connected' : 'disconnected'}`}>
                        {connectionStatus === CONNECTION_STATUS.OPENED ? 'Connected' : 'Disconnected'}
                    </div>
                </div>
                <div className="input-group">
                    <label>Volatility</label>
                    <select className="ui-select" value={selectedSymbol} onChange={(e) => setSelectedSymbol(e.target.value)}>
                        {volatilityIndices.map(index => <option key={index.value} value={index.value}>{index.text}</option>)}
                    </select>
                </div>

                <div className="input-group">
                    <label>Stake ({client.currency})</label>
                    <input className="ui-input" type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} />
                </div>

                <div className="input-group">
                    <label>Entry Digit</label>
                    <div className="entry-config">
                        <input 
                            className="ui-input digit-entry" 
                            type="number" min="0" max="9" 
                            value={entryDigit} 
                            onChange={(e) => setEntryDigit(Number(e.target.value))} 
                        />
                        <div className={`status-led ${lastDigit === entryDigit ? 'glow' : ''}`}></div>
                    </div>
                </div>

                <div className="button-group">
                    <button className={`btn-secondary ${isTurbo ? 'active' : ''}`} onClick={() => setIsTurbo(!isTurbo)}>
                        {isTurbo ? 'TURBO ON' : 'TURBO OFF'}
                    </button>
                    <button className={`btn-primary ${isAutoRunning ? 'running' : ''}`} onClick={() => setIsAutoRunning(!isAutoRunning)}>
                        {isAutoRunning ? 'STOP BOT' : 'START MULTI-TRADE'}
                    </button>
                </div>
            </div>
        </div>
    );
});

export default OverUnder;
