const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

data.users.forEach(u => {
  u.password = "password123";
  if (u.email && !u.email.endsWith('@vemu.org')) {
    u.email = u.email.split('@')[0] + '@vemu.org';
  }
});

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
console.log('Successfully set ALL users passwords to "password123" and enforced @vemu.org');
