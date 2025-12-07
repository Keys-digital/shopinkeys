const fs = require('fs');
const path = require('path');

const modelsPath = path.join(__dirname, '../models');
console.log('Models path:', modelsPath);

if (fs.existsSync(modelsPath)) {
    console.log('Entries in models:', fs.readdirSync(modelsPath));
} else {
    console.log('Models directory does not exist');
}

try {
    require('../models/PostInteraction');
    console.log('Successfully required PostInteraction');
} catch (e) {
    console.error('Failed to require PostInteraction:', e);
}
