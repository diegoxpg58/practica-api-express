const API_URL = 'http://localhost:3000/api/productos';

document.addEventListener('DOMContentLoaded', () => {
  cargarProductos();
});

async function cargarProductos() {
  try {
    const respuesta = await fetch(API_URL);
    if (!respuesta.ok) {
      throw new Error('Error al obtener los datos de la API');
    }
    const productos = await respuesta.json();

    renderizarTabla(productos);

    const nombres = productos.map(p => p.nombre);
    const precios = productos.map(p => parseFloat(p.precio));

    renderizarGrafico(nombres, precios);

  } catch (error) {
    console.error('Error:', error);
  }
}

function renderizarTabla(productos) {
  const tablaBody = document.getElementById('tabla-body');
  tablaBody.innerHTML = '';

  productos.forEach(producto => {
    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td>${producto.id}</td>
      <td>${producto.nombre}</td>
      <td>$${parseFloat(producto.precio).toFixed(2)}</td>
      <td>${producto.categoria}</td>
    `;
    tablaBody.appendChild(fila);
  });
}

function renderizarGrafico(etiquetas, datos) {
  const ctx = document.getElementById('miGrafica').getContext('2d');
  
  new Chart(ctx, {
    type: 'bar', // Tipo de gráfico: barra
    data: {
      labels: etiquetas,
      datasets: [{
        label: 'Precio ($ MXN)',
        data: datos,
        backgroundColor: [
          'rgba(0, 230, 118, 0.6)',
          'rgba(41, 121, 255, 0.6)',
          'rgba(255, 145, 0, 0.6)',
          'rgba(213, 0, 249, 0.6)',
          'rgba(255, 23, 68, 0.6)'
        ],
        borderColor: [
          '#00e676',
          '#2979ff',
          '#ff9100',
          '#d500f9',
          '#ff1744'
        ],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#ffffff' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#e0e0e0' },
          grid: { color: '#333' }
        },
        y: {
          ticks: { color: '#e0e0e0' },
          grid: { color: '#333' },
          beginAtZero: true
        }
      }
    }
  });
}