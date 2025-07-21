import { OpenAPIRoute, Str, Obj, Bool } from "chanfana";
import { z } from "zod";
import { AppContext, UserSchema } from "../types";
import { createUser } from "../database";

export class UserRegister extends OpenAPIRoute {
    schema = {
        tags: ["Auth"],
        summary: "Register a new User",
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
            "201": {
                description: "User created successfully",
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
            "409": {
                description: "User already exists",
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

        const result = await createUser(c, email, password)

        if (result.success) {
          return c.json(result, 201)
        } else {
          if (result.message === 'Email already registered') {
            return c.json(result, 409)
          }
          return c.json(result, 400)
        }
    }
}
