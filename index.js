const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const pool = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================================
// PARTE I: Configuración de subida de archivos (Multer)
// ==========================================================
const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true }); 

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension === '.json' || extension === '.csv') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .json o .csv'));
    }
  },
});

function borrarTemporal(ruta) {
  if (ruta && fs.existsSync(ruta)) {
    fs.unlinkSync(ruta);
  }
}

function leerJSON(ruta) {
  const contenido = fs.readFileSync(ruta, 'utf-8');
  const datos = JSON.parse(contenido);
  if (!Array.isArray(datos)) {
    throw new Error('El archivo JSON debe contener un arreglo de objetos');
  }
  return datos;
}

// Lee un archivo CSV fila por fila con un stream + csv-parser
function leerCSV(ruta) {
  return new Promise((resolve, reject) => {
    const filas = [];
    fs.createReadStream(ruta)
      .pipe(csv({ mapHeaders: ({ header }) => header.trim().replace(/^﻿/, '') }))
      .on('data', (fila) => filas.push(fila))
      .on('end', () => resolve(filas))
      .on('error', (error) => reject(error));
  });
}

// Inserción masiva en PostgreSQL dentro de una transacción:
// si un registro falla, no se inserta ninguno.
async function insertarProductos(productos) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const query = 'INSERT INTO productos (nombre, precio, categoria) VALUES ($1, $2, $3)';
    for (const p of productos) {
      await cliente.query(query, [p.nombre, p.precio, p.categoria]);
    }
    await cliente.query('COMMIT');
    return productos.length;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}

// Limpia y valida cada registro antes de insertarlo
function normalizarProductos(registros) {
  return registros.map((r, i) => {
    const nombre = String(r.nombre ?? '').trim();
    const categoria = String(r.categoria ?? '').trim();
    const precio = parseFloat(r.precio);
    if (!nombre || Number.isNaN(precio)) {
      throw new Error(`Registro ${i + 1} inválido: requiere "nombre" y un "precio" numérico`);
    }
    return { nombre, precio, categoria };
  });
}

// Convierte un arreglo de objetos a texto CSV (iterador manual)
function convertirACSV(registros) {
  if (registros.length === 0) return '';
  const columnas = Object.keys(registros[0]);
  const escapar = (valor) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    // Si contiene comas, comillas o saltos de línea, se envuelve en comillas
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const encabezado = columnas.join(',');
  const filas = registros.map((r) => columnas.map((c) => escapar(r[c])).join(','));
  return [encabezado, ...filas].join('\r\n');
}

// ==========================================================
// PARTE II: Importación  ->  POST /api/productos/importar
// ==========================================================
app.post('/api/productos/importar', (req, res) => {
  upload.single('archivo')(req, res, async (errorSubida) => {
    if (errorSubida) {
      return res.status(400).json({ error: errorSubida.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Debes enviar un archivo en el campo "archivo"' });
    }

    const rutaTemporal = req.file.path;
    const extension = path.extname(req.file.originalname).toLowerCase();

    try {
      let registros;
      if (extension === '.json') {
        registros = leerJSON(rutaTemporal);
      } else {
        registros = await leerCSV(rutaTemporal);
      }

      if (registros.length === 0) {
        return res.status(400).json({ error: 'El archivo no contiene registros' });
      }

      const productos = normalizarProductos(registros);
      const total = await insertarProductos(productos);

      res.status(200).json({
        mensaje: `Importación completada desde archivo ${extension.slice(1).toUpperCase()}`,
        totalInsertados: total,
      });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: `No se pudo importar el archivo: ${error.message}` });
    } finally {
      borrarTemporal(rutaTemporal); // siempre se limpia /uploads
    }
  });
});

// ==========================================================
// PARTE III: Exportación  ->  GET /api/productos/exportar/:formato
// ==========================================================
app.get('/api/productos/exportar/:formato', async (req, res) => {
  const formato = req.params.formato.toLowerCase();

  if (formato !== 'json' && formato !== 'csv') {
    return res.status(400).json({ error: 'Formato no válido. Usa "json" o "csv"' });
  }

  try {
    const result = await pool.query('SELECT * FROM productos ORDER BY id ASC');
    const productos = result.rows;

    if (formato === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename=datos_exportados.json');
      return res.json(productos);
    }

    // formato === 'csv'
    const csvData = convertirACSV(productos);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=datos_exportados.csv');
    // ﻿ (BOM) hace que Excel muestre bien los acentos
    res.send('﻿' + csvData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error interno del servidor al exportar los productos' });
  }
});

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