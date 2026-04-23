const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

let user = data.users.find(u => u.email && (u.email.toLowerCase() === "jaybalajij2552@gmail.com" || u.email.toLowerCase() === "jaybalajij2552@vemu.org"));

if (!user) {
  user = {
    "id": "user-" + Date.now(),
    "userId": "ADM-004",
    "email": "jaybalajij2552@vemu.org",
    "password": "password123",
    "user_name": "Jay Balaji",
    "firstName": "Jay",
    "lastName": "Balaji",
    "phone": "",
    "role": "Administrator",
    "dept": "Library & Admin",
    "status": "Active",
    "joined": new Date().toISOString()
  };
  data.users.push(user);
} else {
  user.email = "jaybalajij2552@vemu.org";
  user.password = "password123";
}

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
console.log('Fixed admin email to jaybalajij2552@vemu.org with password123');
