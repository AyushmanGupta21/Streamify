const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../frontend/src/pages/CallPage.jsx');
let content = fs.readFileSync(filePath, 'utf8');
// Replace 100vh with dvh-based height for mobile
content = content.replace(/height: "100vh"/g, 'height: "calc(var(--dvh, 1vh) * 100)"');
fs.writeFileSync(filePath, content);
console.log('Done - replaced all 100vh instances with dvh');
