export declare function leafHash(blob: Uint8Array, leafPrefix: Uint8Array): Uint8Array;
export declare function nodeHash(left: Uint8Array, right: Uint8Array, nodePrefix: Uint8Array): Uint8Array;
export declare function merkleRoot(blobs: readonly Uint8Array[], leafPrefix: Uint8Array, nodePrefix: Uint8Array): Uint8Array;
export type ProofSide = "L" | "R";
export type ProofItem = readonly [ProofSide, string];
export declare function merkleProof(blobs: readonly Uint8Array[], index: number, leafPrefix: Uint8Array, nodePrefix: Uint8Array): ProofItem[];
export declare function verifyProof(blob: Uint8Array, proof: readonly ProofItem[], root: Uint8Array, leafPrefix: Uint8Array, nodePrefix: Uint8Array): boolean;
