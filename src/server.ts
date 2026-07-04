import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {z} from "zod";
import fs from "node:fs/promises"
import {ResourceTemplate} from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer(
    {name: "test", version: "1.0.0"},
    {capabilities: {resources: {}, tools: {}, prompts: {}}}
)

// Define a resource template to get a user by id
server.resource(
    "user-details",
    new ResourceTemplate("users://{userId}/profile", {list: undefined}),
    {
        description: "Get a user's details from the database",
        title: "User Details",
        mimeType: "application/json",
    },
    // Note: template callbacks receive (uri, variables, extra). Don't destructure the
    // second parameter directly in the function signature because it may be undefined
    // when a match isn't found — destructuring would throw. Instead read variables?.userId
    async (uri, variables) => {
        const userIdRaw = variables?.userId;
        const users = await import("./data/users.json", {
            with: {type: "json"},
        }).then((m) => m.default);

        const id = userIdRaw ? parseInt(String(userIdRaw), 10) : NaN;
        if (!userIdRaw || Number.isNaN(id)) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify({error: "User not found"}),
                        mimeType: "application/json",
                    },
                ],
            };
        }

        const user = users.find((u) => u.id === id);

        if (user == null) {
            return {
                contents: [
                    {
                        uri: uri.href,
                        text: JSON.stringify({error: "User not found"}),
                        mimeType: "application/json",
                    },
                ],
            };
        }

        return {
            contents: [
                {
                    uri: uri.href,
                    text: JSON.stringify(user),
                    mimeType: "application/json",
                },
            ],
        };
    }
);

// Define a resource to list all users
server.resource("users", "users://all", {
    description: "Get all users data from the database",
    title: "Users",
    mimeType: "application/json",
}, async uri => {
    const users = await import("./data/users.json", {
        with: {type: "json"},
    }).then(m => m.default)
    return {
        contents: [
            {
                uri: uri.href,
                text: JSON.stringify(users),
                mimeType: "application/json"
            }
        ]
    }
})

// Define a tool to create a new user
server.tool("create-user", "Create a new user in the database", {
    name: z.string(),
    email: z.string(),
    address: z.string(),
    phone: z.string()
}, {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
}, async (params) => {
    try {
        const id = await createUser(params);
        return {
            content: [
                {
                    type: "text",
                    text: `User ${id} created successfully`
                }
            ]
        }
    } catch {
        return {
            content: [
                {
                    type: "text",
                    text: "Failed to save user"
                }
            ]
        }
    }
})

//Configure a prompt to generate a fake user based on a given name
server.prompt("generate-fake-user", "Generate a fake user based on a given name", {
        name: z.string()
    }, ({name}) => {
        return {
            messages: [{
                role: 'user',
                content: {
                    type: "text",
                    text: `Generate a fake user with the name ${name}. The user should have a realistic name, email, address, and phone number.`
                }
            }]
        }
    }
)

async function createUser(user: {
    name: string,
    email: string,
    address: string,
    phone: string
}) {
    const users = await import("./data/users.json", {
        with: {type: "json"}
    }).then(m => m.default)
    const id = users.length + 1
    users.push({id, ...user})
    await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2))
    return id
}

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

await main()