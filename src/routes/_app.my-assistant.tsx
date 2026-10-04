import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, User, AlertTriangle } from "lucide-react";
import { askAssistantFn } from "@/lib/demo-api";
import { createMyComplaint } from "@/lib/demo-api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/my-assistant")({ component: MyAssistantPage });

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  resolved?: boolean;
  sources?: string[];
  question?: string;
  ticketId?: string;
};

function MyAssistantPage() {
  const queryClient = useQueryClient();
  const [submittingTicket, setSubmittingTicket] = useState(false);
  async function sendToStaff(index: number) {
    const message = messages[index];
    if (!message.question || message.ticketId || submittingTicket) return;
    setSubmittingTicket(true);
    try {
      const ticket = await createMyComplaint({ data: { title: message.question, category: "other", priority: "medium" } });
      setMessages((previous) => previous.map((item, i) => i === index ? { ...item, ticketId: ticket.id } : item));
      await queryClient.invalidateQueries({ queryKey: ["my-complaints"] });
      toast.success("Question sent to your PG owner");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send question");
    } finally {
      setSubmittingTicket(false);
    }
  }
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "Hi! Ask me about hostel policies, timings, fees, or amenities. If I can't answer, you can send your question to your PG owner.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || loading) return;

    setMessages((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setLoading(true);

    try {
      const result = await askAssistantFn({ data: { question } });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: result.answer, resolved: result.resolved, sources: result.sources, question },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", text: "Something went wrong. Please try again or send your question to your PG owner.", resolved: false, question },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Ask the Assistant" description="Instant answers from hostel policies & FAQs" />

      <Card className="flex flex-col h-[65vh]">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="mt-1 shrink-0 rounded-full bg-muted p-1.5">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                <p>{m.text}</p>
                {m.role === "assistant" && m.resolved === false && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{m.ticketId ? `Sent to staff: ${m.ticketId}` : "Staff can help with this question"}</span>
                    {!m.ticketId && m.question && <Button size="sm" variant="outline" disabled={submittingTicket} onClick={() => sendToStaff(i)}>Send to staff</Button>}
                  </div>
                )}
                {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.sources.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {m.role === "user" && (
                <div className="mt-1 shrink-0 rounded-full bg-primary/10 p-1.5">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
          {loading && <p className="text-xs text-muted-foreground">Assistant is thinking…</p>}
          <div ref={endRef} />
        </div>

        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="e.g. What time is curfew on weekends?"
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
