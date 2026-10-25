import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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
  poll(
    @Res({ passthrough: true }) res: Response,
    @Query('since') sinceParam?: string,
    @Query('timeout') timeoutParam?: string,
  ): Promise<PollResponse> {
    const since = this.parseCursor(sinceParam);
    const timeoutMs = this.parseTimeout(timeoutParam);
    const dataDelayMs = randomBetween(MIN_DATA_DELAY_MS, MAX_DATA_DELAY_MS);
    const startedAt = Date.now();
    this.logger.log(`Poll parked (since=${since}, timeout=${timeoutMs}ms)`);

    // Park the request until the simulated message is ready, the timeout fires,
    // or the client goes away, whichever happens first.
    return new Promise<PollResponse>((resolve) => {
      const finish = (message: SimulatedMessage | null) => {
        clearTimeout(dataTimer);
        clearTimeout(timeoutTimer);
        res.off('close', onClose);
        resolve({
          cursor: message ? message.id : since,
          message,
          timedOut: message === null,
          waitedMs: Date.now() - startedAt,
        });
      };

      const dataTimer = setTimeout(() => finish(randomMessage(since + 1)), dataDelayMs);
      const timeoutTimer = setTimeout(() => finish(null), timeoutMs);

      // Client aborted. Free the timers so parked requests don't leak.
      const onClose = () => {
        if (!res.writableEnded) {
          this.logger.log('Poll aborted by client');
          finish(null);
        }
      };
      res.on('close', onClose);
    });
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
