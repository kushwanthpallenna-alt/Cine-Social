const fs = require('fs');
const path = require('path');

const userProfile = process.env.USERPROFILE || '';
const localAppData = process.env.LOCALAPPDATA || '';
const appData = process.env.APPDATA || '';

function checkDir(dir) {
  if (fs.existsSync(dir)) {
    console.log(`Exists: ${dir}`);
    try {
      const files = fs.readdirSync(dir);
      console.log(`Files in ${dir}:`, files);
      for (const f of files) {
        const fullPath = path.join(dir, f);
        if (fs.statSync(fullPath).isDirectory()) {
          checkDir(fullPath);
        }
      }
    } catch (e) {
      console.log(`Error reading ${dir}: ${e.message}`);
    }
  }
}

console.log("Checking AppData & LocalAppData for supabase...");
checkDir(path.join(localAppData, 'supabase'));
checkDir(path.join(appData, 'supabase'));
checkDir(path.join(userProfile, '.supabase'));
checkDir(path.join(userProfile, '.config', 'supabase'));
