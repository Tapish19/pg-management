import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getTenantSession } from "../auth";
import { askAssistant } from "../../rag/chain";

function requireSession() {
  const session = getTenantSession();
  if (!session) throw new Error("Please sign in first");
  return session;
}

// Tenant-facing: ask the RAG assistant a question about hostel policies/FAQs.
// If the assistant isn't confident it can answer from the indexed docs, it
// returns resolved:false and the UI should offer to file it as a complaint
// / route it to staff instead of showing a guessed answer.
export const askAssistantFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ question: z.string().min(3).max(500) }).parse(input))
  .handler(async ({ data }) => {
    requireSession();
    try {
      return await askAssistant(data.question);
    } catch (error) {
      // The client-side catch in _app.my-assistant.tsx only shows a generic
      // "something went wrong" message, so log the real cause here — this
      // runs server-side and will show up in Render's logs.
      console.error("[assistant] askAssistant failed:", error);
      throw error;
    }
  });
