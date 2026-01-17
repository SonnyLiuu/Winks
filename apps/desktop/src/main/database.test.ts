// src/main/database.test.ts
import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import {
  connectToDatabase,
  disconnectFromDatabase,
  createUser,
  verifyUser,
} from "./database";

// Only run if a real DB URI is available (keeps CI/dev flexible)
const run = !!process.env.DB_URI ? describe : describe.skip;

function randEmail() {
  return `test+${Date.now()}_${Math.floor(Math.random() * 1e6)}@example.com`;
}

run("Database integration", () => {
  const email = randEmail();
  const password = "CorrectHorseBatteryStaple";

  afterAll(async () => {
    // Cleanup test user and close connection
    try {
      const col = await connectToDatabase();
      await col.deleteOne({ email });
    } finally {
      await disconnectFromDatabase();
    }
  });

  it("createUser (new) -> success + userId", async () => {
    const res = await createUser(email, password);
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/created/i);
    expect(res.userId).toBeDefined();
  });

  it("createUser (duplicate) -> already registered", async () => {
    const res = await createUser(email, password);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already registered/i);
  });

  it("verifyUser (right pw) -> success + user payload", async () => {
    const res = await verifyUser(email, password);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.user.email).toBe(email);
      expect(res.user.id).toBeDefined();
    }
  });

  it("verifyUser (wrong pw) -> invalid credentials", async () => {
    const res = await verifyUser(email, "wrong-password");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/invalid credentials/i);
  });
});
