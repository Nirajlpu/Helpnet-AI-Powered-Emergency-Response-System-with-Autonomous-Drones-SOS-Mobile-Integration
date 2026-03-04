class WebSocketService {
    constructor() {
        this.socket = null;
        this.listeners = new Map();
    }

    connect(url) {
        if (!this.socket) {
            this.socket = new WebSocket(url);
            this.socket.onmessage = this.handleMessage.bind(this);
            this.socket.onclose = () => { this.socket = null; };
        }
    }

    handleMessage(event) {
        let data = event.data;
        try { data = JSON.parse(data); } catch (e) { }
        this.listeners.forEach(callback => callback(data));
    }

    subscribe(callback) {
        const id = Date.now().toString();
        this.listeners.set(id, callback);
        return () => this.listeners.delete(id);
    }

    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
