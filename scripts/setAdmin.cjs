/* eslint-env node */
/**
 * Script para asignar el rol "admin" a un usuario de Firebase
 * Uso:
 *   node scripts/setAdmin.js <UID_DEL_USUARIO>
 */

const admin = require('firebase-admin');
const path = require('path');

// 👉 Ajustá el nombre si tu archivo se llama distinto
const serviceAccount = require(path.resolve(
  __dirname,
  '../serviceAccountKey.json'
));

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

async function setAdmin(uid) {
  await admin.auth().setCustomUserClaims(uid, { role: 'admin' });
  console.log(`✅ Usuario ${uid} ahora tiene rol ADMIN`);
}

// Leer UID desde la línea de comandos
const uid = process.argv[2];

if (!uid) {
  console.error('❌ Error: Tenés que pasar el UID del usuario');
  console.error('👉 Ejemplo: node scripts/setAdmin.js h3F9Kk2...');
  process.exit(1);
}

// Ejecutar
setAdmin(uid)
  .then(() => {
    console.log('🚀 Listo. Cerrá sesión y volvé a iniciar sesión en la app.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error asignando rol admin:', error);
    process.exit(1);
  });
