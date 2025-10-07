const localUrl = 'http://localhost:8787';

const serverUrl = 'https://tweet-analysis-worker.bob-wbb.workers.dev';

const response = await fetch(localUrl, {
	method: 'POST',
	body: JSON.stringify({
		texts: ['are you talking to me you piece of shit', 'i want to fuck you', "i'm so happy"],
		model: 'Qwen/Qwen3-30B-A3B',
	}),
	headers: { 'content-type': 'application/json' },
});

const responseData = await response.json();

console.log(responseData.choices[0].message.content);
