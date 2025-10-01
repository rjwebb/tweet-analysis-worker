const text = 'hello how are you';
const localUrl = 'http://localhost:8787';

const serverUrl = 'https://tweet-analysis-worker.bob-wbb.workers.dev';

const response = await fetch(serverUrl, {
	method: 'POST',
	body: JSON.stringify({ text }),
	headers: { 'content-type': 'application/json' },
});

const responseData = await response.json();

console.log(responseData.choices[0].message.content);
