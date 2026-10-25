/**
 * Stateless helpers that fake "something happened on the server" events.
 * Each pattern uses these on its own; nothing is shared between connections.
 */
export interface SimulatedMessage {
  id: number;
  from: string;
  text: string;
  createdAt: string;
}

const SENDERS = ['price-bot', 'news-bot', 'weather-bot', 'order-service', 'chat-bot'];

const TEXTS = [
  'BTC just moved 2.3% in the last hour',
  'New order #4821 has been placed',
  'Heads up: rain expected around 6 PM',
  'Build #312 passed all checks',
  'Your report is ready to download',
  'A new user signed up from Berlin',
  'CPU usage on api-2 is back to normal',
  'Payment of $49.00 received',
  'Deployment to staging finished',
  'You have 3 unread notifications',
];

const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export function randomBetween(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

export function randomMessage(id: number): SimulatedMessage {
  return { id, from: pick(SENDERS), text: pick(TEXTS), createdAt: new Date().toISOString() };
}

export function replyTo(id: number, text: string): SimulatedMessage {
  const replies = [
    `Got it: "${text}"`,
    `Interesting, tell me more about "${text}"`,
    `"${text}" received and processed`,
    `You said "${text}" (${text.length} chars)`,
  ];
  return { id, from: 'chat-bot', text: pick(replies), createdAt: new Date().toISOString() };
}
