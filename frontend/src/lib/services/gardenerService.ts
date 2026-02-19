import type { Conversation, GardenerResult, GardenerStep, Topic } from "../types";
import { applyGardenerResult, createTopic, getConversationById, getTopics, listMessages } from "../db/repository";
import { dedupeTags, resolveTechTags } from "./tagging";

const MAX_MESSAGE_COUNT = 12;
const MAX_TEXT_LENGTH = 4000;

type ScoredTopic = {
  topic: Topic;
  score: number;
  depth: number;
};

function flattenTopics(topics: Topic[], depth: number = 0): Array<{ topic: Topic; depth: number }> {
  const output: Array<{ topic: Topic; depth: number }> = [];
  for (const topic of topics) {
    output.push({ topic, depth });
    if (topic.children && topic.children.length > 0) {
      output.push(...flattenTopics(topic.children, depth + 1));
    }
  }
  return output;
}

function scoreTopic(topic: Topic, tags: string[], textLower: string): number {
  const nameLower = topic.name.toLowerCase();
  let score = 0;
  if (nameLower && textLower.includes(nameLower)) {
    score += 2;
  }
  const tagHit = tags.some((tag) => {
    const tagLower = tag.toLowerCase();
    return nameLower.includes(tagLower) || tagLower.includes(nameLower);
  });
  if (tagHit) {
    score += 1;
  }
  return score;
}

function selectBestTopic(scored: ScoredTopic[]): ScoredTopic | null {
  let best: ScoredTopic | null = null;
  for (const candidate of scored) {
    if (candidate.score <= 0) continue;
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.score > best.score) {
      best = candidate;
      continue;
    }
    if (candidate.score === best.score) {
      if (candidate.depth > best.depth) {
        best = candidate;
        continue;
      }
      if (candidate.depth === best.depth) {
        if (candidate.topic.name.localeCompare(best.topic.name) < 0) {
          best = candidate;
        }
      }
    }
  }
  return best;
}

function buildConversationText(conversation: Conversation, messageTexts: string[]): string {
  const chunks = [conversation.title, conversation.snippet, ...messageTexts];
  const combined = chunks.filter(Boolean).join("\n");
  if (combined.length <= MAX_TEXT_LENGTH) return combined;
  return combined.slice(0, MAX_TEXT_LENGTH);
}

export async function runGardener(conversationId: number): Promise<{
  updated: boolean;
  conversation: Conversation;
  result: GardenerResult;
}> {
  const conversation = await getConversationById(conversationId);
  if (!conversation) {
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  const messages = await listMessages(conversationId);
  const messageTexts = messages
    .slice(0, MAX_MESSAGE_COUNT)
    .map((message) => message.content_text)
    .filter(Boolean);

  const text = buildConversationText(conversation, messageTexts);
  const tags = resolveTechTags([], text);

  const topicsTree = await getTopics();
  const flattened = flattenTopics(topicsTree);

  let matchedTopic: Topic | undefined;
  let createdTopic: Topic | undefined;

  if (conversation.topic_id !== null) {
    matchedTopic = flattened.find((item) => item.topic.id === conversation.topic_id)?.topic;
  } else {
    const scored = flattened.map((item) => ({
      topic: item.topic,
      depth: item.depth,
      score: scoreTopic(item.topic, tags, text.toLowerCase()),
    }));
    const best = selectBestTopic(scored);
    if (best) {
      matchedTopic = best.topic;
    } else if (tags.length > 0) {
      const normalized = tags[0].trim().toLowerCase();
      const existing = flattened.find(
        (item) => item.topic.name.trim().toLowerCase() === normalized
      );
      if (existing) {
        matchedTopic = existing.topic;
      } else {
        createdTopic = await createTopic({ name: tags[0], parent_id: null });
        matchedTopic = createdTopic;
      }
    }
  }

  const applyResult = await applyGardenerResult(conversationId, {
    topic_id: matchedTopic?.id ?? null,
    tags: dedupeTags(tags),
  });

  const steps: GardenerStep[] = [
    {
      step: "Reading Conversation",
      status: "completed",
      details: `${messages.length} messages`,
    },
    {
      step: "Extracting Tags",
      status: "completed",
      details: applyResult.conversation.tags.join(", ") || "General",
    },
    {
      step: "Matching Topic",
      status: "completed",
      details: matchedTopic ? matchedTopic.name : "No match",
    },
    {
      step: "Writing Results",
      status: "completed",
      details: applyResult.updated ? "Conversation updated" : "No changes",
    },
  ];

  return {
    updated: applyResult.updated,
    conversation: applyResult.conversation,
    result: {
      tags: applyResult.conversation.tags,
      matchedTopic,
      createdTopic,
      steps,
    },
  };
}
