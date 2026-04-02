const fs = require('fs');
const { execSync } = require('child_process');

const files = execSync('find src -name "*.ts"').toString().split('\n').filter(Boolean);

let changedFiles = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Substituir logger.warn("string", err) -> logger.warn({ err }, "string")
  content = content.replace(/logger\.(error|warn|info|debug)\(\s*(['"\`].*?['"\`])\s*,\s*([a-zA-Z0-9_.]+)\s*\)/g, (match, level, m1, m2) => {
      if (m2.includes('...')) return match;
      if (m2.includes(' ')) return match;
      return `logger.${level}({ details: String(${m2}) }, ${m1})`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log('Fixed', file);
  }
}
console.log('Fixed', changedFiles, 'files.');
