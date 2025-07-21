import { OpenAPIRoute, Str, Bool } from "chanfana";
import { z } from "zod";
import { AppContext, SettingsSchema } from "../types";
import { updateUserSettings } from "../database";

export class UserUpdateSettings extends OpenAPIRoute {
    schema = {
        tags: ["User"],
        summary: "Update User Settings",
        request: {
            params: z.object({
                userId: Str(),
            }),
            body: {
                content: {
                    "application/json": {
                        schema: z.object({
                            settings: SettingsSchema,
                        }),
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Settings updated successfully",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            message: Str(),
                        }),
                    },
                },
            },
            "404": {
                description: "User not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            message: Str(),
                        }),
                    },
                },
            },
            "400": {
                description: "Invalid request",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            message: Str(),
                        }),
                    },
                },
            }
        },
    };

    async handle(c: AppContext) {
        const data = await this.getValidatedData<typeof this.schema>();
        const { userId } = data.params;
        const { settings } = data.body;

        if (!userId || !settings) {
            return c.json({ success: false, message: 'User ID and settings are required.' }, 400);
        }

        const result = await updateUserSettings(c, userId, settings);

        if (result.success) {
            return c.json(result, 200);
        } else {
            return c.json(result, 404);
        }
    }
}
