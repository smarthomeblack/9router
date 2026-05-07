/**
 * OpenAI → CommandCode request translator
 *
 * CommandCode endpoint expects an envelope:
 *   { threadId, memory, config, params: { model, messages, stream, max_tokens, temperature, tools? } }
 * where `params.messages` are Anthropic-style content blocks ([{type:"text", text}, ...]).
 *
 * The model id received here is the upstream id (e.g. "deepseek/deepseek-v4-pro") thanks to the
 * `provider/model` registration in providerModels.js.
 */
import { register } from "../index.js";
import { FORMATS } from "../formats.js";
import { randomUUID } from "crypto";

function toContentBlocks(content) {
  if (content == null) return [{ type: "text", text: "" }];
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (Array.isArray(content)) {
    const blocks = [];
    for (const part of content) {
      if (typeof part === "string") {
        blocks.push({ type: "text", text: part });
      } else if (part && typeof part === "object") {
        if (part.type === "text" && typeof part.text === "string") {
          blocks.push({ type: "text", text: part.text });
        } else if (part.type === "image_url" || part.type === "image") {
          // CommandCode currently rejects multimodal blocks via this gateway;
          // collapse to a textual placeholder so the request still validates.
          blocks.push({ type: "text", text: "[image omitted]" });
        } else if (typeof part.text === "string") {
          blocks.push({ type: "text", text: part.text });
        }
      }
    }
    return blocks.length ? blocks : [{ type: "text", text: "" }];
  }
  return [{ type: "text", text: String(content) }];
}

function convertMessages(messages = []) {
  return messages.map((m) => {
    const role = m.role === "tool" ? "user" : (m.role || "user");
    return { role, content: toContentBlocks(m.content) };
  });
}

export function openaiToCommandCode(model, body, stream /* , credentials */) {
  const params = {
    model,
    messages: convertMessages(body.messages),
    stream: stream !== false,
    max_tokens: body.max_tokens ?? body.max_output_tokens ?? 64000,
    temperature: body.temperature ?? 0.3,
  };

  if (Array.isArray(body.tools) && body.tools.length > 0) {
    params.tools = body.tools;
  }
  if (body.top_p != null) params.top_p = body.top_p;

  const today = new Date().toISOString().slice(0, 10);

  return {
    threadId: randomUUID(),
    memory: "",
    config: {
      workingDir: process.cwd(),
      date: today,
      environment: process.platform,
      structure: [],
      isGitRepo: false,
      currentBranch: "",
      mainBranch: "",
      gitStatus: "",
      recentCommits: [],
    },
    params,
  };
}

register(FORMATS.OPENAI, FORMATS.COMMANDCODE, openaiToCommandCode, null);
