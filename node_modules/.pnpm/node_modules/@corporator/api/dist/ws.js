import { createHash } from "node:crypto";
import { canonical } from "@corporator/contentpack";
const guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
export function wsAccept(key) {
    return createHash("sha1").update(key + guid).digest("base64");
}
export function textFrame(payload) {
    const n = payload.length;
    const small = 126;
    if (n < small) {
        const out = new Uint8Array(2 + n);
        out[0] = 129;
        out[1] = n;
        out.set(payload, 2);
        return out;
    }
    const out = new Uint8Array(4 + n);
    out[0] = 129;
    out[1] = small;
    out[2] = (n >> 8) & 255;
    out[3] = n & 255;
    out.set(payload, 4);
    return out;
}
export function handshake(socket, req) {
    const key = req.headers["sec-websocket-key"];
    if (typeof key !== "string" || key.length === 0) {
        socket.destroy();
        return false;
    }
    const accept = wsAccept(key);
    socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
        accept +
        "\r\n\r\n");
    return true;
}
export function pulseFrame(extra) {
    return textFrame(canonical(extra));
}
