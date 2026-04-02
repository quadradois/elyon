const fs = require('fs');
const glob = require('glob'); // Need to check if glob exists

// Let's use simple child_process for find
const { execSync } = require('child_process');
const files = execSync('find src -name "*.ts"').toString().split('\n').filter(Boolean);

let changedFiles = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Substitui logger.error/warn("[TEXTO]", obj); -> logger.error/warn({ details: obj }, "[TEXTO]");
  content = content.replace(/logger\.(error|warn|info|debug)\(\s*(['\"\`].*?['\"\`])\s*,([^)]+)\)/g, (match, level, m1, m2) => {
      // Verifica se o m2 é um objeto já json tipo { err } ou array
      m2 = m2.trim();
      if (m2.startsWith('{') || m2.startsWith('[')) return match; // skip already wrapped
      if (m2.includes('...')) return match;
      if (m2.includes('(err) =>')) return match; 
      
      return `logger.${level}({ err: ${m2} }, ${m1})`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log('Fixed', file);
  }
}
console.log('Fixed', changedFiles, 'files.');
