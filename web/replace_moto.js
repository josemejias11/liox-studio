const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

const replacements = {
  // Black
  'text-moto-black': 'text-foreground',
  'bg-moto-black': 'bg-background',
  'border-moto-black': 'border-foreground',
  'from-moto-black': 'from-background',
  'via-moto-black': 'via-background',
  'to-moto-black': 'to-background',
  
  // Frost
  'text-moto-frost': 'text-foreground',
  'bg-moto-frost': 'bg-background',
  'border-moto-frost': 'border-border',
  'from-moto-frost': 'from-background',
  'via-moto-frost': 'via-background',
  'to-moto-frost': 'to-background',

  // Indigo
  'text-moto-indigo': 'text-accent',
  'bg-moto-indigo': 'bg-accent',
  'border-moto-indigo': 'border-accent',
  'from-moto-indigo': 'from-accent',
  'via-moto-indigo': 'via-accent',
  'to-moto-indigo': 'to-accent',
  'decoration-moto-indigo': 'decoration-accent',
  'ring-moto-indigo': 'ring-accent',

  // Slate
  'text-moto-slate': 'text-muted-foreground',
  'bg-moto-slate': 'bg-muted',
  'border-moto-slate': 'border-border',

  // Sandstone
  'text-moto-sandstone': 'text-muted-foreground',
  'bg-moto-sandstone': 'bg-muted',
  'border-moto-sandstone': 'border-border',

  // Pearl
  'text-moto-pearl': 'text-foreground',
  'bg-moto-pearl': 'bg-card',
  'border-moto-pearl': 'border-border',

  // White
  'text-moto-white': 'text-foreground',
  'bg-moto-white': 'bg-background',
  'border-moto-white': 'border-border',
};

function walkDir(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walkDir(file));
    } else { 
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walkDir(srcDir);
let totalReplacements = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;

  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'g');
    content = content.replace(regex, value);
  }

  if (content !== originalContent) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
    totalReplacements++;
  }
}

console.log(`Finished updating ${totalReplacements} files.`);
