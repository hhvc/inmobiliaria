# Cañada al Lago - Sitio Web Turístico

![Cañada al Lago](https://img.shields.io/badge/Cañada-al%20Lago-green)
![React](https://img.shields.io/badge/React-18.2.0-blue)
![Vite](https://img.shields.io/badge/Vite-5.0.0-purple)
![Firebase](https://img.shields.io/badge/Firebase-Hosting-orange)

Sitio web oficial de **Cañada al Lago**, complejo de cabañas y casas de turismo ubicado en Villa Parque Siquiman, Córdoba, Argentina. Desarrollado con React + Vite y desplegado en Firebase.

## 🏞️ Descripción

Este proyecto es la renovación del sitio web [canadaallago.com](http://www.canadaallago.com/), migrado desde HTML estático a una aplicación moderna con React y Vite para mejorar la experiencia de usuario y el rendimiento.

## ✨ Características

- **Diseño Responsive**: Adaptado a todos los dispositivos
- **Navegación Sútil**: Scroll suave entre secciones
- **Galería Interactiva**: Modal para visualización de imágenes
- **Formulario de Contacto**: Integrado con EmailJS
- **Optimización SEO**: Meta tags y estructura semántica
- **Rendimiento**: Carga rápida con Vite
- **WhatsApp Integration**: Botón flotante de contacto directo

## 🚀 Tecnologías Utilizadas

- **Frontend**: React 18 + Vite
- **Estilos**: Bootstrap 5 + CSS personalizado
- **Iconos**: Font Awesome
- **Formularios**: EmailJS
- **Hosting**: Firebase Hosting
- **Deployment**: Firebase CLI

## 📦 Estructura del Proyecto

## 📁 Estructura del Proyecto

```bash
canadaallago/
├── public/                 # Archivos estáticos públicos
│   ├── assets/
│   │   ├── img/           # Todas las imágenes
│   │   │   ├── fotos/     # 📸 Galería del lugar
│   │   │   └── casas/     # 🏠 Fotos de cabañas
│   │   ├── css/           # 🎨 Estilos adicionales
│   │   └── js/            # ⚡ Scripts de terceros
│   └── index.html         # 📄 Template principal
├── src/                   # Código fuente React
│   ├── components/        # 🧩 Componentes React
│   │   ├── Header.jsx     # 🏞️ Encabezado con imagen
│   │   ├── Navbar.jsx     # 🧭 Navegación
│   │   ├── About.jsx      # ℹ️ Sección about/inicio
│   │   ├── Cabanas.jsx    # 🏡 Listado de cabañas
│   │   ├── Gallery.jsx    # 🖼️ Galería interactiva
│   │   ├── Activities.jsx # 🎯 Actividades
│   │   ├── Contact.jsx    # 📞 Formulario contacto
│   │   ├── Testimonials.jsx # 💬 Testimonios
│   │   ├── Footer.jsx     # 👣 Pie de página
│   │   └── WhatsAppButton.jsx # 💬 Botón WhatsApp
│   ├── App.jsx            # 🔧 Componente raíz
│   ├── main.jsx           # 🚀 Punto de entrada
│   └── index.css          # 🎨 Estilos globales
├── package.json           # 📦 Dependencias NPM
├── vite.config.js         # ⚡ Configuración Vite
├── firebase.json          # 🔥 Configuración Firebase
├── .env                   # 🔐 Variables entorno
├── .gitignore            # 🙈 Archivos ignorados
└── README.md             # 📖 Documentación
```

## Integración con Mercado Libre

La configuración de la aplicación, secretos, callbacks, despliegue y prueba
controlada se encuentra en [MERCADOLIBRE_SETUP.md](./MERCADOLIBRE_SETUP.md).
