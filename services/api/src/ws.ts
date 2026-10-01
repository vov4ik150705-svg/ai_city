import { createHash } from "node:crypto"
import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"
import { canonical, type Json } from "@corporator/contentpack"

const guid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

export function wsAccept(key: string): string {
  return createHash("sha1").update(key + guid).digest("base64")
}

export function textFrame(payload: Uint8Array): Uint8Array {
  const n = payload.length
  const small = 126
  if (n < small) {
    const out = new Uint8Array(2 + n)
    out[0] = 129
    out[1] = n
    out.set(payload, 2)
    return out
  }
  const out = new Uint8Array(4 + n)
  out[0] = 129
  out[1] = small
  out[2] = (n >> 8) & 255
  out[3] = n & 255
  out.set(payload, 4)
  return out
}

/** HTTP refusal before the 101 handshake. The socket is closed after the body. */
export function rejectUnauthorized(socket: Duplex, status: number, body: Uint8Array): void {
  const head =
    "HTTP/1.1 " +
    status.toString() +
    " Unauthorized\r\nConnection: close\r\nContent-Type: application/json\r\nContent-Length: " +
    body.length.toString() +
    "\r\n\r\n"
  socket.write(head)
  socket.write(body)
  socket.end()
}

function isHexId(id: string): boolean {
  if (id.length === 0) return false
  for (let i = 0; i < id.length; i++) {
    const ch = id.charAt(i)
    const hex = (ch >= "0" && ch <= "9") || (ch >= "a" && ch <= "f")
    if (!hex) return false
  }
  return true
}

/** Browser sockets cannot set Authorization. The same bearer rides as one protocol token. */
export function bearerFromProtocol(
  protocolHeader: string | undefined,
  scheme: string,
): { readonly authorization: string; readonly selected: string } {
  if (protocolHeader === undefined || scheme.length === 0) return { authorization: "", selected: "" }
  const prefix = scheme + "."
  for (const part of protocolHeader.split(",")) {
    const token = part.trim()
    if (!token.startsWith(prefix)) continue
    const id = token.slice(prefix.length)
    if (!isHexId(id)) continue
    return { authorization: scheme + " " + id, selected: token }
  }
  return { authorization: "", selected: "" }
}

export function handshake(socket: Duplex, req: IncomingMessage, selectedProtocol = ""): boolean {
  const key = req.headers["sec-websocket-key"]
  if (typeof key !== "string" || key.length === 0) {
    socket.destroy()
    return false
  }
  const accept = wsAccept(key)
  let head =
    "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
    accept +
    "\r\n"
  if (selectedProtocol.length > 0) head += "Sec-WebSocket-Protocol: " + selectedProtocol + "\r\n"
  head += "\r\n"
  socket.write(head)
  return true
}

export function pulseFrame(extra: { readonly [key: string]: Json }): Uint8Array {
  return textFrame(canonical(extra))
}
