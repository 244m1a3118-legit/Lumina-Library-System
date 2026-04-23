import fs from 'fs';
import path from 'path';

function fixEscaped(filePath) {
  if (!fs.existsSync(filePath)) return;
  let code = fs.readFileSync(filePath, 'utf8');
  // Replaces \` with `
  code = code.replace(/\\`/g, '`');
  // Replaces \${ with ${
  code = code.replace(/\\\${/g, '${');
  fs.writeFileSync(filePath, code);
  console.log('Fixed', filePath);
}

fixEscaped('public/libraryApp.js');
fixEscaped('public/portalRenderer.js');
fixEscaped('public/logoutRenderer.js');
fixEscaped('public/profileRenderer.js');
fixEscaped('src/pages/student/student.js');
