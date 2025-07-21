import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../types";

export class GetGuestSettings extends OpenAPIRoute {
    schema = {
        tags: ["Settings"],
        summary: "Get guest settings",
        responses: {
            "200": {
                description: "Returns guest settings",
                content: {
                    "application/json": {
                        schema: z.object({
                            leftWinkSensitivity: z.number(),
                            rightWinkSensitivity: z.number(),
                            yaw: z.number(),
                            pitch: z.number(),
                            deadZone: z.number(),
                            tiltAngle: z.number(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        // For guest users, return a default/template settings file
        const guestSettings = {
            leftWinkSensitivity: 0.50,
            rightWinkSensitivity: 0.50,
            yaw: 45,
            pitch: 45,
            deadZone: 6,
            tiltAngle: 20,
        };
        return c.json(guestSettings, 200);
    }
}

