import { awsDeps } from '../adapters/aws';
import { runHourly } from '../services/jobs';

export async function handler() {
  const result = await runHourly(awsDeps());
  console.log('hourly job done', result);
  return result;
}
