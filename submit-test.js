import { parse } from 'csv-parse/sync';

// the tweet analysis proxy
const localUrl = 'http://localhost:8787';

// const serverUrl = 'https://tweet-analysis-worker.bob-wbb.workers.dev';

import fs from 'fs';

const baselineData = parse(fs.readFileSync('../openrouter-experiment/baseline-10000.csv', 'utf-8'));
console.log(baselineData);

for (const numTweets of [10]) {
	console.log(`Evaluating batch with ${numTweets} tweets`);

	for (let i = 0; i < 5; i++) {
		try {
			const texts = baselineData.slice(i * numTweets, numTweets).map((row) => row[1]);

			const model = 'mistralai/Mistral-Small-3.2-24B-Instruct-2506';

			const startTime = performance.now();
			const response = await fetch(localUrl, {
				method: 'POST',
				body: JSON.stringify({
					texts,
					model,
				}),
				headers: { 'content-type': 'application/json' },
			});
			const endTime = performance.now();

			const responseData = await response.json();

			console.log(responseData.choices[0].message.content);

			const timeTakenMs = endTime - startTime;
			console.log(`${numTweets}, ${timeTakenMs}, ${timeTakenMs / numTweets}`);
			// console.log(`${numTweets} tweets processed in  ${timeTakenMs}ms, ${timeTakenMs / numTweets}ms per tweet`);
		} catch (e) {
			console.log(e);
		}
	}
}
