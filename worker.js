
const API = "https://api.dev.runwayml.com/v1";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "MIAntoClip",
        runwayConfigured: Boolean(env.RUNWAYML_API_SECRET)
      });
    }

    if (!env.RUNWAYML_API_SECRET) {
      return json({
        error: "Falta configurar RUNWAYML_API_SECRET"
      }, 503);
    }

    const headers = {
      "Authorization": `Bearer ${env.RUNWAYML_API_SECRET}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json"
    };

    if (path === "/generate" && request.method === "POST") {
      try {
        const form = await request.formData();
        const prompt = String(form.get("prompt") || "").trim();
        const mode = String(form.get("mode") || "text");
        const duration = Number(form.get("duration"));
        const ratio = String(form.get("ratio") || "1280:720");

        if (!prompt || prompt.length > 1000) {
          return json({error: "Descripción no válida"}, 400);
        }

        if (![5, 10].includes(duration)) {
          return json({
            error: "Por ahora solo se admiten 5 o 10 segundos"
          }, 400);
        }

        if (!["1280:720", "720:1280"].includes(ratio)) {
          return json({error: "Formato no válido"}, 400);
        }

        const payload = {
          model: "gen4.5",
          promptText: prompt,
          duration,
          ratio
        };

        let endpoint = "/text_to_video";

        if (mode === "image") {
          const file = form.get("image");

          if (!(file instanceof File)) {
            return json({error: "Falta la imagen"}, 400);
          }

          if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)
              || file.size > 3500000) {
            return json({error: "Imagen demasiado grande o no válida"}, 400);
          }

          const bytes = new Uint8Array(await file.arrayBuffer());
          let binary = "";
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
          }

          payload.promptImage = `data:${file.type};base64,${btoa(binary)}`;
          endpoint = "/image_to_video";
        } else if (mode !== "text") {
          return json({error: "Modo no válido"}, 400);
        }

        const response = await fetch(API + endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
          return json({
            error: data.error || data.message || "Runway rechazó la solicitud",
            details: data.issues || null
          }, response.status);
        }

        return json({taskId: data.id});
      } catch (error) {
        return json({error: "Error procesando la solicitud"}, 500);
      }
    }

    if (path.startsWith("/status/") && request.method === "GET") {
      const id = path.slice("/status/".length);

      if (!/^[a-f0-9-]{36}$/i.test(id)) {
        return json({error: "Identificador no válido"}, 400);
      }

      const response = await fetch(
        API + "/tasks/" + encodeURIComponent(id),
        {headers}
      );

      const data = await response.json();

      if (!response.ok) {
        return json({
          error: data.error || "Error consultando Runway"
        }, response.status);
      }

      return json({
        status: String(data.status || "").toLowerCase(),
        videoUrl: data.status === "SUCCEEDED"
          ? data.output?.[0] || null
          : null,
        error: data.failure || data.failureCode || null
      });
    }

    return json({error: "Ruta no encontrada"}, 404);
  }
};
