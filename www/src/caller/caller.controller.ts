import { Controller, Post, Param, HttpCode, HttpStatus, Get, Body } from '@nestjs/common';
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

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(@Body() payload: any): Promise<{ status: string }> {
    try {
      await this.callerService.handleWebhook(payload);
      return { status: 'ok' };
    } catch (error) {
      console.error('Failed to handle webhook:', error);
      return { status: 'error' };
    }
  }
}
