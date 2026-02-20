const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'Malee9163',
  database: 'site_cash_flow'
});

async function loadSampleData() {
  try {
    await client.connect();
    const sql = fs.readFileSync(path.join(__dirname, 'sample-data.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ Sample data inserted successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

loadSampleData();
