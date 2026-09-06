import { codes } from "@corporator/protocol";
import { submitMinuteRoot } from "@corporator/chainport";
export async function drainRootOutbox(port, jobs) {
    const rest = [];
    let degraded = "";
    for (const job of jobs) {
        const result = await submitMinuteRoot(port, job.cityId, job.cityDay, job.rootHex);
        if (result.ok)
            continue;
        rest.push(job);
        degraded = codes.SERVICE_DEGRADED;
    }
    return { rest, degraded };
}
