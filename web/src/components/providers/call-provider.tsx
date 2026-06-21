"use client";

import { useEffect } from "react";
import { getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@/lib/events";
import { getPeer } from "@/lib/conversation";
import { useChatStore } from "@/store/chat";
import * as call from "@/lib/call/call-manager";
import { CallOverlay } from "@/components/call/call-overlay";
import { useAuth } from "./auth-provider";
import type { CallMedia } from "@/store/call";
import type { UserRef } from "@/types";

interface From {
  id: string;
  username: string;
}
interface OfferPayload {
  conversationId: string;
  callId: string;
  media: CallMedia;
  sdp: RTCSessionDescriptionInit;
  from: From;
}
interface AnswerPayload {
  callId: string;
  sdp: RTCSessionDescriptionInit;
}
interface IcePayload {
  callId: string;
  candidate: RTCIceCandidateInit;
}
interface TerminalPayload {
  callId: string;
}

/** Bridges call signaling from the socket into the call manager, and renders the call UI. */
export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    // Prefer the rich peer from our loaded conversation; fall back to the id/username on the signal.
    const resolvePeer = (conversationId: string, from: From): UserRef => {
      const conversation = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      const peer = conversation ? getPeer(conversation, user.id) : undefined;
      return peer ?? { id: from.id, username: from.username, displayName: from.username, avatarUrl: "" };
    };

    const onOffer = (p: OfferPayload) => call.handleIncomingOffer(p, resolvePeer(p.conversationId, p.from));
    const onAnswer = (p: AnswerPayload) => void call.handleAnswer(p);
    const onIce = (p: IcePayload) => void call.handleRemoteIce(p);
    const onDecline = (p: TerminalPayload) => call.handleDecline(p);
    const onCancel = (p: TerminalPayload) => call.handleCancel(p);
    const onEnd = (p: TerminalPayload) => call.handleRemoteEnd(p);
    const onBusy = (p: TerminalPayload) => call.handleBusy(p);
    const onUnavailable = (p: TerminalPayload) => call.handleUnavailable(p);

    socket.on(SOCKET_EVENTS.CALL_OFFER, onOffer);
    socket.on(SOCKET_EVENTS.CALL_ANSWER, onAnswer);
    socket.on(SOCKET_EVENTS.CALL_ICE, onIce);
    socket.on(SOCKET_EVENTS.CALL_DECLINE, onDecline);
    socket.on(SOCKET_EVENTS.CALL_CANCEL, onCancel);
    socket.on(SOCKET_EVENTS.CALL_END, onEnd);
    socket.on(SOCKET_EVENTS.CALL_BUSY, onBusy);
    socket.on(SOCKET_EVENTS.CALL_UNAVAILABLE, onUnavailable);

    return () => {
      socket.off(SOCKET_EVENTS.CALL_OFFER, onOffer);
      socket.off(SOCKET_EVENTS.CALL_ANSWER, onAnswer);
      socket.off(SOCKET_EVENTS.CALL_ICE, onIce);
      socket.off(SOCKET_EVENTS.CALL_DECLINE, onDecline);
      socket.off(SOCKET_EVENTS.CALL_CANCEL, onCancel);
      socket.off(SOCKET_EVENTS.CALL_END, onEnd);
      socket.off(SOCKET_EVENTS.CALL_BUSY, onBusy);
      socket.off(SOCKET_EVENTS.CALL_UNAVAILABLE, onUnavailable);
    };
  }, [user]);

  return (
    <>
      {children}
      <CallOverlay />
    </>
  );
}
