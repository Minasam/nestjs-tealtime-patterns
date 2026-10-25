import { Controller, Headers, Logger, MessageEvent, Sse } from '@nestjs/common';
import { defer, finalize, map, Observable, repeat, timer } from 'rxjs';
import { randomBetween, randomMessage } from '../simulation/simulated-message';

/**
 * Pattern 2: Server-Sent Events.
 *
 * The client makes ONE HTTP request. The server answers with
 * Content-Type: text/event-stream and keeps the response open, writing a new
 * event whenever a (simulated) message is ready. One direction only:
 * server -> client.
 *
 * Every event carries an `id`. When the browser's EventSource reconnects it
 * sends the last id back in the `Last-Event-ID` header, so numbering
 * continues where it stopped instead of starting over.
 */
@Controller('sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  @Sse('stream')
  stream(@Headers('last-event-id') lastEventId?: string): Observable<MessageEvent> {
    const resumeFrom = Number(lastEventId);
    let nextId = Number.isInteger(resumeFrom) && resumeFrom > 0 ? resumeFrom + 1 : 1;
    this.logger.log(`Stream opened (starting at id ${nextId})`);

    // defer() picks a fresh random delay each time repeat() resubscribes.
    return defer(() => timer(randomBetween(1000, 4000))).pipe(
      repeat(),
      map((): MessageEvent => {
        const message = randomMessage(nextId++);
        return { id: String(message.id), type: 'message', data: message };
      }),
      // Nest unsubscribes when the client closes the connection.
      finalize(() => this.logger.log('Stream closed by client')),
    );
  }
}
