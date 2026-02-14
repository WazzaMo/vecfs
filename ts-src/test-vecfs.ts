import { VecFSStorage } from "./storage.js";
import { toSparse } from "./sparse-vector.js";

async function test() {
  const storage = new VecFSStorage("./test-data.jsonl");
  await storage.ensureFile();

  console.log("Storing some vectors...");
  const v1 = toSparse([1, 0, 0.5, 0, 0]);
  const v2 = toSparse([0, 1, 0, 0.8, 0]);
  const v3 = toSparse([1, 1, 0, 0, 0]);

  await storage.store({ id: "1", vector: v1, metadata: { text: "Vector 1" }, score: 0 });
  await storage.store({ id: "2", vector: v2, metadata: { text: "Vector 2" }, score: 0 });
  await storage.store({ id: "3", vector: v3, metadata: { text: "Vector 3" }, score: 0 });

  console.log("Searching for [1, 0, 0, 0, 0]...");
  const query = toSparse([1, 0, 0, 0, 0]);
  const results = await storage.search(query);
  console.log("Results:", JSON.stringify(results, null, 2));

  console.log("Updating score for entry 1...");
  await storage.updateScore("1", 5);

  console.log("Verifying score update...");
  const results2 = await storage.search(query);
  console.log("Results after update:", JSON.stringify(results2, null, 2));
}

test().catch(console.error);
