const express = require('express');
const app = express();
const PORT = 3000;

// Configuración para procesar solicitudes en formato JSON (Paso 5)
app.use(express.json());

// Arreglo en memoria para simular la base de datos de productos (Paso 1 - Acceso a Datos)
let productos = [
  { id: 1, nombre: 'Chaqueta Oversize', precio: 1299, categoria: 'Ropa' },
  { id: 2, nombre: 'Playera Star Core', precio: 499, categoria: 'Ropa' },
  { id: 3, nombre: 'Cargo Wide Leg', precio: 899, categoria: 'Pantalones' }
];

// Ruta base (/) de confirmación (Paso 6)
app.get('/', (req, res) => {
  res.send('Servidor en línea y funcionando correctamente ★');
});

// ------------------- ENDPOINTS API REST -------------------

// 1. GET /api/recursos - Obtener todos los elementos (Código 200)
app.get('/api/productos', (req, res) => {
  res.status(200).json(productos);
});

// 2. GET /api/recursos/:id - Obtener un elemento por ID (Código 200 o 404)
app.get('/api/productos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const producto = productos.find(p => p.id === id);

  if (!producto) {
    return res.status(404).json({ mensaje: 'Producto no encontrado' });
  }

  res.status(200).json(producto);
});

// 3. POST /api/recursos - Crear un elemento con ID dinámico (Código 201)
app.post('/api/productos', (req, res) => {
  const { nombre, precio, categoria } = req.body;

  if (!nombre || !precio) {
    return res.status(400).json({ mensaje: 'Nombre y precio son obligatorios' });
  }

  const nuevoId = productos.length > 0 ? productos[productos.length - 1].id + 1 : 1;

  const nuevoProducto = {
    id: nuevoId,
    nombre,
    precio,
    categoria: categoria || 'General'
  };

  productos.push(nuevoProducto);
  res.status(201).json(nuevoProducto);
});

// 4. PUT /api/recursos/:id - Actualizar elemento por ID (Código 200 o 404)
app.put('/api/productos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { nombre, precio, categoria } = req.body;

  const indice = productos.findIndex(p => p.id === id);

  if (indice === -1) {
    return res.status(404).json({ mensaje: 'Producto no encontrado para actualizar' });
  }

  productos[indice] = {
    id,
    nombre: nombre || productos[indice].nombre,
    precio: precio || productos[indice].precio,
    categoria: categoria || productos[indice].categoria
  };

  res.status(200).json(productos[indice]);
});

// 5. DELETE /api/recursos/:id - Eliminar elemento por ID (Código 200 o 404)
app.delete('/api/productos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const indice = productos.findIndex(p => p.id === id);

  if (indice === -1) {
    return res.status(404).json({ mensaje: 'Producto no encontrado' });
  }

  const productoEliminado = productos.splice(indice, 1);

  res.status(200).json({
    mensaje: `Producto con ID ${id} eliminado correctamente`,
    producto: productoEliminado[0]
  });
});

// Levantar el servidor en el puerto 3000 (Paso 5)
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});