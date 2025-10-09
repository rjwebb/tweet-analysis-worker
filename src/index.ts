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
import { classifyBatchResponseFormat, classifyResponseFormat, systemPrompt } from './classify';

const callClassifier = async (env: Env, body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming) => {
	const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.PROVIDER_KEY}`,
		},
		body: JSON.stringify(body),
	});
	const json = await response.json();
	if (!response.ok) {
		throw new Error(`Upstream error (${response.status}): ${JSON.stringify(json)}`);
	}
	return json;
};

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Max-Age': '600',
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

		let body: Record<string, unknown>;
		try {
			body = (await request.json()) as Record<string, unknown>;
		} catch (e) {
			return new Response('Invalid JSON body', { status: 400, headers: corsHeaders });
		}

		const model = body.model;
		const text = body.text;
		const texts = body.texts;
		const openaiParams = body.params;

		if (!openaiParams) {
			if (typeof model !== 'string') {
				return new Response(`model parameter must be a string`, { status: 400, headers: corsHeaders });
			}

			// the two accepted models
			const acceptedModels = ['Qwen/Qwen3-30B-A3B', 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'];
			if (!acceptedModels.includes(model)) {
				return new Response(`Invalid model. Accepted models are: ${acceptedModels.join(', ')}`, { status: 400, headers: corsHeaders });
			}
		}

		let params;

		if (text) {
			// single item prompt
			if (texts) {
				return new Response('either a `text` or `texts` field must be supplied, not both', { status: 400, headers: corsHeaders });
			}

			if (typeof text !== 'string') {
				return new Response('`text` must be a string', { status: 400, headers: corsHeaders });
			}

			params = {
				model,
				messages: [
					systemPrompt,
					{
						role: 'user' as const,
						content: `<Tweet>${JSON.stringify(text)}</Tweet>`,
					},
				],
				response_format: classifyResponseFormat,
			};
		} else if (texts) {
			// multiple item prompt
			if (!Array.isArray(texts) || !texts.every((t) => typeof t === 'string')) {
				return new Response('`texts` must be an array of strings', { status: 400, headers: corsHeaders });
			}

			const formattedTweets = texts.map((entry, idx) => `<Tweet id="${idx}">${JSON.stringify(entry)}</Tweet>`).join('\n');
			params = {
				model,
				messages: [
					systemPrompt,
					{
						role: 'user' as const,
						content: `Tweets to classify (one per line):\n${formattedTweets}\nReturn a JSON array of ${texts.length} classification objects in the same order.`,
					},
				],
				response_format: classifyBatchResponseFormat,
			};
		} else if (openaiParams) {
			params = openaiParams as any;
		} else {
			return new Response('either a `text` or `texts` field must be supplied', { status: 400, headers: corsHeaders });
		}

		try {
			return Response.json(await callClassifier(env, params), { headers: corsHeaders });
		} catch (e) {
			console.log('error from upstream:');
			console.log(e);
			return new Response(`Error from upstream: ${e}`, { headers: corsHeaders, status: 400 });
		}
	},
} satisfies ExportedHandler<Env>;
