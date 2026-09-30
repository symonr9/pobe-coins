/**
 * Household data export: a ZIP with every record as JSON, the ledger as CSV, and photos.
 * Runs asynchronously (its own Lambda) and notifies the requester when ready.
 */
import { strToU8, zipSync, type Zippable } from 'fflate';
import type { LedgerEntry } from '@pobe/core';
import type { Actor, Deps } from '../context';
import { keys, partition } from '../db/keys';
import { strip, type Item } from '../db/types';
import { ApiError } from '../lib/errors';
import { ulid } from '../lib/ids';
import { listMembers } from '../repo';
import { rateLimit } from './misc';

export interface ExportJob {
  id: string;
  householdId: string;
  requestedBy: string;
  status: 'queued' | 'ready' | 'failed';
  key?: string;
  createdAt: string;
  finishedAt?: string;
  error?: string;
}

export async function requestExport(deps: Deps, actor: Actor) {
  await rateLimit(deps, `export:${actor.householdId}`, 3, 3600);
  const job: ExportJob = {
    id: ulid(deps.now().getTime()),
    householdId: actor.householdId,
    requestedBy: actor.memberId,
    status: 'queued',
    createdAt: deps.now().toISOString(),
  };
  await deps.db.put({ ...keys.exportJob(actor.householdId, job.id), ttl: Math.floor(deps.now().getTime() / 1000) + 3 * 86400, ...job });
  await deps.startExport(actor.householdId, job.id);
  return job;
}

export async function exportStatus(deps: Deps, actor: Actor, jobId: string) {
  const job = await deps.db.get<Item & ExportJob>(keys.exportJob(actor.householdId, jobId));
  if (!job) throw new ApiError('NOT_FOUND', "That export wasn't found. Exports are kept for 2 days.");
  const clean = strip(job) as ExportJob;
  return { ...clean, downloadUrl: clean.status === 'ready' && clean.key ? await deps.storage.presignGet(clean.key, 24 * 3600) : undefined };
}

function csv(rows: (string | number | undefined)[][]) {
  return rows
    .map((r) =>
      r.map((v) => (v === undefined ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(','),
    )
    .join('\n');
}

export async function runExport(deps: Deps, householdId: string, jobId: string) {
  const jobKey = keys.exportJob(householdId, jobId);
  const job = await deps.db.get<Item & ExportJob>(jobKey);
  if (!job) return;
  try {
    const rows = await deps.db.query(partition(householdId));
    const members = new Map((await listMembers(deps, householdId, true)).map((m) => [m.id, m.name]));
    const byType: Record<string, unknown[]> = {};
    const photoKeys: string[] = [];
    for (const r of rows) {
      const type = String(r.type ?? r.sk.split('#')[0]);
      if (
        ['push', 'device'].includes(type) ||
        r.sk.startsWith('PT#') ||
        r.sk.startsWith('DL#') ||
        r.sk.startsWith('CALREF#') ||
        r.sk.startsWith('EXP#')
      )
        continue;
      (byType[type] ??= []).push(strip(r));
      for (const k of (r.photoKeys as string[] | undefined) ?? []) photoKeys.push(k);
      if (typeof r.photoKey === 'string') photoKeys.push(r.photoKey);
    }
    const files: Zippable = {
      'README.txt': strToU8(
        'Pobe Coins export.\n\ndata/*.json: every record, one file per type.\nledger.csv: every coin movement.\nphotos/: purchase and chore photos.\n',
      ),
    };
    for (const [type, list] of Object.entries(byType)) files[`data/${type}.json`] = strToU8(JSON.stringify(list, null, 2));
    const ledger = (byType.ledger ?? []) as LedgerEntry[];
    files['ledger.csv'] = strToU8(
      csv([
        ['date', 'member', 'kind', 'value', 'label', 'debt change', 'reason'],
        ...ledger.map((e) => [e.createdAt, members.get(e.memberId) ?? e.memberId, e.kind, e.value, e.label, e.debtDelta, e.reason]),
      ]),
    );
    let photoBytes = 0;
    for (const key of [...new Set(photoKeys)]) {
      if (photoBytes > 400 * 1024 * 1024) break; // keep the Lambda within memory
      const body = await deps.storage.getObject(key);
      if (!body) continue;
      photoBytes += body.byteLength;
      files[`photos/${key.split('/').slice(2).join('/')}`] = [body, { level: 0 }];
    }
    const zip = zipSync(files, { level: 6 });
    const key = `exports/${householdId}/${jobId}.zip`;
    await deps.storage.putObject(key, zip, 'application/zip');
    await deps.db.put({ ...job, status: 'ready', key, finishedAt: deps.now().toISOString() });
    await deps.notifier.send(householdId, [job.requestedBy], {
      title: 'Your export is ready',
      body: 'Open Settings to download your household data.',
      url: '/settings/export',
    });
  } catch (err) {
    await deps.db.put({
      ...job,
      status: 'failed',
      error: err instanceof Error ? err.message : 'Export failed',
      finishedAt: deps.now().toISOString(),
    });
    throw err;
  }
}
