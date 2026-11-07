
const API = "https://api.dev.runwayml.com/v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...cors
    }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const path = new URL(request.url).pathname;

    if (path === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "MIAntoClip",
        runwayConfigured: Boolean(env.RUNWAYML_API_SECRET)
      });
    }

    if (!env.RUNWAYML_API_SECRET) {
      return json({ error: "Falta configurar RUNWAYML_API_SECRET" }, 503);
    }

    const headers = {
      Authorization: `Bearer ${env.RUNWAYML_API_SECRET}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json"
    };

    if (path === "/generate" && request.method === "POST") {
      try {
        const body = await request.json();
        const prompt = String(body.prompt || "").trim();
        const duration = Number(body.duration);
        const ratio = String(body.ratio || "1280:720");
        const image = body.image;

        if (!prompt || prompt.length > 1000)
          return json({ error: "Descripción no válida" }, 400);

        if (![5, 10].includes(duration))
          return json({ error: "Solo se admiten 5 o 10 segundos" }, 400);

        if (!["1280:720", "720:1280"].includes(ratio))
          return json({ error: "Formato no válido" }, 400);

        if (typeof image !== "string" ||
            !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image))
          return json({ error: "Imagen no válida o ausente" }, 400);

        if (image.length > 5700000)
          return json({ error: "Imagen demasiado grande" }, 413);

        const response = await fetch(API + "/image_to_video", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: "gen4_turbo",
            promptText: prompt,
            promptImage: image,
            duration,
            ratio
          })
        });

        const data = await response.json();

        if (!response.ok)
          return json({
            error: data.error || data.message || "Runway rechazó la solicitud",
            details: data.issues || null
          }, response.status);

        return json({ id: data.id });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    if (path === "/status" && request.method === "POST") {
      try {
        const body = await request.json();
        const id = String(body.id || "");

        if (!/^[a-f0-9-]{36}$/i.test(id))
          return json({ error: "Identificador no válido" }, 400);

        const response = await fetch(
          API + "/tasks/" + encodeURIComponent(id),
          { headers }
        );

        const data = await response.json();

        if (!response.ok)
          return json({
            error: data.error || data.message || "Error consultando Runway"
          }, response.status);

        return json({
          status: data.status,
          output: data.output || [],
          failure: data.failure || data.failureCode || null
        });
      } catch (e) {
        return json({ error: String(e) }, 500);
      }
    }

    return json({ error: "Ruta no encontrada" }, 404);
  }
};
