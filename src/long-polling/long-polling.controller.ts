import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomBetween, randomMessage } from '../simulation/simulated-message';
import type { SimulatedMessage } from '../simulation/simulated-message';

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;
/** Simulated "next message" arrives somewhere in this window. Sometimes after the timeout. */
const MIN_DATA_DELAY_MS = 1_000;
const MAX_DATA_DELAY_MS = 15_000;

export interface PollResponse {
  /** Pass this back as `?since=` on the next poll. */
  cursor: number;
  message: SimulatedMessage | null;
  timedOut: boolean;
  waitedMs: number;
}

/**
 * Pattern 3: Long polling.
 *
 * The client sends an ordinary HTTP request. The server does NOT answer right away.
 * It holds the request open until either:
 *   - a (simulated) message becomes available  -> respond with it, or
 *   - the timeout expires                      -> respond with message: null.
 * The client then immediately sends the next poll with the returned cursor.
 */
@Controller('long-polling')
export class LongPollingController {
  private readonly logger = new Logger(LongPollingController.name);

  @Get()
  async poll(
    @Res({ passthrough: true }) res: Response,
    @Query('since') sinceParam?: string,
    @Query('timeout') timeoutParam?: string,
  ): Promise<PollResponse> {
    const since = this.parseCursor(sinceParam);
    const timeoutMs = this.parseTimeout(timeoutParam);
    const startedAt = Date.now();
    this.logger.log(`Poll parked (since=${since}, timeout=${timeoutMs}ms)`);

    // Cancels whichever wait is still pending once we have an answer,
    // or both of them if the client goes away first.
    const abort = new AbortController();
    const onClose = () => {
      if (!res.writableEnded) {
        this.logger.log('Poll aborted by client');
        abort.abort();
      }
    };
    res.on('close', onClose);

    let message: SimulatedMessage | null = null;
    try {
      // Park the request until the simulated message is ready or the timeout fires.
      message = await Promise.race([
        this.waitForMessage(since + 1, abort.signal),
        sleep(timeoutMs, null, { signal: abort.signal }),
      ]);
    } catch (err) {
      // An aborted wait means the client disconnected; anything else is a real error.
      if (!abort.signal.aborted) throw err;
    } finally {
      abort.abort(); // clear the losing timer so parked requests don't leak
      res.off('close', onClose);
    }

    return {
      cursor: message ? message.id : since,
      message,
      timedOut: message === null,
      waitedMs: Date.now() - startedAt,
    };
  }

  /** Simulates "new data arrives on the server" after a random delay. */
  private async waitForMessage(id: number, signal: AbortSignal): Promise<SimulatedMessage> {
    await sleep(randomBetween(MIN_DATA_DELAY_MS, MAX_DATA_DELAY_MS), undefined, { signal });
    return randomMessage(id);
  }

  private parseCursor(value?: string): number {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  }

  private parseTimeout(value?: string): number {
    const n = Number(value);
    if (!value || !Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
    return Math.min(n, MAX_TIMEOUT_MS);
  }
}
