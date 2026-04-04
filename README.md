# NEXUS · Contactos — PWA CRUD

Aplicación Progressive Web App para gestión de contactos con almacenamiento local usando **IndexedDB**.

## 📁 Archivos

| Archivo | Descripción |
|---|---|
| `index.html` | Aplicación completa (UI + lógica CRUD) |
| `manifest.json` | Manifiesto PWA (instalación en dispositivo) |
| `sw.js` | Service Worker (soporte offline) |

## 🚀 Cómo ejecutar

### Opción 1 — VS Code + Live Server
1. Abre la carpeta en VS Code
2. Instala la extensión **Live Server**
3. Clic derecho en `index.html` → *Open with Live Server*

### Opción 2 — Python HTTP Server
```bash
cd pwa-crud
python3 -m http.server 8080
# Abre: http://localhost:8080
```

### Opción 3 — npx serve
```bash
npx serve pwa-crud
```

> ⚠️ **Importante:** La PWA requiere un servidor HTTP (no `file://`). El Service Worker solo funciona en `localhost` o HTTPS.

## ✨ Funcionalidades

- **Crear** contactos con: Nombres, Dirección, Email, Ciudad
- **Leer** y buscar en tiempo real por nombre, ciudad o email
- **Actualizar** registros con formulario en modo edición
- **Eliminar** con modal de confirmación
- Estadísticas: total de contactos y ciudades únicas
- **Almacenamiento 100% local** con IndexedDB (sin servidor)
- **Funciona offline** gracias al Service Worker
- **Instalable** como app nativa en Android/iOS/Desktop

## 🎨 Stack técnico

- HTML5 + CSS3 + Vanilla JS (sin dependencias)
- IndexedDB API para persistencia local
- Service Worker (Cache API) para modo offline
- Web App Manifest para instalación PWA
- Google Fonts: Syne + DM Mono
