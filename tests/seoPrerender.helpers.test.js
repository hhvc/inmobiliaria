import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPropertySeoRoute,
  escapeHtml,
  renderSeoDocument,
} from "../scripts/seo-prerender.helpers.mjs";

test("escapa contenido aportado por usuarios", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
});

test("genera metadatos y contenido estático para un inmueble", () => {
  const route = buildPropertySeoRoute({
    routePath: "/inmueble/casa-prueba-123",
    agency: { nombre: "Inmobiliaria Demo" },
    property: {
      titulo: "Casa con patio",
      operacion: "venta",
      tipo: "casa",
      precio: 100000,
      moneda: "USD",
      direccion: { barrio: "Cerro", ciudad: "Córdoba" },
      descripcion: "Tres dormitorios y cochera.",
    },
  });
  const html = renderSeoDocument(
    '<html><head><title>ONO Prop</title></head><body><div id="root"></div></body></html>',
    route,
  );

  assert.match(html, /<title>Casa con patio \| Inmobiliaria Demo<\/title>/);
  assert.match(html, /rel="canonical" href="https:\/\/onoprop\.com\/inmueble\/casa-prueba-123"/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /data-static-seo="true"/);
  assert.match(html, /USD 100\.000/);
});

test("el contenido prerenderizado no conserva HTML peligroso", () => {
  const route = buildPropertySeoRoute({
    routePath: "/inmueble/seguro",
    property: {
      titulo: "Casa <script>alert(1)</script>",
      descripcion: "Descripción <img src=x onerror=alert(1)>",
    },
  });
  const html = renderSeoDocument(
    '<html><head><title>ONO Prop</title></head><body><div id="root"></div></body></html>',
    route,
  );

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.doesNotMatch(html, /<img src=x onerror/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
