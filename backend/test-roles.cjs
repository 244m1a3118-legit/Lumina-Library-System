const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.json');
const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const roles = ['Administrator', 'Faculty', 'Librarian', 'Student'];
const accounts = [];

// Convert all existing user emails to @vemu.org to prevent login failures
data.users.forEach((user, idx) => {
  if (user.email && !user.email.endsWith('@vemu.org')) {
    const localPart = user.email.split('@')[0];
    user.email = `${localPart}@vemu.org`;
  }
});

// Ensure we have at least one of each role
roles.forEach(role => {
  let user = data.users.find(u => u.role === role);
  if (!user) {
    user = {
      id: `user-${role.toLowerCase()}-${Date.now()}`,
      userId: `${role.substring(0,3).toUpperCase()}-TEST`,
      email: `${role.toLowerCase()}@vemu.org`,
      password: "password123",
      user_name: `Test ${role}`,
      firstName: "Test",
      lastName: role,
      role: role,
      status: "Active"
    };
    data.users.push(user);
  } else {
    // Reset passwords for safe testing visibility
    user.password = "password123";
  }
  accounts.push({ role: user.role, email: user.email, password: user.password });
});

fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

console.log('--- TEST ACCOUNTS OVERVIEW ---');
console.table(accounts);
