import assert from "node:assert/strict";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createOnopropMcpServer } from "./onopropMcp.js";

test("el servidor MCP anuncia tres herramientas seguras y responde get_started", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createOnopropMcpServer();
    const client = new Client({
        name: "onoprop-test-client",
        version: "1.0.0",
    });

    await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
    ]);

    try {
        const tools = await client.listTools();
        assert.deepEqual(
            tools.tools.map((tool) => tool.name).sort(),
            [
                "onoprop.get_property",
                "onoprop.get_started",
                "onoprop.search_properties",
            ],
        );
        tools.tools.forEach((tool) => {
            assert.equal(tool.annotations?.readOnlyHint, true);
            assert.equal(tool.annotations?.destructiveHint, false);
            assert.equal(tool.annotations?.openWorldHint, false);
        });
        const toolsByName = Object.fromEntries(
            tools.tools.map((tool) => [tool.name, tool]),
        );
        assert.deepEqual(
            Object.keys(
                toolsByName["onoprop.search_properties"].outputSchema.properties,
            ).sort(),
            ["count", "results"],
        );
        assert.deepEqual(
            Object.keys(
                toolsByName["onoprop.get_property"].outputSchema.properties,
            ),
            ["property"],
        );
        assert.deepEqual(
            Object.keys(
                toolsByName["onoprop.get_started"].outputSchema.properties,
            ),
            ["options"],
        );

        const response = await client.callTool({
            name: "onoprop.get_started",
            arguments: { goal: "contratar_software" },
        });
        assert.equal(response.isError, undefined);
        assert.equal(response.structuredContent.options.length, 1);
        const softwareUrl = new URL(response.structuredContent.options[0].url);
        assert.equal(softwareUrl.pathname, "/software-para-inmobiliarias");
        assert.equal(softwareUrl.searchParams.get("utm_source"), "chatgpt");
        assert.equal(softwareUrl.searchParams.get("utm_medium"), "plugin");
        assert.equal(softwareUrl.searchParams.get("utm_campaign"), "onoprop_mcp");
        assert.equal(softwareUrl.searchParams.get("utm_content"), "contratar_software");
        assert.match(
            response.content[0].text,
            /https:\/\/onoprop\.com\/software-para-inmobiliarias/,
        );
        assert.equal(response.content.length, 1);
        assert.deepEqual(
            JSON.parse(response.content[0].text),
            response.structuredContent,
        );

        const appraisalResponse = await client.callTool({
            name: "onoprop.get_started",
            arguments: { goal: "solicitar_tasacion" },
        });
        const appraisalUrl = new URL(
            appraisalResponse.structuredContent.options[0].url,
        );
        assert.equal(appraisalUrl.pathname, "/contacto");
        assert.equal(appraisalUrl.searchParams.get("utm_content"), "solicitar_tasacion");
    } finally {
        await client.close();
        await server.close();
    }
});
