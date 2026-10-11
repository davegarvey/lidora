import { readFile } from 'node:fs/promises';

const FIELDS = ['client_id', 'redirect_uris', 'token_endpoint_auth_method', 'token_endpoint_auth_methods_supported', 'grant_types', 'response_types'];
const CLIENTS = ['codex', 'chatgpt'];

function render(value) {
  return value === undefined ? '(absent)' : JSON.stringify(value);
}

async function check(name) {
  const fixturePath = new URL(`../tests/fixtures/oauth-clients/${name}.json`, import.meta.url);
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  const response = await fetch(fixture.client_id, { headers: { Accept: 'application/json' } });
  if (!response.ok) return [`${name}: ${fixture.client_id} returned HTTP ${response.status}`];
  const live = await response.json();
  const lines = [];
  for (const field of FIELDS) {
    if (render(fixture[field]) === render(live[field])) continue;
    lines.push(`${name}: ${field}`, `  - fixture: ${render(fixture[field])}`, `  + live:    ${render(live[field])}`);
  }
  return lines;
}

const problems = [];
for (const name of CLIENTS) {
  try {
    problems.push(...(await check(name)));
  } catch (error) {
    problems.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (problems.length > 0) {
  console.error('Live OAuth client documents differ from tests/fixtures/oauth-clients:\n');
  console.error(problems.join('\n'));
  console.error('\nReview the change, update the fixtures and re-run the OAuth tests.');
  process.exit(1);
}
console.log('Live OAuth client documents match the fixtures.');
