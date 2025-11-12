import { Controller, Post, Param, HttpCode, HttpStatus, Get, Req } from '@nestjs/common';
import { CallerService, APICallResult } from './caller.service';
import type { Request } from 'express';
import { Public } from '#src/auth/public.decorator';

@Controller('caller')
export class CallerController {
  constructor(private readonly callerService: CallerService) {}

  @Post('initiate/:taskID')
  @HttpCode(HttpStatus.OK)
  async initiateCall(@Param('taskID') taskID: string): Promise<APICallResult> {
    return this.callerService.initiateCall(taskID);
  }

  @Get('status/:callID')
  async getCall(@Param('callID') callID: string): Promise<APICallResult> {
    return await this.callerService.getCall(callID);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @Public()
  async handleWebhook(@Req() req: Request): Promise<{ status: string }> {
    try {
      await this.callerService.handleWebhook(req);
      return { status: 'ok' };
    } catch (error) {
      console.error('Failed to handle webhook:', error);
      return { status: 'error' };
    }
  }
}
