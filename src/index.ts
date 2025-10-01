/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import OpenAI from 'openai';
import { classifyResponseFormat, systemPrompt } from './classify';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
			'Access-Control-Allow-Headers': '*',
		};

		// Handle preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		if (request.method !== 'POST') {
			return new Response('Request method must be POST', { status: 400, headers: corsHeaders });
		}

		if (request.headers.get('content-type') !== 'application/json') {
			return new Response('Request content-type must be application/json', { status: 400, headers: corsHeaders });
		}

		let text;
		try {
			const body = await request.json();
			text = (body as any).text;
		} catch (e) {
			return new Response('Invalid JSON body', { status: 400, headers: corsHeaders });
		}

		// submit text
		const client = new OpenAI({
			baseURL: `${env.PROVIDER_URL}`,
			apiKey: `${env.PROVIDER_KEY}`,
		});

		try {
			const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${env.PROVIDER_KEY}`,
				},
				body: JSON.stringify({
					model: env.MODEL_NAME,
					messages: [
						systemPrompt,
						{
							role: 'user',
							content: `Tweet: '${text}'`,
						},
					],
					response_format: classifyResponseFormat,
				}),
			});

			return Response.json(await response.json(), { headers: corsHeaders });
		} catch (e) {
			console.log('error from upstream:');
			console.log(e);
			return new Response(`Error from upstream: ${e}`, { headers: corsHeaders, status: 400 });
		}
	},
} satisfies ExportedHandler<Env>;
