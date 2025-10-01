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

export default {
	async fetch(request, env, ctx): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Request method must be POST', { status: 400 });
		}

		if (request.headers.get('content-type') !== 'application/json') {
			return new Response('Request content-type must be application/json', { status: 400 });
		}

		let text;
		try {
			const body = await request.json();
			text = (body as any).text;
		} catch (e) {
			return new Response('Invalid JSON body', { status: 400 });
		}

		// submit text
		const client = new OpenAI({
			baseURL: `${env.PROVIDER_URL}`,
			apiKey: `${env.PROVIDER_KEY}`,
			dangerouslyAllowBrowser: true,
		});

		const response = await client.chat.completions.create({
			model: env.MODEL_NAME,
			messages: [
				{
					role: 'system',
					content: `You are a tweet classifier.
	Given a tweet, output a JSON object with scores between 0 and 1 (inclusive) for each of the following categories:
	- Offensive: Contains slurs, harassment, or hateful/abusive language.
	- Beef: Targeted negativity or conflict between users, communities, or groups.
	- Dunk: Mocking or ridiculing someone/something, often humorously.
	- Horny: Expresses sexual desire, thirst, or innuendo.
	- NSFW: Explicit sexual or graphic adult content (stronger than “Horny”).

	The scores should represent the likelihood that the tweet belongs in each category. A score of 0 means "not at all" and 1 means "definitely."

	Format your output strictly as JSON:
	\`
	{
		"Offensive": 0.0,
		"Beef": 0.0,
		"Dunk": 0.0,
		"Horny": 0.0,
		"NSFW": 0.0
	}

	\`

	Example input: "Tweet: "Lmao this guy can’t even dribble, what a clown.""

	\`
	{
		"Offensive": 0.0,
		"Beef": 0.2,
		"Dunk": 0.9,
		"Horny": 0.0,
		"NSFW": 0.0
	}
	\`

					`,
				},
				{
					role: 'user',
					content: `Tweet: '${text}'`,
				},
			],
			response_format: {
				type: 'json_schema',
				max_tokens: 10000,
				json_schema: {
					name: 'tweet_classification',
					schema: {
						type: 'object',
						properties: {
							Offensive: { type: 'number', minimum: 0, maximum: 1 },
							Beef: { type: 'number', minimum: 0, maximum: 1 },
							Dunk: { type: 'number', minimum: 0, maximum: 1 },
							Horny: { type: 'number', minimum: 0, maximum: 1 },
							NSFW: { type: 'number', minimum: 0, maximum: 1 },
						},
						required: ['Offensive', 'Beef', 'Dunk', 'Horny', 'NSFW'],
						additionalProperties: false,
					},
				},
			},
		});
		// pass response to client

		return new Response(JSON.stringify(response), { headers: { 'content-type': 'application/json' } });
	},
} satisfies ExportedHandler<Env>;
