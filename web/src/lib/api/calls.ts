import { api } from "./client";

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: IceServerConfig[];
  /** Seconds the TURN credentials remain valid (STUN-only responses still send it). */
  ttl: number;
}

export const callsApi = {
  /** Fetch ICE servers (STUN always, TURN with short-lived creds when configured). */
  iceServers: () => api.get<IceServersResponse>("/api/calls/ice-servers"),
};
