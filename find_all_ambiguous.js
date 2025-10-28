const fs = require('fs');
const path = require('path');

console.log(`
==================================================
🔍 BUSCANDO TODAS LAS REFERENCIAS AMBIGUAS
==================================================
`);

const backendPath = path.join(__dirname, 'backend');
const problematicPatterns = [
  /WHERE\s+code\s*=/gi,
  /WHERE\s+code\s+IN/gi,
  /AND\s+code\s*=/gi,
  /OR\s+code\s*=/gi,
  /JOIN.*ON.*code\s*=/gi
];

let totalProblems = 0;
const filesWithProblems = {};

function searchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const problems = [];
  
  lines.forEach((line, index) => {
    problematicPatterns.forEach(pattern => {
      if (pattern.test(line)) {
        // Verificar si ya tiene el prefijo correcto
        if (!line.includes('bingo_rooms.code') && 
            !line.includes('tictactoe_rooms.code') && 
            !line.includes('raffles.code')) {
          problems.push({
            line: index + 1,
            content: line.trim(),
            pattern: pattern.toString()
          });
          totalProblems++;
        }
      }
    });
  });
  
  return problems;
}

function searchDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
      searchDirectory(fullPath);
    } else if (file.endsWith('.js')) {
      const problems = searchFile(fullPath);
      if (problems.length > 0) {
        const relativePath = path.relative(backendPath, fullPath);
        filesWithProblems[relativePath] = problems;
      }
    }
  });
}

searchDirectory(backendPath);

console.log('ARCHIVOS CON POSIBLES PROBLEMAS:\n');
console.log('━'.repeat(50));

Object.entries(filesWithProblems).forEach(([file, problems]) => {
  console.log(`\n📄 ${file}`);
  problems.forEach(problem => {
    console.log(`   Línea ${problem.line}: ${problem.content}`);
  });
});

console.log('\n━'.repeat(50));
console.log(`\nTOTAL DE PROBLEMAS ENCONTRADOS: ${totalProblems}`);

if (totalProblems === 0) {
  console.log('✅ No se encontraron referencias ambiguas');
} else {
  console.log('❌ Aún hay referencias que necesitan ser corregidas');
}
