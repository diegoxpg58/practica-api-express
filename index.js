const express = require('express');
const pool = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 1. GET ALL - Obtener todos los productos
app.get('/api/productos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al consultar productos' });
  }
});

// 2. GET BY ID - Obtener un producto por ID
app.get('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM productos WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al buscar el producto' });
  }
});

// 3. POST - Crear un nuevo producto
app.post('/api/productos', async (req, res) => {
  const { nombre, precio, categoria } = req.body;
  try {
    const query = 'INSERT INTO productos (nombre, precio, categoria) VALUES ($1, $2, $3) RETURNING *';
    const result = await pool.query(query, [nombre, precio, categoria]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al crear el producto' });
  }
});

// 4. PUT - Actualizar un producto existente
app.put('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, precio, categoria } = req.body;
  try {
    const query = `
      UPDATE productos 
      SET nombre = COALESCE($1, nombre), 
          precio = COALESCE($2, precio), 
          categoria = COALESCE($3, categoria)
      WHERE id = $4 RETURNING *`;
    const result = await pool.query(query, [nombre, precio, categoria, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado para actualizar' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al actualizar el producto' });
  }
});

// 5. DELETE - Eliminar un producto
app.delete('/api/productos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM productos WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado para eliminar' });
    }
    res.status(200).json({ mensaje: `Producto con id ${id} eliminado correctamente` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar el producto' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});