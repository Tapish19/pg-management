import { askAssistant } from "./chain";

// Labeled eval set: realistic tenant questions, a mix of ones that ARE
// covered by the policy docs (shouldResolve: true) and ones that AREN'T
// (out-of-scope, e.g. asking about something the hostel simply doesn't
// document) to check the assistant escalates appropriately instead of
// hallucinating. This is what should back a "resolves X% of queries"
// claim — run this, report the real number, update the resume with it.
const EVAL_SET: { question: string; shouldResolve: boolean }[] = [
  { question: "What time do I need to be back at the hostel at night?", shouldResolve: true },
  { question: "Can I have an overnight guest stay in my room?", shouldResolve: true },
  { question: "How much notice do I need to give before moving out?", shouldResolve: true },
  { question: "When is rent due every month?", shouldResolve: true },
  { question: "Is there a late fee if I pay rent after the 5th?", shouldResolve: true },
  { question: "How do I pay my rent?", shouldResolve: true },
  { question: "Is Wi-Fi included in my rent?", shouldResolve: true },
  { question: "What days does laundry service run?", shouldResolve: true },
  { question: "Can I cook in my room?", shouldResolve: true },
  { question: "How long does it take to get my security deposit back?", shouldResolve: true },
  { question: "Can I bring my dog to live with me?", shouldResolve: false },
  { question: "Do you offer a discount if I refer a friend?", shouldResolve: false },
  { question: "What's the property owner's personal phone number?", shouldResolve: false },
  { question: "Can I sublet my room to someone else?", shouldResolve: false },
];

async function runEval() {
  let correct = 0;
  let resolvedCount = 0;

  for (const item of EVAL_SET) {
    const result = await askAssistant(item.question);
    const gotItRight = result.resolved === item.shouldResolve;
    if (gotItRight) correct++;
    if (result.resolved) resolvedCount++;

    console.log(
      `${gotItRight ? "✅" : "❌"} [${result.resolved ? "resolved" : "escalated"}] (score ${result.topScore.toFixed(2)}) "${item.question}"`
    );
  }

  console.log("\n--- Summary ---");
  console.log(`Resolution rate: ${((resolvedCount / EVAL_SET.length) * 100).toFixed(1)}%`);
  console.log(`Escalation accuracy (resolved/escalated matched expectation): ${((correct / EVAL_SET.length) * 100).toFixed(1)}%`);
}

if (require.main === module) {
  runEval()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Eval failed:", err);
      process.exit(1);
    });
}
