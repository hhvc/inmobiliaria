import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";

import { handleOnopropMcpRequest } from "./onopropMcp.js";

const listen = (app) => new Promise((resolve, reject) => {
    const httpServer = app.listen(0, "127.0.0.1", () => resolve(httpServer));
    httpServer.on("error", reject);
});

const closeHttpServer = (server) => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
});

test("el endpoint usa transporte Streamable HTTP en modo sin sesión", async () => {
    const app = createMcpExpressApp({ host: "127.0.0.1" });
    app.all("/mcp", handleOnopropMcpRequest);

    const httpServer = await listen(app);
    const address = httpServer.address();
    const client = new Client({
        name: "onoprop-http-test-client",
        version: "1.0.0",
    });
    const transport = new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${address.port}/mcp`),
    );

    try {
        await client.connect(transport);
        const tools = await client.listTools();
        assert.equal(tools.tools.length, 3);

        const response = await client.callTool({
            name: "onoprop.get_started",
            arguments: { goal: "publicar_inmueble" },
        });
        const publishUrl = new URL(response.structuredContent.options[0].url);
        assert.equal(publishUrl.pathname, "/publicar-inmueble-gratis");
        assert.equal(publishUrl.searchParams.get("utm_source"), "chatgpt");
        assert.equal(publishUrl.searchParams.get("utm_medium"), "plugin");
        assert.equal(publishUrl.searchParams.get("utm_campaign"), "onoprop_mcp");
        assert.equal(publishUrl.searchParams.get("utm_content"), "publicar_inmueble");
    } finally {
        await client.close();
        await closeHttpServer(httpServer);
    }
});
