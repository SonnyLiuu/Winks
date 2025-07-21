import { OpenAPIRoute, Str, Bool } from "chanfana";
import { z } from "zod";
import { AppContext, UserSchema } from "../types";
import { verifyUser } from "../database";

export class UserLogin extends OpenAPIRoute {
    schema = {
        tags: ["Auth"],
        summary: "Login a User",
        request: {
            body: {
                content: {
                    "application/json": {
                        schema: z.object({
                            email: Str(),
                            password: Str(),
                        }),
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Login successful",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool(),
                            message: Str(),
                            user: UserSchema,
                        }),
                    },
                },
            },
            "401": {
                description: "Invalid credentials",
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
        const { email, password } = data.body;

        if (!email || !password) {
            return c.json({ success: false, message: 'Email and password are required.' }, 400);
        }

        const result = await verifyUser(c, email, password);

        if (result.success) {
            return c.json(result, 200);
        } else {
            return c.json(result, 401);
        }
    }
}
