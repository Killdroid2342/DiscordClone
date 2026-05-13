import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(__dirname, '../JS/AppConfig.js');
const options = parseArgs(process.argv.slice(2));

const apiBase = cleanHttpUrl(
  options.apiBase || process.env.MYDISCORD_API_BASE || 'http://localhost:5018',
  'apiBase',
  { required: true }
);
const cdnBase = cleanHttpUrl(
  options.cdnBase || process.env.MYDISCORD_CDN_BASE || '',
  'cdnBase',
  { required: false }
);

const content = `(function () {
  const runtimeConfig = window.myDiscordRuntimeConfig || {};
  window.MYDISCORD_CONFIG = {
    apiBase: runtimeConfig.apiBase || '${escapeJsString(apiBase)}',
    cdnBase: runtimeConfig.cdnBase || '${escapeJsString(cdnBase)}',
  };
})();
`;

await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, content, 'utf8');
console.log(`Wrote ${configPath}`);

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      continue;
    }

    const [rawName, inlineValue] = arg.slice(2).split('=', 2);
    const value = inlineValue ?? args[index + 1] ?? '';
    if (inlineValue === undefined && args[index + 1] && !args[index + 1].startsWith('--')) {
      index += 1;
    }

    if (rawName === 'api-base') {
      parsed.apiBase = value;
    } else if (rawName === 'cdn-base') {
      parsed.cdnBase = value;
    }
  }

  return parsed;
}

function cleanHttpUrl(value, label, { required }) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) {
    if (required) {
      throw new Error(`${label} is required.`);
    }

    return '';
  }

  const url = new URL(text);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${label} must start with http:// or https://.`);
  }

  return url.toString().replace(/\/+$/, '');
}

function escapeJsString(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
