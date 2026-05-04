
```javascript
import Anthropic from "@anthropic-ai/sdk";
import * as readline from "readline";

const client = new Anthropic();

interface Vote {
  option: string;
  voter: string;
  timestamp: Date;
}

interface VotingSession {
  id: string;
  title: string;
  options: string[];
  votes: Vote[];
  active: boolean;
  createdAt: Date;
}

// Store voting sessions
const sessions: Map<string, VotingSession> = new Map();

// Helper function to create readline interface
function createReadlineInterface(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Helper function to get user input
function getUserInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createReadlineInterface();
    rl.question(prompt, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Create a new voting session
function createSession(
  title: string,
  options: string[]
): VotingSession {
  const id = Date.now().toString();
  const session: VotingSession = {
    id,
    title,
    options,
    votes: [],
    active: true,
    createdAt: new Date(),
  };
  sessions.set(id, session);
  return session;
}

// Get session by ID
function getSession(id: string): VotingSession | undefined {
  return sessions.get(id);
}

// Cast a vote
function castVote(
  sessionId: string,
  option: string,
  voter: string
): boolean {
  const session = getSession(sessionId);
  if (!session) {
    return false;
  }

  if (!session.active) {
    return false;
  }

  if (!session.options.includes(option)) {
    return false;
  }

  // Check if voter already voted
  if (session.votes.some((v) => v.voter === voter)) {
    return false;
  }

  session.votes.push({
    option,
    voter,
    timestamp: new Date(),
  });

  return true;
}

// Get voting results
function getResults(sessionId: string): Map<string, number> | null {
  const session = getSession(sessionId);
  if (!session) {
    return null;
  }

  const results = new Map<string, number>();

  // Initialize all options with 0
  for (const option of session.options) {
    results.set(option, 0);
  }

  // Count votes
  for (const vote of session.votes) {
    const current = results.get(vote.option) || 0;
    results.set(vote.option, current + 1);
  }

  return results;
}

// Close a voting session
function closeSession(sessionId: string): boolean {
  const session = getSession(sessionId);
  if (!session) {
    return false;
  }
  session.active = false;
  return true;
}

// Format results for display
function formatResults(sessionId: string): string {
  const session = getSession(sessionId);
  if (!session) {
    return "Session not found";
  }

  const results = getResults(sessionId);
  if (!results) {
    return "Could not get results";
  }

  let output = `\n=== Voting Results for: ${session.title} ===\n`;
  output += `Status: ${session.active ? "Active" : "Closed"}\n`;
  output += `Total votes: ${session.votes.length}\n\n`;

  const sortedResults = Array.from(results.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  let maxVotes = 0;
  if (sortedResults.length > 0) {
    maxVotes = sortedResults[0][1];
  }

  for (const [option, count] of sortedResults) {
    const percentage =
      session.votes.length > 0
        ? ((count / session.votes.length) * 100).toFixed(1)
        : "0.0";
    const barLength = Math.ceil((count / Math.max(maxVotes, 1)) * 20);
    const bar = "█".repeat(barLength) + "░".repeat(20 - barLength);
    output += `${option}: ${count} votes (${percentage}%) ${bar}\n`;
  }

  return output;
}

// Main conversation with Claude
async function main() {
  console.log("🗳️  Welcome to the Simple Voting System with Claude!");
  console.log("Chat with Claude about voting or create/manage voting sessions.\n");

  const conversationHistory: Array<{
    role: "user" | "assistant";
    content: string;
  }> = [];

  const systemPrompt = `You are a helpful voting system assistant. You help users create voting sessions, cast votes, and view results.

Available commands that you can suggest to users:
- CREATE: Create a new voting session (e.g., "CREATE: What's your favorite color? | Red, Blue, Green")
- VOTE: Cast a vote (e.g., "VOTE: [sessionId]: [option]: [voter]")
- RESULTS: Get voting results (e.g., "RESULTS: [sessionId]")
- CLOSE: Close a voting session (e.g., "CLOSE: [sessionId]")
- LIST: List all voting sessions

When a user wants to perform an action, extract the command and parameters, then tell them you'll execute it.
Be conversational and helpful. Explain voting concepts when needed.

Current voting sessions:
${sessions.size > 0 ? Array.from(sessions.values()).map((s) => `- ${s.id}: ${s.title} (${s.votes.length} votes, ${s.active ? "active" : "closed"})`).join("\n") : "None yet"}`;

  while (true) {
    