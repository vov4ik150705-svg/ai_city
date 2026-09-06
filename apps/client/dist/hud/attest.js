export function attestLabelKey(badge, root, cid) {
    if (badge === "verified" && root.length > 0 && cid.length > 0)
        return "UI_ATTEST_VERIFIED";
    if (badge === "degraded")
        return "UI_ATTEST_DEGRADED";
    return "UI_ATTEST_LOGGED";
}
