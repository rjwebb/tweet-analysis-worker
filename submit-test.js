const text = 'hello how are you';

const response = await fetch('http://localhost:8787', {
	method: 'POST',
	body: JSON.stringify({ text }),
	headers: { 'content-type': 'application/json' },
});

console.log(response);
console.log(JSON.stringify(await response.json(), undefined, 4));
