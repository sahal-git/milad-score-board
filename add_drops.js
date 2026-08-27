const fs = require('fs');
let sql = fs.readFileSync('initial_schema.sql', 'utf8');

const drops = `
DROP TABLE IF EXISTS score_settings CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;
`;

sql = drops + '\n' + sql;
fs.writeFileSync('initial_schema.sql', sql);
