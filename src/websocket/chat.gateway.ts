import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import { randomBetween, randomMessage, replyTo } from '../simulation/simulated-message';
import type { SimulatedMessage } from '../simulation/simulated-message';

interface ClientState {
  nextId: number;
  timer?: NodeJS.Timeout;
}

export interface MessageAck {
  received: string;
  receivedAt: string;
}

/**
 * Pattern 1: WebSockets (via Socket.IO).
 *
 * A single persistent, full-duplex connection. Each connected client gets its
 * own simulation: the server pushes random messages at random intervals, and
 * every message the client sends is acknowledged and answered with a bot reply.
 * Nothing is broadcast; each socket only talks to the server.
 *
 * Client -> server events:  "message" { text }   (ack: { received, receivedAt })
 * Server -> client events:  "welcome" { id }      (once, on connect)
 *                           "message" SimulatedMessage
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    const state: ClientState = { nextId: 1 };
    client.data = state;
    client.emit('welcome', { id: client.id });
    this.scheduleRandomMessage(client);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Stop this client's simulation so timers don't outlive the connection.
    clearTimeout(this.state(client).timer);
  }

  @SubscribeMessage('message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { text?: unknown },
  ): MessageAck {
    const text = typeof body?.text === 'string' ? body.text.trim() : '';
    if (!text) {
      throw new WsException('"text" must be a non-empty string');
    }

    // Simulate the server "thinking" before replying, to this client only.
    setTimeout(() => {
      if (client.connected) {
        this.send(client, replyTo(this.state(client).nextId++, text));
      }
    }, randomBetween(500, 1500));

    // The returned value is sent back as the Socket.IO acknowledgement.
    return { received: text, receivedAt: new Date().toISOString() };
  }

  private scheduleRandomMessage(client: Socket): void {
    const state = this.state(client);
    state.timer = setTimeout(() => {
      this.send(client, randomMessage(state.nextId++));
      this.scheduleRandomMessage(client);
    }, randomBetween(2000, 6000));
  }

  private send(client: Socket, message: SimulatedMessage): void {
    client.emit('message', message);
  }

  private state(client: Socket): ClientState {
    return client.data as ClientState;
  }
}
