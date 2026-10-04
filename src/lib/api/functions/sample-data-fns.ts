import { createServerFn } from "@tanstack/react-start";
import { getSession } from "../auth";
import { db } from "../db";
import { seedSampleData } from "../db/sample-data";

export const loadSampleData = createServerFn({ method: "POST" }).handler(async () => {
  const session = getSession();
  if (!session) throw new Error("Please sign in as an owner first");
  return seedSampleData(db, session.ownerId);
});
