import assert from "node:assert/strict";
import test from "node:test";
import { awardExperience, markGameCompleted } from "../src/Service/userService";

type QueryResult = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
};

class FakeSupabaseQuery {
  private readonly result: QueryResult;

  constructor(result: QueryResult) {
    this.result = result;
  }

  select(): FakeSupabaseQuery {
    return this;
  }

  eq(): FakeSupabaseQuery {
    return this;
  }

  single(): QueryResult {
    return this.result;
  }

  maybeSingle(): QueryResult {
    return this.result;
  }

  then(resolve: (result: QueryResult) => void): void {
    resolve(this.result);
  }
}

class FakeSupabaseClient {
  readonly calls: string[] = [];
  private readonly results: QueryResult[];

  constructor(results: QueryResult[]) {
    this.results = results;
  }

  from(table: string): FakeSupabaseClient {
    this.calls.push(`from:${table}`);
    return this;
  }

  insert(): FakeSupabaseQuery {
    this.calls.push("insert");
    return new FakeSupabaseQuery(this.nextResult());
  }

  select(): FakeSupabaseQuery {
    this.calls.push("select");
    return new FakeSupabaseQuery(this.nextResult());
  }

  update(): FakeSupabaseQuery {
    this.calls.push("update");
    return new FakeSupabaseQuery(this.nextResult());
  }

  rpc(functionName: string, params: unknown): QueryResult {
    this.calls.push(`rpc:${functionName}:${JSON.stringify(params)}`);
    return this.nextResult();
  }

  private nextResult(): QueryResult {
    const result = this.results.shift();
    assert.ok(result, "expected another fake Supabase result");
    return result;
  }
}

test("markGameCompleted returns true when it inserts a new completion", async () => {
  const client = new FakeSupabaseClient([{ error: null }]);

  const completed = await markGameCompleted("user-1", "game-1", client as never);

  assert.equal(completed, true);
  assert.deepEqual(client.calls, ["from:user_game_progress", "insert"]);
});

test("markGameCompleted returns false when completion already exists", async () => {
  const client = new FakeSupabaseClient([
    { error: { code: "23505", message: "duplicate key value violates unique constraint" } },
    { data: { completed: true }, error: null },
  ]);

  const completed = await markGameCompleted("user-1", "game-1", client as never);

  assert.equal(completed, false);
  assert.deepEqual(client.calls, [
    "from:user_game_progress",
    "insert",
    "from:user_game_progress",
    "select",
  ]);
});

test("markGameCompleted upgrades incomplete existing progress", async () => {
  const client = new FakeSupabaseClient([
    { error: { code: "23505", message: "duplicate key value violates unique constraint" } },
    { data: { completed: false }, error: null },
    { data: { completed: true }, error: null },
  ]);

  const completed = await markGameCompleted("user-1", "game-1", client as never);

  assert.equal(completed, true);
  assert.deepEqual(client.calls, [
    "from:user_game_progress",
    "insert",
    "from:user_game_progress",
    "select",
    "from:user_game_progress",
    "update",
  ]);
});

test("awardExperience increments XP through the database function", async () => {
  const client = new FakeSupabaseClient([
    { data: { experience: 25 }, error: null },
    { error: null },
  ]);

  const xpAwarded = await awardExperience("user-1", "game-1", client as never);

  assert.equal(xpAwarded, 25);
  assert.deepEqual(client.calls, [
    "from:games",
    "select",
    'rpc:increment_user_experience:{"p_user_id":"user-1","p_delta":25}',
  ]);
});

test("awardExperience skips the RPC when the game awards no XP", async () => {
  const client = new FakeSupabaseClient([{ data: { experience: 0 }, error: null }]);

  const xpAwarded = await awardExperience("user-1", "game-1", client as never);

  assert.equal(xpAwarded, 0);
  assert.deepEqual(client.calls, ["from:games", "select"]);
});
