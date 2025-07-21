import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { AppContext, SettingsSchema } from "../types";
import { getUserSettings } from "../database";

export class GetUserSettings extends OpenAPIRoute {
    schema = {
        tags: ["User"],
        summary: "Get settings for a logged-in user",
        request: {
            params: z.object({
                userId: Str(),
            }),
        },
        responses: {
            "200": {
                description: "Returns user settings",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            settings: SettingsSchema,
                        }),
                    },
                },
            },
            "404": {
                description: "User not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: z.boolean(),
                            message: z.string(),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: AppContext) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { userId } = data.params;

        const result = await getUserSettings(c, userId);

        if (result.success) {
            return c.json(result, 200);
        } else {
            return c.json(result, 404);
        }
    }
}

