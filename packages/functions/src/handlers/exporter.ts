import { awsDeps } from '../adapters/aws';
import { runExport } from '../services/exporter';

export async function handler(event: { householdId: string; jobId: string }) {
  await runExport(awsDeps(), event.householdId, event.jobId);
}
