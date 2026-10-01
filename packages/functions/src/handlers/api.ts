import { handle } from 'hono/aws-lambda';
import { createApp } from '../app';
import { awsDeps } from '../adapters/aws';

export const handler = handle(createApp(awsDeps()));
