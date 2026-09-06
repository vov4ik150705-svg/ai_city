import { readWalletPrice, } from "@corporator/chainport";
export async function stepWalletPrice(port, account, transport, last) {
    return readWalletPrice(port, account, transport, last);
}
