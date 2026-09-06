export function assembleSessionMessage(fields, values) {
    const lines = [];
    for (const key of fields) {
        const val = values[key];
        if (val === undefined)
            throw new Error("session message");
        lines.push(key + "=" + val);
    }
    return lines.join("\n");
}
export function sessionMessageValues(args) {
    const out = {
        domain: args.domain,
        address: args.address,
        nonce: args.nonce,
        pack_hash: args.packHash,
        expires_city_time: args.expiresCityTime,
    };
    return out;
}
