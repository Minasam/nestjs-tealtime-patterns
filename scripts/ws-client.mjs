// Minimal Socket.IO CLI client for testing the WebSocket gateway from a terminal.
//
//   npm run client:ws                 # type a line + Enter to send it
//   URL=http://host:3000 npm run client:ws
import { createInterface } from 'node:readline';
import { io } from 'socket.io-client';

const url = process.env.URL ?? 'http://localhost:3000';

// Force a real WebSocket upgrade straight away (skip the HTTP long-polling handshake).
const socket = io(`${url}/chat`, { transports: ['websocket'] });

socket.on('welcome', ({ id }) => console.log(`connected as ${id}. Type a message and press Enter.`));
socket.on('disconnect', (reason) => console.log(`disconnected: ${reason}`));
socket.on('connect_error', (err) => console.error(`connect error: ${err.message}`));
socket.on('message', (m) => console.log(`#${m.id} ${m.from}: ${m.text}`));
socket.on('exception', (err) => console.error(`server error: ${err.message}`));

const rl = createInterface({ input: process.stdin });
rl.on('line', async (text) => {
  if (!text.trim()) return;
  try {
    const ack = await socket.timeout(5000).emitWithAck('message', { text });
    console.log(`ack: server received "${ack.received}"`);
  } catch (err) {
    console.error(`no ack: ${err.message}`);
  }
});
rl.on('close', () => socket.close());
