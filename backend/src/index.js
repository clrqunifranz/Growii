
// 1. Cargar variables de entorno
require("dotenv").config();

// 2. Importar dependencias
const express = require("express");
const cors = require("cors");

// 3. Importar nuestras rutas
const chatRoutes = require("./routes/chat");

// 4. Crear la aplicación Express
const app = express();

// 5. Configurar el puerto
const PORT = process.env.PORT || 3000;

// 6. Configurar CORS
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://growii-frontend.vercel.app"
    ]
  })
);

// 7. Permitir recibir información JSON
app.use(express.json({ limit: "10kb" }));

// 8. Registrar las rutas
app.use("/api", chatRoutes);

// 9. Iniciar el servidor
app.listen(PORT, () => {
  console.log(`ALMA Backend funcionando en http://localhost:${PORT}`);
});
