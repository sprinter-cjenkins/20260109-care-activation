import { PatientPayload } from '#patient/patient.service';
import { CareTaskType } from '@prisma/client';
import type { Request } from 'express';

export interface CallResult {
  callID: string;
  status: 'initiated' | 'completed' | 'failed';
  answeredBy?: 'human' | 'voicemail';
  summary?: CallSummary;
}

interface CallSummary {
  questions: Array<{ key: string; value: string }>;
  other: Array<{ key: string; value: string }>;
  verifications: Array<{ key: string; result: string; expected: string; received: string }>;
  requested_opt_out: boolean;
}

export interface CallInitiationRequest {
  patient: PatientPayload;
  careTaskType: CareTaskType;
}

export interface CallerProvider {
  initiateCall: (request: CallInitiationRequest) => Promise<CallResult>;
  getCall: (callID: string) => Promise<CallResult>;
  parseWebhook: (request: Request) => Promise<CallResult>;
}
