/**
 * Convert src/views/*.html → src/views/*.js (exact markup preserved).
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const viewsDir = resolve(root, 'src/views');

function toTemplateLiteral(html) {
  return html
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${');
}

const files = readdirSync(viewsDir).filter((f) => f.endsWith('.html'));

for (const file of files) {
  const name = basename(file, '.html');
  const exportName = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + 'View';
  const html = readFileSync(resolve(viewsDir, file), 'utf8');
  const js = `/** View: ${name} — auto-generated from ${file} */\nexport const ${exportName} = \`${toTemplateLiteral(html)}\`;\n`;
  writeFileSync(resolve(viewsDir, `${name}.js`), js, 'utf8');
  console.log('Wrote', `${name}.js`, `(${html.length} chars)`);
}
