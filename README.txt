Planificador de Puntos Familiar (web app estática)
====================================================

Cómo usar
---------
1) Descarga y descomprime el ZIP.
2) Abre `index.html` en tu navegador (Chrome/Safari/Edge). No requiere servidor.
3) Configura los nombres (Sebastián / Isa) y el límite de deuda.
4) Usa la pestaña **Planificación** para reservar slots aproximados.
5) Registra salidas reales en **Registro**. Los puntos se calculan automáticamente
   según bloques de 30 min y las tarifas acordadas.
6) Ve el saldo y si alguien está bloqueado en **Resumen**.
7) Exporta el registro a CSV o haz backup/restore en JSON desde **Config/Backup**.

Tarifas (puntos por 30 minutos)
-------------------------------
Lunes a Viernes:
- 00:00–07:00 → 2
- 07:00–08:30 → 4
- 08:30–17:30 → 0
- 17:30–20:30 → 6
- 20:30–24:00 → 2

Sábado y Domingo:
- 00:00–08:00 → 1
- 08:00–10:00 → 2
- 10:00–12:00 → 1
- 12:00–14:00 → 2
- 14:00–17:30 → 1
- 17:30–20:30 → 3
- 20:30–24:00 → 1

Notas
-----
- Unidad mínima: 30 min. Si una salida dura 15 min o menos, no se cobra.
- Si una salida cruza varias franjas, cada bloque de 30 min se cobra a la tarifa
  del bloque correspondiente.
- Solo se descuentan puntos al que sale; no se suman puntos por cuidar.
- Límite de deuda por defecto: -12 (configurable).

Hosting / compartir
-------------------
- Sube estos archivos a GitHub Pages, Netlify o Vercel para acceso por Internet.
- iOS: abre `index.html` en Safari → “Compartir” → “Añadir a pantalla de inicio”.
