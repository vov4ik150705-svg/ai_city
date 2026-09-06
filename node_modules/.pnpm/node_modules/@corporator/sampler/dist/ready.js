import { createServer } from "node:http";
import { canonical } from "@corporator/contentpack";
import { listenBindOrEnv, readyTemplate, transportHttp } from "@corporator/protocol";
function portNumber(port) {
    const n = Number(port);
    if (n.toString() !== port.toString())
        throw new Error("listen port");
    return n;
}
export function listenReady(hash, port) {
    const server = createServer((req, res) => {
        const url = req.url ?? "";
        if (req.method === "GET" && url === readyTemplate) {
            res.statusCode = Number(transportHttp.API_INTENT_REPLAY);
            res.end(Buffer.from(canonical({ pack_hash: hash, ready: 1n })));
            return;
        }
        res.statusCode = Number(transportHttp.API_MALFORMED);
        res.end();
    });
    return new Promise((resolve, reject) => {
        server.listen(portNumber(port), listenBindOrEnv(process.env.CORPORATOR_LISTEN_BIND), () => {
            resolve({
                port,
                close: () => new Promise((done, fail) => {
                    server.close((err) => {
                        if (err)
                            fail(err);
                        else
                            done();
                    });
                }),
            });
        });
        server.on("error", reject);
    });
}
