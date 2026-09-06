import { createServer } from "node:http";
import { canonical } from "@corporator/contentpack";
import { listenBindOrEnv, readyTemplate, transportHttp } from "@corporator/protocol";
function portNumber(port) {
    const n = Number(port);
    if (n.toString() !== port.toString())
        throw new Error("listen port");
    return n;
}
function readBody(req, done, fail) {
    const chunks = [];
    req.on("data", (c) => {
        chunks.push(c);
    });
    req.on("end", () => {
        done(new Uint8Array(Buffer.concat(chunks)));
    });
    req.on("error", fail);
}
export function listenReady(hash, port, submit) {
    const server = createServer((req, res) => {
        const url = req.url ?? "";
        if (req.method === "GET" && url === readyTemplate) {
            res.statusCode = Number(transportHttp.API_INTENT_REPLAY);
            res.end(Buffer.from(canonical({ pack_hash: hash, ready: 1n })));
            return;
        }
        if (req.method === "POST" && url === readyTemplate && submit !== undefined) {
            readBody(req, (body) => {
                void submit(body)
                    .then((out) => {
                    res.statusCode = Number(transportHttp.API_INTENT_REPLAY);
                    res.end(Buffer.from(out));
                })
                    .catch(() => {
                    res.statusCode = Number(transportHttp.SERVICE_DEGRADED);
                    res.end();
                });
            }, () => {
                res.statusCode = Number(transportHttp.API_MALFORMED);
                res.end();
            });
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
