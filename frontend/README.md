# Growii — Frontend

Interfaz de **Growii**, el asistente virtual de Red Alumni y Coordinación de Empleabilidad de UNIFRANZ.

React 19 + TypeScript + Vite + CSS + Three.js (React Three Fiber) + Fetch API + Web Speech API.

## Ejecutar

```bash
npm install
npm run dev      # desarrollo (http://localhost:5173)
npm run build    # type-check + build de producción
npm run preview  # servir el build
```

## Variables de entorno

Ver `.env.example`.

- `VITE_API_BASE_URL` — backend de UNIFRANZ (sin barra final).
- `VITE_USE_MOCK` — `true` (default): respuestas de prueba locales, claramente identificadas. `false`: backend real.

La voz usa SpeechSynthesis del navegador (voces españolas instaladas en el
tótem). No requiere endpoint ni claves.

## Contrato con el backend

- `GET /api/health`
- `POST /api/chat` — `{ message, history: [{role, content}] }` → `{ reply }`

## Estructura

```
src/
  components/     GrowiiOwl (búho 3D), WelcomeScreen, ChatScreen,
                  MonitorScreen (diagnóstico de equipo), icons
  hooks/          useConversation, useSpeechSynthesis (voz + fallback),
                  useSpeechRecognition, useReducedMotion
  services/       chatApi (POST /api/chat)
  styles/         global.css (base + fuentes), growii.css (sistema editorial vertical)
  utils/          speechSchedule (pico), profileInference (heurística de perfil),
                  telemetry (registro en memoria para el panel)
public/assets/growii/   animal_owl.glb (CC0, Vuena), unifranz-logo.png
```

## Panel interno de monitoreo

Botón discreto `···` en la esquina inferior izquierda (junto a "Coordinación
de Empleabilidad"). Muestra estado, perfil detectado, conversación, eventos
y permite enviar peticiones de prueba al backend. Sin autenticación:
pendiente coordinar protección con el responsable del backend.

## Notas

- El búho 3D es CC0 (Vuena, "Blocky Pets FREE"). No requiere atribución.
- La sincronización del pico es animación visual coordinada con la voz
  (programación silábica con SpeechSynthesis; secuencia orgánica con ElevenLabs).
  No existe sincronización fonética real.
