import { NextResponse } from "next/server";
import * as chrono from "chrono-node";
import {
  type AgentAction,
  type AgentMessage,
  type AgentState,
  createDefaultAgentState,
} from "@/lib/agent/types";
import { createId } from "@/lib/utils";

type AgentRequestPayload = {
  message?: string;
  history?: AgentMessage[];
  state?: AgentState;
  apiKey?: string;
};

const MAX_HISTORY = 10;

const cloneState = (state: AgentState | undefined): AgentState => {
  if (!state) {
    return createDefaultAgentState();
  }
  return {
    todos: state.todos?.map((todo) => ({ ...todo })) ?? [],
    notes: state.notes?.map((note) => ({ ...note })) ?? [],
    reminders: state.reminders?.map((reminder) => ({ ...reminder })) ?? [],
    knowledgeBase:
      state.knowledgeBase?.map((item) => ({
        ...item,
        tags: [...item.tags],
      })) ?? [],
  };
};

const captureTodos = (
  input: string,
  state: AgentState,
  actions: AgentAction[],
) => {
  const patterns = [
    /\b(?:todo|task|remember to|remind me to)\s+(.*?)(?:[.?!]|$)/gi,
    /\bI need to\s+(.*?)(?:[.?!]|$)/gi,
  ];
  const sentences = new Set<string>();
  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(input)) !== null) {
      const candidate = match[1].trim();
      if (candidate.length > 2) {
        sentences.add(candidate);
      }
    }
  });

  const addedTitles: string[] = [];
  sentences.forEach((sentence) => {
    const dueDate = chrono.parseDate(sentence, new Date(), {
      forwardDate: true,
    });
    const cleaned = sentence
      .replace(/\bby\s+(.+)$/i, "")
      .replace(/\bon\s+(.+)$/i, "")
      .trim();
    if (!cleaned) {
      return;
    }
    const todo = {
      id: createId(),
      title: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
      done: false,
      due: dueDate ? dueDate.toISOString() : null,
    };
    state.todos = [todo, ...state.todos.filter((item) => item.id !== todo.id)];
    addedTitles.push(todo.title);
  });

  if (addedTitles.length > 0) {
    actions.push({
      id: createId(),
      title: "Captured tasks",
      description: `Added ${addedTitles.length} item${
        addedTitles.length > 1 ? "s" : ""
      } to your list.`,
      source: "task-tracker",
    });
  }
};

const captureNotes = (
  input: string,
  state: AgentState,
  actions: AgentAction[],
) => {
  const notePattern =
    /\b(?:note(?: to self)?|remember this|save this|takeaway)\b[:\-]?\s*(.*)/i;
  const match = input.match(notePattern);
  if (!match || match[1].trim().length === 0) {
    return;
  }
  const content = match[1].trim();
  const title = content.length > 64 ? `${content.slice(0, 61)}…` : content;
  state.notes = [
    {
      id: createId(),
      title,
      content,
      createdAt: new Date().toISOString(),
    },
    ...state.notes,
  ];
  actions.push({
    id: createId(),
    title: "Note captured",
    description: `Saved a note "${title}".`,
    source: "second-brain",
  });
};

const captureReminders = (
  input: string,
  state: AgentState,
  actions: AgentAction[],
) => {
  const reminderPattern =
    /\bremind me(?: to)?\s+(.*?)(?:\s+(?:on|at|by)\s+(.+?))?(?:[.?!]|$)/i;
  const match = input.match(reminderPattern);
  if (!match) {
    return;
  }
  const task = match[1].trim();
  const when = match[2]?.trim() ?? "";
  const reminderDate = chrono.parseDate(
    when.length > 0 ? when : input,
    new Date(),
    { forwardDate: true },
  );
  if (!reminderDate || task.length === 0) {
    return;
  }
  state.reminders = [
    {
      id: createId(),
      title: task.charAt(0).toUpperCase() + task.slice(1),
      remindAt: reminderDate.toISOString(),
    },
    ...state.reminders,
  ];
  actions.push({
    id: createId(),
    title: "Reminder scheduled",
    description: `I'll nudge you about "${task}" around ${reminderDate.toLocaleString()}.`,
    source: "temporal-agent",
  });
};

const captureKnowledge = (
  input: string,
  state: AgentState,
  actions: AgentAction[],
) => {
  if (!/save (?:this|that) to (?:knowledge|library|brain)/i.test(input)) {
    return;
  }
  const cleaned = input.replace(/save (?:this|that) to (?:knowledge|library|brain)/i, "").trim();
  const content = cleaned.length > 0 ? cleaned : input;
  const title =
    content.length > 80
      ? `${content.slice(0, 77)}…`
      : content || "Captured insight";
  state.knowledgeBase = [
    {
      id: createId(),
      title,
      content,
      tags: ["knowledge", "captured"],
      createdAt: new Date().toISOString(),
    },
    ...state.knowledgeBase,
  ];
  actions.push({
    id: createId(),
    title: "Knowledge archived",
    description: `Stored "${title}" in your knowledge base.`,
    source: "memory-core",
  });
};

const runTooling = (message: string, state: AgentState) => {
  const actions: AgentAction[] = [];
  const normalized = message.trim();
  if (!normalized) {
    return { state, actions };
  }

  captureTodos(normalized, state, actions);
  captureReminders(normalized, state, actions);
  captureNotes(normalized, state, actions);
  captureKnowledge(normalized, state, actions);

  return { state, actions };
};

const createFallbackReply = (
  message: string,
  actions: AgentAction[],
  state: AgentState,
) => {
  const hasActions = actions.length > 0;
  const intro = hasActions
    ? "I've taken action on that."
    : "Here's how I interpret your request.";

  const todos = state.todos.filter((todo) => !todo.done);

  const actionLines = actions.map(
    (action) => `• ${action.title}: ${action.description}`,
  );

  const contextLines = [
    hasActions
      ? undefined
      : "I didn't run external reasoning, but you can connect an OpenAI key for richer insights.",
    todos.length > 0
      ? `You now have ${todos.length} open task${todos.length > 1 ? "s" : ""}.`
      : undefined,
  ].filter(Boolean);

  return [
    intro,
    actionLines.join("\n"),
    contextLines.join("\n"),
    message.toLowerCase().includes("thank")
      ? "Happy to help—keep delegating!"
      : "Let me know what you'd like to tackle next.",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
};

const callOpenAI = async ({
  apiKey,
  message,
  history,
  actions,
  state,
}: {
  apiKey: string;
  message: string;
  history: AgentMessage[];
  actions: AgentAction[];
  state: AgentState;
}) => {
  const body = {
    model: "gpt-4o-mini",
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          "You are a proactive personal AI agent. You think in terms of rituals, planning, and stewardship of the user's cognitive load. You have already executed structured actions (tasks, reminders, notes) described in tool_events. Respond succinctly, highlight key next steps, and invite iteration.",
      },
      ...history.slice(-MAX_HISTORY).map((item) => ({
        role: item.role,
        content: item.content,
      })),
      {
        role: "user",
        content: message,
      },
      {
        role: "system",
        content: `tool_events: ${actions
          .map((action) => `${action.title} => ${action.description}`)
          .join("; ") || "none"}. open_todos: ${
          state.todos.filter((todo) => !todo.done).length
        }.`,
      },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI responded with status ${response.status}: ${errorText}`,
    );
  }

  const data = await response.json();
  const reply =
    data?.choices?.[0]?.message?.content ??
    "I processed your request successfully.";
  return reply.trim();
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AgentRequestPayload;
    const message = payload.message?.trim() ?? "";
    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }
    const history = Array.isArray(payload.history)
      ? payload.history.slice(-MAX_HISTORY)
      : [];
    const state = cloneState(payload.state);

    const { state: updatedState, actions } = runTooling(message, state);

    const apiKey = payload.apiKey?.trim();
    let reply: string;

    if (apiKey) {
      try {
        reply = await callOpenAI({
          apiKey,
          message,
          history,
          actions,
          state: updatedState,
        });
      } catch (error) {
        reply = `${
          error instanceof Error ? error.message : "External reasoning failed."
        }\n\n${createFallbackReply(message, actions, updatedState)}`;
      }
    } else {
      reply = createFallbackReply(message, actions, updatedState);
    }

    return NextResponse.json<AgentResponse>({
      reply,
      actions,
      state: updatedState,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while processing agent request.",
      },
      { status: 500 },
    );
  }
}

type AgentResponse = {
  reply: string;
  actions: AgentAction[];
  state: AgentState;
};
