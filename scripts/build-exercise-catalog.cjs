// Keep the full source catalog for future language support. Bundle only the
// English instruction fields consumed by the current app.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'assets/exercises/exercises.json'), 'utf8'));
const catalog = source.map(({ instructions, instruction_steps, ...exercise }) => ({
  ...exercise,
  ...(instructions ? { instructions: { en: instructions.en } } : {}),
  ...(instruction_steps ? { instruction_steps: { en: instruction_steps.en } } : {}),
}));
fs.writeFileSync(path.join(root, 'assets/exercises/exercises.en.json'), JSON.stringify(catalog));
console.log(`Generated ${catalog.length} exercises with English instructions.`);
