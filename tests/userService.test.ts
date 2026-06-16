import assert from "node:assert/strict";
import test from "node:test";
import { markGameCompleted } from "../src/Service/userService";

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
    assert.equal(table, "user_game_progress");
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
  assert.deepEqual(client.calls, ["insert"]);
});

test("markGameCompleted returns false when completion already exists", async () => {
  const client = new FakeSupabaseClient([
    { error: { code: "23505", message: "duplicate key value violates unique constraint" } },
    { data: { completed: true }, error: null },
  ]);

  const completed = await markGameCompleted("user-1", "game-1", client as never);

  assert.equal(completed, false);
  assert.deepEqual(client.calls, ["insert", "select"]);
});

test("markGameCompleted upgrades incomplete existing progress", async () => {
  const client = new FakeSupabaseClient([
    { error: { code: "23505", message: "duplicate key value violates unique constraint" } },
    { data: { completed: false }, error: null },
    { data: { completed: true }, error: null },
  ]);

  const completed = await markGameCompleted("user-1", "game-1", client as never);

  assert.equal(completed, true);
  assert.deepEqual(client.calls, ["insert", "select", "update"]);
});
