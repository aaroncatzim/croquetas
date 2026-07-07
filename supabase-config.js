/* ============================================================
   Configuración de Supabase (opcional) — modo navegador.

   1. Crea un proyecto en https://supabase.com
   2. Ejecuta supabase-schema.sql en el editor SQL del proyecto
   3. Copia aquí la URL del proyecto y la llave "anon public"
      (Settings → API)

   Con los dos campos llenos, el login pasa a ser con correo y
   contraseña (usuarios de Supabase Auth) y el catálogo de productos
   se sincroniza con la tabla "productos".

   Si se dejan vacíos, la app funciona 100% local.

   En la app de escritorio, esta configuración se lee del archivo
   supabase.json en la carpeta de datos (junto a productos.json).
   ============================================================ */
window.SUPABASE_CONFIG = {
  url: 'https://qlxgbmbscnbocfxnplni.supabase.co',      // p. ej. 'https://abcdefgh.supabase.co'
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFseGdibWJzY25ib2NmeG5wbG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTE4MTIsImV4cCI6MjA5ODk2NzgxMn0.mayNQgSkPNysujmAT1Qz5bYZS95NhXvxwD6XOxL7mBs',  // llave anon public
};
