const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.tsx')) {
      arrayOfFiles.push(fullPath);
    }
  });
  return arrayOfFiles;
}

const srcDir = path.join(__dirname, 'src');
const files = getAllFiles(srcDir);

let count = 0;
files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Replace garbled sequences
  content = content.replace(/â‚¹/g, '₹');
  content = content.replace(/â€”/g, '—');
  content = content.replace(/â Œ/g, '❌');
  content = content.replace(/â†’/g, '→');
  content = content.replace(/â€/g, '–'); // En dash or quote artifact

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed:', path.relative(__dirname, filePath));
    count++;
  }
});

console.log(`\nSuccess! Fixed ${count} files.`);
