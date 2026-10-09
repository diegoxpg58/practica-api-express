const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
});

pool.connect()
  .then(() => console.log('Conectado exitosamente a la base de datos PostgreSQL'))
  .catch(err => console.error('Error de conexión a la base de datos:', err));

module.exports = pool;