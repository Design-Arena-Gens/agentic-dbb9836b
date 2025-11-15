"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, RefreshCcw, Save, Sparkles, Unplug } from "lucide-react";
import Link from "next/link";
import {
  type AgentAction,
  type AgentMessage,
  type AgentState,
  createDefaultAgentState,
} from "@/lib/agent/types";
import { createId } from "@/lib/utils";

type AgentResponse = {
  reply: string;
  actions?: AgentAction[];
  state: AgentState;
};

const STORAGE_KEYS = {
  messages: "agentic-messages",
  state: "agentic-state",
  apiKey: "agentic-openai-key",
  apiKeyConsent: "agentic-openai-key-consent",
};

const quickPrompts = [
  {
    title: "Plan my day",
    content:
      "Create a concise daily plan that balances focus work, breaks, and creative time. Prioritize deep work in the morning.",
  },
  {
    title: "Summarize notes",
    content:
      "Summarize my latest notes and extract actionable tasks with deadlines where possible.",
  },
  {
    title: "Generate workout",
    content:
      "Create a 30 minute body-weight workout plan that fits into a busy schedule.",
  },
  {
    title: "Learn new topic",
    content:
      "Teach me the basics of prompting strategies for AI agents and give practical examples.",
  },
];

function createSystemMessage(): AgentMessage {
  return {
    id: createId(),
    role: "assistant",
    createdAt: new Date().toISOString(),
    content:
      "👋 I'm your personal agent. Ask me to plan, prioritize, keep notes, or generate ideas. Provide an OpenAI API key for advanced reasoning.",
  };
}

const MessageBubble = ({
  message,
}: {
  message: AgentMessage;
}) => {
  const isUser = message.role === "user";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className={`flex w-full gap-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-sm font-semibold text-neutral-900">
          AI
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-3xl px-5 py-4 text-sm leading-relaxed shadow-md ${
          isUser
            ? "bg-cyan-500 text-neutral-900"
            : "bg-neutral-900/60 text-neutral-200"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        {message.actions && message.actions.length > 0 && (
          <div className="mt-4 space-y-2">
            {message.actions.map((action) => (
              <div
                key={action.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/80 px-4 py-3 text-xs text-neutral-400"
              >
                <div className="font-semibold text-neutral-200">
                  {action.title}
                </div>
                <div>{action.description}</div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  via {action.source}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {isUser && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-neutral-300">
          You
        </div>
      )}
    </motion.div>
  );
};

const ToolGroup = ({
  state,
  onToggleTodo,
  onDeleteTodo,
}: {
  state: AgentState;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
}) => {
  return (
    <div className="space-y-8">
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Tasks
          </h2>
          <span className="text-xs text-neutral-500">
            {state.todos.filter((todo) => !todo.done).length} open
          </span>
        </header>
        <div className="space-y-2">
          {state.todos.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-800 px-4 py-6 text-xs text-neutral-500">
              Ask the agent to capture todos and they will show up here.
            </p>
          ) : (
            state.todos.map((todo) => (
              <div
                key={todo.id}
                className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 px-4 py-3"
              >
                <button
                  className={`mt-0.5 h-5 w-5 flex-none rounded-full border ${
                    todo.done
                      ? "border-cyan-400 bg-cyan-500"
                      : "border-neutral-700"
                  }`}
                  onClick={() => onToggleTodo(todo.id)}
                  aria-label="Toggle todo"
                />
                <div className="flex-1 text-sm">
                  <div
                    className={`font-medium text-neutral-200 ${
                      todo.done ? "line-through opacity-60" : ""
                    }`}
                  >
                    {todo.title}
                  </div>
                  {todo.due && (
                    <div className="text-xs text-neutral-500">
                      Due {new Date(todo.due).toLocaleString()}
                    </div>
                  )}
                </div>
                <button
                  className="text-xs text-neutral-500 transition hover:text-red-300"
                  onClick={() => onDeleteTodo(todo.id)}
                  aria-label="Delete todo"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </section>
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Notes
          </h2>
          <span className="text-xs text-neutral-500">
            {state.notes.length} stored
          </span>
        </header>
        <div className="space-y-3">
          {state.notes.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-800 px-4 py-6 text-xs text-neutral-500">
              Let the agent know when something is important and it becomes a
              note.
            </p>
          ) : (
            state.notes.map((note) => (
              <article
                key={note.id}
                className="rounded-3xl border border-neutral-800 bg-neutral-900/40 px-4 py-4"
              >
                <div className="text-xs uppercase tracking-wide text-neutral-500">
                  {new Date(note.createdAt).toLocaleString()}
                </div>
                <h3 className="mt-2 text-sm font-semibold text-neutral-100">
                  {note.title}
                </h3>
                <p className="mt-2 text-sm text-neutral-300">{note.content}</p>
              </article>
            ))
          )}
        </div>
      </section>
      <section>
        <header className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Reminders
          </h2>
        </header>
        <div className="space-y-3">
          {state.reminders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-neutral-800 px-4 py-6 text-xs text-neutral-500">
              Ask for time-based reminders to keep them on your radar.
            </p>
          ) : (
            state.reminders.map((reminder) => (
              <div
                key={reminder.id}
                className="rounded-3xl border border-neutral-800 bg-neutral-900/40 px-4 py-4 text-sm"
              >
                <div className="font-semibold text-neutral-200">
                  {reminder.title}
                </div>
                <div className="mt-1 text-xs text-neutral-500">
                  {new Date(reminder.remindAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

const QuickPromptButton = ({
  title,
  content,
  onClick,
}: {
  title: string;
  content: string;
  onClick: (prompt: string) => void;
}) => (
  <button
    onClick={() => onClick(content)}
    className="flex items-center justify-between rounded-3xl border border-neutral-800 bg-neutral-900/50 px-5 py-3 text-left text-sm text-neutral-300 transition hover:border-neutral-700 hover:bg-neutral-900/70"
  >
    <div>
      <div className="font-medium text-neutral-100">{title}</div>
      <div className="text-xs text-neutral-500">{content}</div>
    </div>
    <ArrowUpRight className="h-4 w-4 text-neutral-500" />
  </button>
);

const ChatInput = ({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (value: string) => void;
}) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    onSubmit(trimmed);
    setValue("");
    inputRef.current?.focus();
  }, [onSubmit, value]);

  return (
    <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-xl shadow-cyan-500/10">
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSubmit();
          }
        }}
        placeholder="Ask for help, planning, or analysis…"
        className="h-28 w-full resize-none rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-3 text-sm text-neutral-100 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40"
      />
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          Press Enter to send, Shift+Enter for newline
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="flex items-center gap-2 rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-neutral-900 transition enabled:hover:bg-cyan-400 disabled:opacity-40"
        >
          Send
          <ArrowUpRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

const loadStoredValue = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) {
      return fallback;
    }
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
};

const storeValue = <T,>(key: string, value: T) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
};

const storePlainValue = (key: string, value: string) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, value);
};

const loadPlainValue = (key: string): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(key);
};

export default function AgentApp() {
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
    if (typeof window === "undefined") {
      return [createSystemMessage()];
    }
    const stored = loadStoredValue<AgentMessage[] | null>(
      STORAGE_KEYS.messages,
      null,
    );
    if (!stored || stored.length === 0) {
      return [createSystemMessage()];
    }
    return stored;
  });

  const [agentState, setAgentState] = useState<AgentState>(() =>
    loadStoredValue<AgentState>(
      STORAGE_KEYS.state,
      createDefaultAgentState(),
    ),
  );

  const [apiKey, setApiKey] = useState<string>(() => {
    const consent = loadPlainValue(STORAGE_KEYS.apiKeyConsent);
    if (consent !== "true") {
      return "";
    }
    return loadPlainValue(STORAGE_KEYS.apiKey) ?? "";
  });

  const [isPersistingKey, setIsPersistingKey] = useState<boolean>(() => {
    return loadPlainValue(STORAGE_KEYS.apiKeyConsent) === "true";
  });

  const [isThinking, setIsThinking] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    storeValue(STORAGE_KEYS.messages, messages);
  }, [messages]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    storeValue(STORAGE_KEYS.state, agentState);
  }, [agentState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    storePlainValue(STORAGE_KEYS.apiKeyConsent, isPersistingKey ? "true" : "");
    if (isPersistingKey) {
      storePlainValue(STORAGE_KEYS.apiKey, apiKey);
    } else {
      storePlainValue(STORAGE_KEYS.apiKey, "");
    }
  }, [apiKey, isPersistingKey]);

  useEffect(() => {
    if (!scrollerRef.current) {
      return;
    }
    scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
  }, [messages, isThinking]);

  const resetConversation = useCallback(() => {
    setMessages([createSystemMessage()]);
    setAgentState(createDefaultAgentState());
  }, []);

  const toggleTodo = useCallback((id: string) => {
    setAgentState((current) => ({
      ...current,
      todos: current.todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    }));
  }, []);

  const deleteTodo = useCallback((id: string) => {
    setAgentState((current) => ({
      ...current,
      todos: current.todos.filter((todo) => todo.id !== id),
    }));
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const newMessage: AgentMessage = {
        id: createId(),
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, newMessage]);
      setIsThinking(true);
      try {
        const response = await fetch("/api/agent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: content,
            history: [...messages, newMessage],
            state: agentState,
            apiKey: apiKey.trim() || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to reach agent");
        }

        const data: AgentResponse = await response.json();
        const assistantMessage: AgentMessage = {
          id: createId(),
          role: "assistant",
          createdAt: new Date().toISOString(),
          content: data.reply,
          actions: data.actions,
        };

        setMessages((current) => [...current, assistantMessage]);
        setAgentState(data.state);
      } catch (error) {
        const assistantMessage: AgentMessage = {
          id: createId(),
          role: "assistant",
          createdAt: new Date().toISOString(),
          content:
            error instanceof Error
              ? `I ran into a connection issue: ${error.message}.`
              : "I could not reach my reasoning engine. Try again shortly.",
        };
        setMessages((current) => [...current, assistantMessage]);
      } finally {
        setIsThinking(false);
      }
    },
    [agentState, apiKey, messages],
  );

  const quickStartMessage = useMemo(
    () => messages.length === 1,
    [messages.length],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pb-20 pt-20 font-sans md:px-10">
      <header className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] text-neutral-500">
            <span className="flex h-2 w-2 items-center justify-center rounded-full bg-cyan-400" />
            Personal AI Agent
          </div>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-100 md:text-4xl">
            Build rituals, automate thinking, stay on track.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-neutral-400 md:text-base">
            Delegate planning, note-taking, and prioritization. The agent keeps
            context, updates your task list, and synthesizes insights across
            conversations.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-3xl border border-neutral-800 bg-neutral-900/40 p-4 text-xs text-neutral-400 md:w-80">
          <div className="flex items-center gap-2 text-neutral-200">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            Optional: OpenAI API Key
          </div>
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="sk-..."
            className="rounded-2xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/40"
          />
          <label className="flex items-center gap-2 text-neutral-500">
            <input
              type="checkbox"
              checked={isPersistingKey}
              onChange={(event) => setIsPersistingKey(event.target.checked)}
              className="h-4 w-4 rounded border border-neutral-700 bg-neutral-900 checked:bg-cyan-500"
            />
            Store locally on this device
          </label>
          <div className="flex items-center gap-2 text-neutral-500">
            <Unplug className="h-4 w-4" />
            No key? Basic reasoning and tools still work.
          </div>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[3fr_2fr]">
        <section className="flex h-[calc(100vh-15rem)] flex-col rounded-3xl border border-neutral-900 bg-neutral-950/80 p-6 shadow-[0_30px_120px_-40px_rgba(45,212,191,0.45)]">
          <div
            ref={scrollerRef}
            className="flex-1 space-y-6 overflow-y-auto pr-2"
          >
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </AnimatePresence>
            {isThinking && (
              <div className="flex items-center gap-3 text-sm text-neutral-500">
                <div className="h-2 w-2 animate-ping rounded-full bg-cyan-400" />
                Thinking…
              </div>
            )}
          </div>
          <div className="mt-6 space-y-4">
            {quickStartMessage && (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {quickPrompts.map((prompt) => (
                  <QuickPromptButton
                    key={prompt.title}
                    title={prompt.title}
                    content={prompt.content}
                    onClick={sendMessage}
                  />
                ))}
              </div>
            )}
            <ChatInput disabled={isThinking} onSubmit={sendMessage} />
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <button
                onClick={resetConversation}
                className="flex items-center gap-2 rounded-full border border-neutral-800 px-4 py-2 transition hover:border-neutral-600 hover:text-neutral-300"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Reset session
              </button>
              <Link
                href="https://github.com"
                target="_blank"
                className="flex items-center gap-2 rounded-full border border-neutral-800 px-4 py-2 transition hover:border-neutral-600 hover:text-neutral-300"
              >
                <Save className="h-3.5 w-3.5" />
                Export coming soon
              </Link>
            </div>
          </div>
        </section>
        <aside className="flex h-[calc(100vh-15rem)] flex-col gap-6 rounded-3xl border border-neutral-900 bg-neutral-950/80 p-6">
          <div className="rounded-3xl border border-neutral-900 bg-gradient-to-br from-cyan-500/10 via-neutral-900/60 to-neutral-900/80 p-6">
            <h2 className="text-lg font-semibold text-neutral-100">
              Agent Dashboard
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              The agent keeps structured state across conversations. You can
              adjust items here if needed.
            </p>
          </div>
          <ToolGroup
            state={agentState}
            onToggleTodo={toggleTodo}
            onDeleteTodo={deleteTodo}
          />
        </aside>
      </div>
    </main>
  );
}
