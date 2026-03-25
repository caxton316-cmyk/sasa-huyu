import { makeAutoObservable, action } from 'mobx';

class MakotiMagicStore {
    is_loading = false;
    is_running = false;
    connection_status = 'OFFLINE';
    last_digit = null;
    prediction = null;
    selected_symbol = 'R_100';
    ws = null;

    constructor() {
        makeAutoObservable(this, {
            runScan: action,
            connectWebSocket: action,
            setSelectedSymbol: action,
        });
    }

    setSelectedSymbol = (symbol) => {
        this.selected_symbol = symbol;
    }

    connectWebSocket = () => {
        const server_url = localStorage.getItem('config.server_url') || 'ws.binaryws.com';
        const app_id = 101585;
        this.ws = new WebSocket(`wss://${server_url}/websockets/v3?app_id=${app_id}`);

        this.ws.onopen = () => {
            this.connection_status = 'LIVE';
            const token = localStorage.getItem('authToken') || localStorage.getItem('token');
            if (token) {
                this.ws.send(JSON.stringify({ authorize: token }));
            }
            this.ws.send(JSON.stringify({ ticks: this.selected_symbol, subscribe: 1 }));
        };

        this.ws.onmessage = (msg) => {
            const data = JSON.parse(msg.data);
            if (data.error) {
                console.error(data.error.message);
                return;
            }
            if (data.msg_type === 'tick') {
                this.last_digit = parseInt(data.tick.quote.toString().slice(-1));
            }
        };

        this.ws.onclose = () => {
            this.connection_status = 'OFFLINE';
        };
    }

    runScan = () => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error("WebSocket is not connected.");
            return;
        }

        this.is_loading = true;

        // Simulate a scan
        setTimeout(() => {
            const predictedDigit = Math.floor(Math.random() * 10);
            this.prediction = { predictedDigit };
            this.is_loading = false;
        }, 2000);
    };
}

export default new MakotiMagicStore();
