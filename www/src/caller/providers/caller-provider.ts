import { CareTaskType, Patient } from '@prisma/client';

export interface CallResult {
  callId: string;
  status: 'initiated' | 'completed' | 'failed';
  answeredBy?: 'human' | 'voicemail';
  summary?: CallSummary;
}

interface CallSummary {
  questions: Array<{ key: string; value: string }>;
  other: Array<{ key: string; value: string }>;
}

export interface CallInitiationRequest {
  patient: Patient;
  taskType: CareTaskType;
}

export interface CallerProvider {
  initiateCall: (request: CallInitiationRequest) => Promise<CallResult>;
  getCall: (callId: string) => Promise<CallResult>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseWebhook: (payload: any) => CallResult;
}
