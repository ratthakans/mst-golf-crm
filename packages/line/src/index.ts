// @mstgolf/line — thin wrapper around @line/bot-sdk.
// Stub for M0; real client (Messaging API, webhook signature verify, Rich Menu,
// LIFF helpers) lands in M1. Credentials are resolved per-org from LineChannel
// (decrypted via @mstgolf/shared).

export interface LineChannelCredentials {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  liffId?: string;
}

/**
 * Placeholder factory. In M1 this returns a configured @line/bot-sdk client
 * bound to a single org's decrypted credentials.
 */
export function createLineClient(_creds: LineChannelCredentials): void {
  throw new Error("createLineClient is not implemented until M1");
}
