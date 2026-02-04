import React, { useState, useEffect, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import './over-under.scss';

// Connection Statuses
const STATUS_DISCONNECTED = 'Disconnected';
const STATUS_CONNECTING = 'Connecting...';
const STATUS_CONNECTED = 'Connected';
const STATUS_AUTHORIZED = 'Authorized';

const OverUnder = observer(() => {
    const { summary_card, journal, client } = useStore();
    const ws = useRef<WebSocket | null>(null);

    // State
    const [connectionStatus, setConnectionStatus] = useState(STATUS_DISCONNECTED);
    const [digitStats, setDigitStats] = useState(Array(10).fill(0));
    const [lastDigit, setLastDigit] = useState<number | null>(null);
    const [isAutoRunning, setIsAutoRunning] = useState(false);
    
    // Settings
    const [stake, setStake] = useState(1);
    const [entryDigit, setEntryDigit] = useState(7);
    const [isTurbo, setIsTurbo] = useState(false);
    const [selectedSymbol, setSelectedSymbol] = useState('R_100');

    const volatilityIndices = [
        { text: 'Volatility 100 Index', value: 'R_100' },
        { text: 'Volatility 10 (1s) Index', value: '1HZ10V' },
    ];

    const reconnect = () => {
        if (ws.current && ws.current.readyState < 2) { // < 2 means CONNECTING or OPEN
            ws.current.close();
        }
        setConnectionStatus(STATUS_CONNECTING);
        ws.current = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=80058');

        ws.current.onopen = () => {
            setConnectionStatus(STATUS_CONNECTED);
            const token = localStorage.getItem('authToken');
            if (token) {
                ws.current?.send(JSON.stringify({ authorize: token }));
            } else {
                journal.pushMessage({ message: 'Authentication token not found.', type: 'error' });
            }
        };

        ws.current.onmessage = (msg) => {
            const data = JSON.parse(msg.data);

            if (data.error) {
                journal.pushMessage({ message: `Error: ${data.error.message}`, type: 'error' });
                return;
            }

            if (data.msg_type === 'authorize') {
                if (data.authorize) {
                    setConnectionStatus(STATUS_AUTHORIZED);
                    subscribeToTicks(selectedSymbol);
                }
            }

            if (data.msg_type === 'tick') {
                const quote = data.tick.quote.toString();
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
        };

        ws.current.onclose = () => {
            setConnectionStatus(STATUS_DISCONNECTED);
            // Optional: implement a retry mechanism
        };
    };
    
    const subscribeToTicks = (symbol: string) => {
        if (ws.current?.readyState !== 1) return;
        ws.current.send(JSON.stringify({ forget_all: 'ticks' }));
        
        setDigitStats(Array(10).fill(0));
        setLastDigit(null);
        
        ws.current.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
        journal.pushMessage({ message: `Subscribed to ${symbol}.`, type: 'info' });
    };

    useEffect(() => {
        reconnect();
        return () => ws.current?.close();
    }, []); // Initial connection

    useEffect(() => {
        if (connectionStatus === STATUS_AUTHORIZED) {
            subscribeToTicks(selectedSymbol);
        }
    }, [selectedSymbol, connectionStatus]);

    const executeMultiTrade = () => {
        if (ws.current?.readyState !== 1) return;

        const common_params = {
            amount: stake,
            currency: client.currency,
            symbol: selectedSymbol,
            duration: 1,
            duration_unit: 't',
        };

        journal.pushMessage({ message: `🎯 Trigger Hit: ${entryDigit}. Executing Dual Trade...`, type: 'info' });
        
        ws.current.send(JSON.stringify({ buy: 1, ...common_params, contract_type: 'DIGITOVER', barrier: 5 }));
        ws.current.send(JSON.stringify({ buy: 1, ...common_params, contract_type: 'DIGITUNDER', barrier: 4 }));
        
        // Note: We are not handling the buy response here, but we should
        if (!isTurbo) setIsAutoRunning(false);
    };
    
    const totalTicks = useMemo(() => digitStats.reduce((a, b) => a + b, 0) || 1, [digitStats]);

    const getStatusClassName = () => {
        switch(connectionStatus) {
            case STATUS_AUTHORIZED:
                return 'connected';
            case STATUS_CONNECTING:
            case STATUS_CONNECTED:
                return 'authorizing';
            default:
                return 'disconnected';
        }
    }

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
                    <div className={`connection-status ${getStatusClassName()}`}>
                        {connectionStatus}
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
