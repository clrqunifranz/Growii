const express = require("express");
const { generateReply } = require("../services/gemini");

const router = express.Router();

// Endpoint para comprobar el estado del servidor
router.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "ALMA Backend está funcionando correctamente"
  });
});

// Endpoint principal de chat
router.post("/chat", async (req, res) => {
  try {
    const body = req.body || {};
    const message = body.message;
    const history = body.history;

    // Validar que message sea una cadena no vacía
    if (typeof message !== "string") {
      return res.status(400).json({ error: "No se pudo procesar la solicitud." });
    }

    if (message.trim().length === 0) {
      return res.status(400).json({ error: "No se pudo procesar la solicitud." });
    }

    if (message.length > 1000) {
      return res.status(400).json({ error: "No se pudo procesar la solicitud." });
    }

    // Validar history cuando esté presente
    if (history !== undefined && history !== null) {
      if (!Array.isArray(history)) {
        return res.status(400).json({ error: "No se pudo procesar la solicitud." });
      }

      if (history.length > 10) {
        return res.status(400).json({ error: "No se pudo procesar la solicitud." });
      }

      for (let i = 0; i < history.length; i++) {
        const item = history[i];
        if (!item || typeof item !== "object") {
          return res.status(400).json({ error: "No se pudo procesar la solicitud." });
        }
        if (item.role !== "user" && item.role !== "assistant") {
          return res.status(400).json({ error: "No se pudo procesar la solicitud." });
        }
        if (typeof item.content !== "string") {
          return res.status(400).json({ error: "No se pudo procesar la solicitud." });
        }
        if (item.content.length > 4000) {
          return res.status(400).json({ error: "No se pudo procesar la solicitud." });
        }
      }
    }

    const reply = await generateReply({ message: message, history: history });
    return res.status(200).json({ reply: reply });
  } catch (error) {
    // Manejar errores sin exponer información interna.
    // Los errores controlados de Gemini llevan status y publicMessage seguros.
    const status = error && Number.isInteger(error.status) && error.status >= 400 && error.status < 600
      ? error.status
      : 500;
    const publicMessage = error && typeof error.publicMessage === "string" && error.publicMessage.length > 0
      ? error.publicMessage
      : "No se pudo procesar la solicitud.";
    const code = error && typeof error.code === "string" ? error.code : "INTERNAL_ERROR";
    console.error(`Error al procesar solicitud de chat. [${code}]`);
    return res.status(status).json({ error: publicMessage });
  }
});

module.exports = router;
