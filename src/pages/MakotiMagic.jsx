import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { motion } from 'framer-motion';
import { Zap, BarChart2, Cpu, RefreshCw } from 'lucide-react';
import MakotiMagicStore from '@/stores/makoti-magic-store';
import './MakotiMagic.scss';

const MakotiMagic = observer(() => {
    const {
        connectWebSocket,
        setSelectedSymbol,
        runScan,
        last_digit,
        prediction,
        is_loading,
        selected_symbol,
        connection_status,
    } = MakotiMagicStore;

    useEffect(() => {
        connectWebSocket();
    }, []);

    const volatilityOptions = [
        { label: 'V 10 Index', value: 'R_10' },
        { label: 'V 25 Index', value: 'R_25' },
        { label: 'V 50 Index', value: 'R_50' },
        { label: 'V 75 Index', value: 'R_75' },
        { label: 'V 100 Index', value: 'R_100' },
        { label: 'V 10 (1s)', value: '1HZ10V' },
        { label: 'V 25 (1s)', value: '1HZ25V' },
        { label: 'V 50 (1s)', value: '1HZ50V' },
        { label: 'V 75 (1s)', value: '1HZ75V' },
        { label: 'V 100 (1s)', value: '1HZ100V' },
    ];

    return (
        <div className='makoti-magic'>
            <header className='mm-header'>
                <div className='mm-header__left'>
                    <div className='mm-header__icon'><Zap size={17} /></div>
                    <div>
                        <div className='mm-header__title'>Makoti Magic</div>
                        <div className='mm-header__sub'>Prediction Engine</div>
                    </div>
                </div>
                <div className='mm-header__right'>
                    <div className='mm-connection-status'>
                        <div className={`mm-status-dot mm-status-dot--${connection_status.split(' ')[0].toLowerCase()}`} />
                        {connection_status}
                    </div>
                    <div className='mm-current-digit'>
                        <div className='mm-current-digit__label'>Live Digit</div>
                        <div className='mm-current-digit__value'>{last_digit === null ? '-' : last_digit}</div>
                    </div>
                </div>
            </header>

            <div className='mm-body'>
                <div className='mm-panel'>
                    <div className='mm-panel__title'>
                        <Cpu size={14} /> Configuration
                    </div>

                    <div className='mm-row-wrap'>
                        <div className='mm-row-label'><BarChart2 size={11} /> Market</div>
                        <div className='mm-row-fields'>
                            <div className='mm-f mm-f--grow'>
                                <span className='mm-fl'>Index</span>
                                <select
                                    className='mm-sel'
                                    value={selected_symbol}
                                    onChange={e => setSelectedSymbol(e.target.value)}
                                >
                                    {volatilityOptions.map(v => (
                                        <option key={v.value} value={v.value}>{v.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className='mm-prediction'>
                        <div className='mm-prediction__title'>Predicted Digit</div>
                        <div className='mm-prediction__digit'>
                            {prediction && prediction.predictedDigit !== null ? prediction.predictedDigit : '-'}
                        </div>
                    </div>

                    <div className='mm-cta-wrap'>
                        <motion.button className='mm-cta' onClick={runScan} disabled={is_loading}>
                            <span className='mm-cta__ico'>
                                {is_loading ? <RefreshCw size={17} className='mm-spin' /> : <Zap size={17} />}
                            </span>
                            <span className='mm-cta__txt'>{is_loading ? 'SCANNING...' : 'SCAN'}</span>
                        </motion.button>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default MakotiMagic;
