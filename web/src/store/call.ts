import { create } from "zustand";
import type { UserRef } from "@/types";

export type CallMedia = "audio" | "video";

export type CallStatus =
  | "idle" // no call
  | "outgoing" // we're calling, awaiting answer
  | "incoming" // someone is ringing us
  | "connecting" // answered, negotiating the peer connection
  | "active" // media flowing
  | "ended"; // brief terminal state, then resets

export interface CallState {
  status: CallStatus;
  callId: string | null;
  conversationId: string | null;
  peer: UserRef | null;
  media: CallMedia;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  /** ms timestamp when the call became active (for the duration timer). */
  startedAt: number | null;
  /** Human-readable reason shown briefly when a call ends. */
  endedReason: string | null;

  /** Shallow-merge a partial update (used by the call manager). */
  patch: (partial: Partial<CallState>) => void;
  reset: () => void;
}

const initialState: Omit<CallState, "patch" | "reset"> = {
  status: "idle",
  callId: null,
  conversationId: null,
  peer: null,
  media: "audio",
  localStream: null,
  remoteStream: null,
  muted: false,
  cameraOff: false,
  startedAt: null,
  endedReason: null,
};

export const useCallStore = create<CallState>((set) => ({
  ...initialState,
  patch: (partial) => set(partial),
  reset: () => set(initialState),
}));
