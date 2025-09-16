import { Controller, Post, Param, HttpCode, HttpStatus, Get } from '@nestjs/common';
import { CallerService, CallResult } from './caller.service';

@Controller('caller')
export class CallerController {
  constructor(private readonly callerService: CallerService) {}

  @Post('initiate/:taskId')
  @HttpCode(HttpStatus.OK)
  async initiateCall(@Param('taskId') taskId: string): Promise<CallResult> {
    return this.callerService.initiateCall(taskId);
  }

  @Get('status/:callId')
  async getCallStatus(@Param('callId') callId: string): Promise<CallResult> {
    return this.callerService.getCallStatus(callId);
  }
}
