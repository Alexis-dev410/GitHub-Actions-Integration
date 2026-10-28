import mongoose from "mongoose";
import session from "express-session";
import request from "supertest";
import createApp from "../src/app";
import User from "../src/models/user";
import Note from "../src/models/note";
import env from "../src/util/validateEnv";

const uri = env.MONGO_CONNECTION_STRING;
// This suite deletes its collections. Require an explicitly named test database.
if (!new URL(uri).pathname.endsWith("_test")) {
    throw new Error("Tests require a MongoDB database name ending in _test");
}
const store = new session.MemoryStore();
const app = createApp(store);
const credentials = { username: "student", email: "student@example.test", password: "classroom-password" };

beforeAll(async () => {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    await Promise.all([User.init(), Note.init()]);
});
beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Note.deleteMany({})]);
    store.clear();
});
afterAll(async () => {
    await mongoose.disconnect();
});

test("health endpoint is available", async () => {
    const response = await request(app).get("/api/health").expect(200);
    expect(response.body).toEqual({ status: "broken" });
});

test("notes require authentication", async () => {
    await request(app).get("/api/notes").expect(401);
});

test("signup establishes a session; login and logout work", async () => {
    const client = request.agent(app);
    await client.post("/api/users/signup").send(credentials).expect(201);
    const current = await client.get("/api/users").expect(200);
    expect(current.body.username).toBe(credentials.username);
    await client.post("/api/users/logout").expect(200);
    await client.get("/api/users").expect(401);
    await client.post("/api/users/login").send({ username: credentials.username, password: "wrong" }).expect(401);
    await client.post("/api/users/login").send(credentials).expect(201);
    await client.get("/api/users").expect(200);
});

test("an authenticated user can create, list, update, and delete a note", async () => {
    const client = request.agent(app);
    await client.post("/api/users/signup").send(credentials).expect(201);
    await client.post("/api/notes").send({ text: "missing title" }).expect(400);
    const created = await client.post("/api/notes").send({ title: "First", text: "CI lab" }).expect(201);
    const id = created.body._id;
    const list = await client.get("/api/notes").expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]._id).toBe(id);
    const updated = await client.patch(`/api/notes/${id}`).send({ title: "Updated", text: "Passed" }).expect(200);
    expect(updated.body.title).toBe("Updated");
    await client.delete(`/api/notes/${id}`).expect(204);
    const empty = await client.get("/api/notes").expect(200);
    expect(empty.body).toEqual([]);
});

test("another user cannot read, modify, or delete the owner's note", async () => {
    const owner = request.agent(app);
    const other = request.agent(app);
    await owner.post("/api/users/signup").send(credentials).expect(201);
    const created = await owner.post("/api/notes").send({ title: "Private" }).expect(201);
    await other.post("/api/users/signup").send({ ...credentials, username: "other", email: "other@example.test" }).expect(201);
    const id = created.body._id;
    const list = await other.get("/api/notes").expect(200);
    expect(list.body).toEqual([]);
    await other.get(`/api/notes/${id}`).expect(401);
    await other.patch(`/api/notes/${id}`).send({ title: "Changed" }).expect(401);
    await other.delete(`/api/notes/${id}`).expect(401);
    await owner.get(`/api/notes/${id}`).expect(200);
});
