import tracer from 'dd-trace';

export type Metric =
  | 'caller.call_initiated'
  | 'caller.call_completed'
  | 'caller.call_failed'
  | 'caller.patient_opted_out';

const METRIC_PREFIX = 'care_activation';
// Tags should be low cardinality
export function incrementMetric(
  metric: Metric,
  tags: Record<string, string> = {},
  count: number = 1,
) {
  const metricName = [METRIC_PREFIX, metric].join('.');
  if (process.env.NODE_ENV === 'production') {
    tracer.dogstatsd.increment(metricName, count, tags);
  }
}
