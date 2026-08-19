import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const failures = [];
const report = [];

function fail(message) {
    failures.push(message);
}

function read(path) {
    return readFileSync(path, 'utf8');
}

function collectFiles(root) {
    const result = [];
    for (const name of readdirSync(root)) {
        const path = join(root, name);
        const stat = statSync(path);
        if (stat.isDirectory()) result.push(...collectFiles(path));
        else result.push(path);
    }
    return result;
}

function localReferenceTarget(page, reference) {
    const cleaned = reference.split('#')[0].split('?')[0];
    if (!cleaned || /^(?:https?:|data:|mailto:|tel:|javascript:)/i.test(cleaned)) return null;
    return normalize(join(dirname(page), cleaned));
}

function validateHtml(page) {
    const html = read(page);
    const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length) fail(`${page}: duplicate ids: ${[...new Set(duplicates)].join(', ')}`);

    const references = [...html.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map(match => match[1]);
    for (const reference of references) {
        const target = localReferenceTarget(page, reference);
        if (target && !existsSync(target)) fail(`${page}: missing local reference ${reference}`);
    }

    for (const dialog of html.matchAll(/<[^>]+role=["']dialog["'][^>]*>/g)) {
        const tag = dialog[0];
        const labelledBy = tag.match(/aria-labelledby=["']([^"']+)["']/)?.[1];
        const label = tag.match(/aria-label=["']([^"']+)["']/)?.[1];
        if (!labelledBy && !label) fail(`${page}: dialog missing accessible label: ${tag}`);
        if (labelledBy && !ids.includes(labelledBy)) fail(`${page}: dialog references missing label id ${labelledBy}`);
    }

    report.push(`${page}: ${ids.length} unique ids, ${references.length} local/external references checked`);
    return { html, ids: new Set(ids) };
}

const pageData = new Map();
for (const page of ['index.html', 'main-menu.html', 'tutorial.html', 'game.html']) {
    pageData.set(page, validateHtml(page));
}

function validateLiteralIds(scriptPath, page) {
    const source = read(scriptPath);
    const ids = pageData.get(page).ids;
    const requested = [...source.matchAll(/getElementById\(["']([^"']+)["']\)/g)].map(match => match[1]);
    const missing = [...new Set(requested.filter(id => !ids.has(id)))];
    if (missing.length) fail(`${scriptPath}: IDs missing from ${page}: ${missing.join(', ')}`);
    report.push(`${scriptPath}: ${requested.length} literal DOM id references checked against ${page}`);
}

validateLiteralIds('script.js', 'game.html');
validateLiteralIds('src/ui/main-menu.js', 'main-menu.html');
validateLiteralIds('src/ui/tutorial.js', 'tutorial.html');

const engineFiles = collectFiles('src/engine').filter(path => path.endsWith('.js'));
const controllerFiles = collectFiles('src/controllers').filter(path => path.endsWith('.js'));
const aiFiles = collectFiles('src/ai').filter(path => path.endsWith('.js'));

const engineForbidden = /\b(?:document|window|AudioContext|webkitAudioContext|localStorage|sessionStorage|requestAnimationFrame|setTimeout)\b/;
for (const file of engineFiles) {
    if (engineForbidden.test(read(file))) fail(`${file}: browser/presentation dependency leaked into rules engine`);
}

const orchestrationForbidden = /\b(?:document|window|AudioContext|webkitAudioContext|localStorage|sessionStorage)\b/;
for (const file of [...controllerFiles, ...aiFiles]) {
    if (orchestrationForbidden.test(read(file))) fail(`${file}: browser dependency leaked into controller/AI layer`);
}
report.push(`Architecture purity: ${engineFiles.length} engine, ${controllerFiles.length} controller, ${aiFiles.length} AI files checked`);

const gameHtml = pageData.get('game.html').html;
if (!/id=["']p0-hand["'][^>]*tabindex=["']-1["']/.test(gameHtml)) {
    fail('game.html: skip-link target #p0-hand must be programmatically focusable');
}
if (!/id=["']hint-btn["'][^>]*aria-controls=["']hint-popover["'][^>]*aria-expanded=["']false["']/.test(gameHtml)) {
    fail('game.html: hint control must expose aria-controls/aria-expanded');
}
if (!/id=["']previous-trick-btn["'][^>]*aria-controls=["']previous-trick-popover["'][^>]*aria-expanded=["']false["']/.test(gameHtml)) {
    fail('game.html: previous-trick control must expose aria-controls/aria-expanded');
}

const script = read('script.js');
if (!/createElement\(playerId === 0 \? ['"]button['"] : ['"]div['"]\)/.test(script)) {
    fail('script.js: human playing cards must be native keyboard-focusable buttons');
}
if (/state\.hands\[0\]\.sort\s*\(/.test(script)) {
    fail('script.js: presentation sorting must not mutate authoritative engine hand state');
}

const packageJson = JSON.parse(read('package.json'));
if (packageJson.version !== '1.0.0') fail(`package.json: release version must be 1.0.0, found ${packageJson.version}`);
if (!packageJson.scripts?.verify) fail('package.json: missing release verification script');

if (failures.length) {
    console.error('Release QA failed:');
    failures.forEach(message => console.error(` - ${message}`));
    process.exit(1);
}

console.log('Static release QA passed.');
for (const line of report) console.log(` - ${line}`);
