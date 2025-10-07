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

import { classifyBatchResponseFormat, classifyResponseFormat, systemPrompt } from './classify';

type ResponseFormat = typeof classifyResponseFormat | typeof classifyBatchResponseFormat;

const callClassifier = async (env: Env, model: string, userContent: string, responseFormat: ResponseFormat) => {
	const response = await fetch('https://api.deepinfra.com/v1/openai/chat/completions', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${env.PROVIDER_KEY}`,
		},
		body: JSON.stringify({
			model,
			messages: [
				systemPrompt,
				{
					role: 'user',
					content: userContent,
				},
			],
			response_format: responseFormat,
		}),
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

		if (typeof model !== 'string') {
			return new Response(`model parameter must be a string`, { status: 400, headers: corsHeaders });
		}

		// the two accepted models
		const acceptedModels = ['Qwen/Qwen3-30B-A3B', 'mistralai/Mistral-Small-3.2-24B-Instruct-2506'];
		if (!acceptedModels.includes(model)) {
			return new Response(`Invalid model. Accepted models are: ${acceptedModels.join(', ')}`, { status: 400, headers: corsHeaders });
		}

		const text = body.text;
		const texts = body.texts;

		if (text) {
			// single item prompt
			if (texts) {
				return new Response('either a `text` or `texts` field must be supplied, not both', { status: 400, headers: corsHeaders });
			}

			if (typeof text !== 'string') {
				return new Response('`text` must be a string', { status: 400, headers: corsHeaders });
			}

			try {
				const prompt = `<Tweet>${JSON.stringify(text)}</Tweet>`;
				return Response.json(await callClassifier(env, model, prompt, classifyResponseFormat), { headers: corsHeaders });
			} catch (e) {
				console.log('error from upstream:');
				console.log(e);
				return new Response(`Error from upstream: ${e}`, { headers: corsHeaders, status: 400 });
			}
		} else if (texts) {
			// multiple item prompt
			if (!Array.isArray(texts) || !texts.every((t) => typeof t === 'string')) {
				return new Response('`texts` must be an array of strings', { status: 400, headers: corsHeaders });
			}
			try {
				const formattedTweets = texts.map((entry, idx) => `<Tweet id="${idx}">${JSON.stringify(entry)}</Tweet>`).join('\n');
				const batchPrompt = `Tweets to classify (one per line):\n${formattedTweets}\nReturn a JSON array of ${texts.length} classification objects in the same order.`;
				const results = await callClassifier(env, model, batchPrompt, classifyBatchResponseFormat);
				return Response.json(results, { headers: corsHeaders });
			} catch (e) {
				console.log('error from upstream:');
				console.log(e);
				return new Response(`Error from upstream: ${e}`, { headers: corsHeaders, status: 400 });
			}
		} else {
			return new Response('either a `text` or `texts` field must be supplied', { status: 400, headers: corsHeaders });
		}
	},
} satisfies ExportedHandler<Env>;
