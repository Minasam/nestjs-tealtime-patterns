import { Module } from '@nestjs/common';
import { LongPollingController } from './long-polling/long-polling.controller';
import { SseController } from './sse/sse.controller';
import { ChatGateway } from './websocket/chat.gateway';

@Module({
  controllers: [SseController, LongPollingController],
  providers: [ChatGateway],
})
export class AppModule {}
