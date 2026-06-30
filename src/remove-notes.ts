import * as fs from 'fs';
const content = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = content.split('\n');
const startIdx = lines.findIndex(l => l.includes('{/* Meeting Notes Section */}'));
if (startIdx !== -1) {
  const newLines = lines.slice(0, startIdx).concat([
    '      </div>',
    '    </div>',
    '  );',
    '}',
    ''
  ]);
  fs.writeFileSync('src/App.tsx', newLines.join('\n'));
  console.log('Removed Meeting Notes Section.');
} else {
  console.log('Meeting Notes Section not found.');
}
