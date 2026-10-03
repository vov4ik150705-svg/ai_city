// View contract for the implementing agent. This file changes no runtime logic.
export type EntryPhase = 'idle' | 'connecting' | 'signing' | 'wrong_chain' | 'rejected' | 'error' | 'loading' | 'demo_loading';
export type GameEntryViewProps = {
  phase: EntryPhase;
  errorText?: string;
  backHref: string;
  onConnect: () => void;
  onDemo: () => void;
  onSwitchNetwork?: () => void;
};
