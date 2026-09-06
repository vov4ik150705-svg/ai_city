import { codes } from "@corporator/protocol";
export function emptyLlmState() {
    return { inFlight: 0n };
}
export function completeLlm(pack, provider) {
    if (provider.ok) {
        return { text: provider.text, template: false, code: "" };
    }
    // DESIGN.md §5.4: provider refusal substitutes the template; the tick does not wait.
    if (pack.onProviderFail === "template") {
        return { text: pack.templateText, template: true, code: pack.templateCode };
    }
    return { text: pack.templateText, template: true, code: pack.templateCode };
}
export function enqueue(pack, state) {
    if (state.inFlight >= pack.queueCapacity) {
        return { next: state, code: codes.COMPANION_QUEUE_FULL };
    }
    return { next: { inFlight: state.inFlight + 1n }, code: "" };
}
