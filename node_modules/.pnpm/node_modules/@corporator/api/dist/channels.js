import { channelMap } from "@corporator/protocol";
export function createHub() {
    const subs = {};
    return {
        subscribe(channel, handler) {
            const cur = subs[channel];
            if (cur === undefined)
                subs[channel] = [handler];
            else
                cur.push(handler);
        },
        publishSource(sourceId, payload) {
            const channel = channelOfSource(sourceId);
            if (channel === undefined)
                return;
            const handlers = subs[channel];
            if (handlers === undefined)
                return;
            for (const h of handlers)
                h(payload);
        },
        hasChannel(name) {
            return channelOfSource(name) !== undefined || channelNameExists(name);
        },
        channelOf(sourceId) {
            return channelOfSource(sourceId);
        },
        sourceIds() {
            return Object.keys(channelMap);
        },
    };
}
function channelOfSource(sourceId) {
    if (sourceId in channelMap) {
        return channelMap[sourceId];
    }
    return undefined;
}
function channelNameExists(name) {
    for (const key of Object.keys(channelMap)) {
        const ch = channelMap[key];
        if (ch === name)
            return true;
    }
    return false;
}
export function partitionsSources(hub) {
    const ids = hub.sourceIds();
    if (ids.length === 0)
        return false;
    const seen = new Set();
    for (const id of ids) {
        if (seen.has(id))
            return false;
        seen.add(id);
        if (hub.channelOf(id) === undefined)
            return false;
    }
    return true;
}
