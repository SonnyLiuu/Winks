import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { UserRegister } from "./endpoints/register";
import { UserLogin } from "./endpoints/login";
import { UserUpdateSettings } from "./endpoints/updateSettings";
import { GetUserSettings } from "./endpoints/getUserSettings";
import { GetGuestSettings } from "./endpoints/getGuestSettings";

// Start a Hono app
const app = new Hono<{ Bindings: Env }>();

// Add CORS middleware to allow requests from any origin
app.use("/api/*", cors());

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/",
});

// Register OpenAPI endpoints
openapi.post("/api/register", UserRegister);
openapi.post("/api/login", UserLogin);
openapi.post("/api/users/:userId/settings", UserUpdateSettings);
openapi.get("/api/users/:userId/settings", GetUserSettings);
openapi.get("/api/settings/guest", GetGuestSettings);


// You may also register routes for non OpenAPI directly on Hono
// Simple health check to see if the worker is alive
app.get('/api/health', (c) => {
	return c.json({ status: 'ok', message: 'Worker is running.' })
})

// Export the Hono app
export default app;
