# AmroGen Platform

A multi-tenant B2B sales automation SaaS powered by **Anthropic Managed Agents**. Give it a company URL — it discovers real leads, enriches them, and generates hyper-personalised multi-channel outreach sequences (email, LinkedIn, SMS) using a team of six specialised AI agents.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [The Agent System — Deep Dive](#the-agent-system--deep-dive)
   - [What Are Anthropic Managed Agents?](#what-are-anthropic-managed-agents)
   - [Agent 1 — Lead Generator](#agent-1--lead-generator)
   - [Agent 2 — Campaign Orchestrator](#agent-2--campaign-orchestrator)
   - [Agent 3 — Outreach Sequence Agent](#agent-3--outreach-sequence-agent)
   - [Agent 4 — Email Specialist Agent](#agent-4--email-specialist-agent)
   - [Agent 5 — SMS Specialist Agent](#agent-5--sms-specialist-agent)
   - [Agent 6 — Reply Monitor Agent](#agent-6--reply-monitor-agent)
   - [Quality Review Loop](#quality-review-loop)
4. [Creating Agents in the Anthropic Console — Step by Step](#creating-agents-in-the-anthropic-console--step-by-step)
   - [Agent System Prompts](#agent-system-prompts)
5. [Database Schema](#database-schema)
6. [Local Development Setup](#local-development-setup)
7. [Environment Variables Reference](#environment-variables-reference)
8. [API Reference](#api-reference)
9. [Campaign Pipeline — End to End](#campaign-pipeline--end-to-end)
10. [Credits System](#credits-system)
11. [Gmail Integration](#gmail-integration)
12. [MCP Server](#mcp-server)
13. [Deployment](#deployment)

---

## Architecture Overview

```
Browser (Next.js 14)
       │
       ▼
FastAPI Backend (Python 3.11)
       │
       ├── Celery Worker ──► Lead Generator Agent  (Anthropic Managed Agent)
       │                 ├── Orchestrator Agent    (Anthropic Managed Agent)
       │                 ├── Outreach Agent        (Anthropic Managed Agent)
       │                 ├── Email Agent           (Anthropic Managed Agent)
       │                 ├── SMS Agent             (Anthropic Managed Agent)
       │                 └── Reply Monitor Agent   (Anthropic Managed Agent)
       │
       ├── PostgreSQL (Neon) — campaigns, leads, sequences, users, credits
       ├── Redis — Celery broker + SSE pub/sub
       └── Google Cloud Storage — leads CSV, sequences JSON, reports

MCP Server (FastMCP) — AI builder integration via Claude Desktop / API
```

**Pipeline flow:**
```
User submits URL  →  Celery task queued
                  →  Lead Generator Agent runs (20+ min) → saves leads to DB
                  →  Orchestrator Agent plans channels per lead
                  →  Specialist agents write sequences (with quality review loop)
                  →  Sequences saved to DB → status = "review"
                  →  User reviews & approves in UI
                  →  Celery Beat dispatches email steps via Gmail API
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router) + Tailwind CSS + shadcn/ui |
| Backend API | FastAPI (Python 3.11) + SQLAlchemy async |
| Pipeline Worker | Celery + Redis |
| MCP Server | FastMCP |
| Database | PostgreSQL (Neon recommended) |
| Queue / Cache | Redis |
| File Storage | Google Cloud Storage |
| Auth | Custom JWT + API keys |
| Payments | Stripe |
| AI Agents | Anthropic Managed Agents (claude-opus-4-8) |
| Email Sending | Gmail API (OAuth 2.0) |
| Token Encryption | Fernet (AES-128) / GCP KMS (production) |

---

## The Agent System — Deep Dive

### What Are Anthropic Managed Agents?

Anthropic Managed Agents are **persistent, versioned agent configurations** hosted by Anthropic. Unlike a plain API call, a Managed Agent:

- Has a **permanent identity** (`agent_id`) that you create once in the Anthropic Console and reference forever
- Runs in a **sandboxed environment** (`environment_id`) that can include tools like web search, code execution, file access, and custom MCP tools
- Communicates via **SSE streaming sessions** — you create a session, stream events in real time, and the agent runs as long as needed (up to ~20+ minutes)
- Stores its **system prompt, tools, and skills** in a versioned config — no need to embed them in your code

**SDK pattern used in this codebase:**

```python
import anthropic

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

# 1. Create a session tied to your agent + environment
session = client.beta.sessions.create(
    agent={"type": "agent", "id": AGENT_ID, "version": AGENT_VERSION},
    environment_id=ENV_ID,
    extra_body={"vault_ids": VAULT_IDS, "title": "Session title"},
)

# 2. Stream events and send the user message
with client.beta.sessions.events.stream(session_id=session.id) as stream:
    client.beta.sessions.events.send(
        session_id=session.id,
        events=[{"type": "user.message", "content": [{"type": "text", "text": prompt}]}],
    )
    for event in stream:
        if event.type == "agent.message":
            for block in event.content:
                if block.type == "text":
                    full_text += block.text
        elif event.type == "session.status_idle":
            break  # agent finished
        elif event.type == "session.status_terminated":
            break
```

Each agent in this platform is created **once** in the console. The IDs are stored in `.env` and never change.

---

### Agent 1 — Lead Generator

**File:** `backend/agents/lead_generator.py`
**Purpose:** Visits a target company URL and discovers real, verified B2B leads with contact information.

**What it does:**
- Browses the target company's website, LinkedIn, and public data sources
- Identifies decision-makers matching B2B ICP (Ideal Customer Profile) criteria
- Enriches each lead with: name, title, company, email, phone, LinkedIn URL, location, ICP fit score
- Outputs a structured report + a CSV of all leads
- Runs for 15–25 minutes (real web browsing + research)

**Prompt sent per run:**
```
Analyse {url} and generate a leads report with exactly {num_leads} verified leads.

IMPORTANT: At the very end of your response you MUST output all leads as a fenced CSV
code block using triple backticks with the 'csv' language tag, like this:

```csv
Name,Title,Company,Email,Phone,LinkedIn,Location,ICP_Fit_Score
Jane Smith,Head of Content,Acme Ltd,jane@acme.com,+44 20 7946 0000,https://linkedin.com/in/janesmith,London UK,High
```

Use exactly these column names: Name, Title, Company, Email, Phone, LinkedIn,
Location, ICP_Fit_Score. The fenced CSV block is REQUIRED for the platform to save the leads.
```

**CSV extraction logic** (`_extract_leads`): 4-stage fallback parser:
1. Fenced ` ```csv ``` ` block (primary)
2. Any fenced block whose first line has ≥3 comma-separated values
3. Unfenced "Final CSV Output" / "CSV Data" section
4. Raw header line detection (`Name,Title,...`)

**Field normalisation** (`_FIELD_MAP`): Maps agent-style field names to DB column names:
```python
{
    "full_name": "Name",
    "current_title": "Title",
    "current_company": "Company",
    "linkedin_url": "LinkedIn",
    "confidence_score": "ICP_Fit_Score",
    "mobile": "Phone",
}
```

**Required console config:**
- Web search tool enabled
- Browser/computer use tool enabled (to visit URLs)
- Vault with Anthropic API key (for sub-calls if needed)

---

### Agent 2 — Campaign Orchestrator

**File:** `backend/agents/orchestrator.py`
**Purpose:** Analyses all leads and produces a campaign plan — which specialist agent to use for each lead and what messaging angle to take.

**What it does:**
- Receives the full lead list as a CSV + seller context (the research report from Agent 1)
- Analyses each lead's role, industry, available contact channels
- Decides: should this lead get email-only? LinkedIn + email? SMS? All channels?
- Returns a JSON plan array

**Prompt sent per run:**
```
SELLER CONTEXT:
{seller_context[:3000]}

LEADS ({N} total):
```csv
Name,Title,Company,...
...
```

Analyse every lead and produce the campaign plan JSON as per your instructions.
```

**Expected JSON output:**
```json
[
  {
    "lead_name": "Jane Smith",
    "agents_to_invoke": ["outreach_agent", "email_agent"],
    "messaging_angle": "Focus on their recent Series B funding — position our tool as essential for scaling their SDR team.",
    "priority": "high"
  },
  {
    "lead_name": "Bob Jones",
    "agents_to_invoke": ["sms_agent"],
    "messaging_angle": "Mobile-first exec — keep it short and direct.",
    "priority": "medium"
  }
]
```

**`segregate_leads()` function:** Routes each lead to the right specialist agents based on the plan. Returns `{"email": [...], "sms": [...], "outreach": [...]}`.

**Required console config:**
- No web tools needed (pure reasoning on provided data)
- System prompt defines the JSON output format strictly

---

### Agent 3 — Outreach Sequence Agent

**File:** `backend/agents/outreach_agent.py`
**Purpose:** The primary multi-channel outreach agent. Generates personalised sequences combining LinkedIn, email, and phone steps.

**What it does:**
- Receives leads in batches (default batch size: 5)
- For each lead: determines available channels from CSV data (has email? has phone? has LinkedIn?)
- Generates a 5–7 step sequence mixing LinkedIn connection requests, emails, and follow-ups
- Each step has: day number, channel, message type, subject (for email), and full message content

**Prompt sent per batch:**
```
SELLER CONTEXT (from research on the seller's website):
{seller_context[:3000]}

LEADS DATA (batch {N}/{total}, {count} lead(s)):
```csv
Name,Title,Company,Email,Phone,LinkedIn,Location,ICP_Fit_Score
...
```

Analyse each lead, determine their available contact channels from the CSV data,
and generate a hyper-personalised outreach sequence for every lead.
Return a JSON array as per your instructions.
```

**Expected JSON output per lead:**
```json
[
  {
    "lead_name": "Jane Smith",
    "title": "Head of Content",
    "company": "Acme Ltd",
    "channels": ["linkedin", "email"],
    "personalisation_note": "Referenced her recent blog post on AI content tools",
    "sequence": [
      {
        "step": 1,
        "day": 1,
        "channel": "linkedin",
        "type": "connection_request",
        "content": "Hi Jane, saw your post on AI content scaling — we're helping teams like yours cut research time by 60%. Worth a quick connect?"
      },
      {
        "step": 2,
        "day": 3,
        "channel": "email",
        "type": "intro",
        "subject": "Content at scale — quick idea for Acme",
        "content": "Hi Jane,\n\nFollowing up after connecting on LinkedIn..."
      }
    ]
  }
]
```

**Required console config:**
- System prompt must define the exact JSON schema above
- No external tools needed (pure generation from provided lead data)

---

### Agent 4 — Email Specialist Agent

**File:** `backend/agents/email_agent.py`
**Purpose:** Generates deep 5-step email nurture sequences. Used for leads the Orchestrator routes to email-only or email-primary.

**What it does:**
- Receives email-focused leads in batches
- Generates 5 emails per lead spread across days 1, 4, 8, 14, 21
- Emails are longer and more detailed than outreach agent emails
- Includes subject lines, personalised openers, value propositions, CTAs

**Prompt sent per batch:**
```
SELLER CONTEXT:
{seller_context[:3000]}

LEADS (batch {N}/{total}, {count} leads):
```csv
...
```

Generate a 5-step email sequence for every lead.
Return pure JSON array as per your instructions.
```

**Expected JSON output per lead:**
```json
{
  "lead_name": "Jane Smith",
  "company": "Acme Ltd",
  "personalisation_note": "Opened with their expansion into APAC markets",
  "sequence": [
    {
      "step": 1,
      "day": 1,
      "channel": "email",
      "type": "intro",
      "subject": "APAC expansion + content ops — quick idea",
      "content": "Hi Jane,\n\nNoticed Acme just announced..."
    },
    {
      "step": 2,
      "day": 4,
      "channel": "email",
      "type": "follow_up",
      "subject": "Re: APAC expansion + content ops — quick idea",
      "content": "Hi Jane,\n\nJust checking if my note landed..."
    }
  ]
}
```

**Required console config:**
- System prompt defines 5-step email cadence rules
- Day spacing: 1, 4, 8, 14, 21
- Max email length guidance
- Personalisation depth requirements

---

### Agent 5 — SMS Specialist Agent

**File:** `backend/agents/sms_agent.py`
**Purpose:** Generates 3-step SMS sequences for leads with phone numbers. Strictly enforces 160-character limit per message.

**What it does:**
- **Automatically filters** leads — only processes leads where `Phone`/`Mobile` field is non-empty and not "N/A"
- Generates 3 SMS messages per lead on days 1, 5, 12
- Every message is validated to ≤160 characters after generation
- Character count is stored per step: `actual_char_count`, `within_limit`

**Prompt sent per batch:**
```
SELLER CONTEXT:
{seller_context[:2000]}

LEADS WITH PHONE NUMBERS (batch {N}/{total}, {count} leads):
```csv
...
```

Generate a 3-step SMS sequence for every lead.
CRITICAL: Every SMS must be 160 characters or fewer.
Return pure JSON array as per your instructions.
```

**Expected JSON output per lead:**
```json
{
  "lead_name": "Bob Jones",
  "company": "TechCorp",
  "sequence": [
    {
      "step": 1,
      "day": 1,
      "channel": "sms",
      "type": "intro",
      "content": "Hi Bob, [Seller Name] here. Helping RevOps teams cut pipeline time 40%. Worth 10 mins? Reply YES"
    }
  ]
}
```

**Character validation** (`_validate_char_limits`): Run after parsing — adds `actual_char_count` and `within_limit: true/false` to every step. Messages over 160 chars are flagged (not blocked — the quality review loop will reject and retry).

**Required console config:**
- System prompt must explicitly state 160-char SMS limit
- 3-step cadence: introduction, follow-up, close
- Direct CTA at end of every message

---

### Agent 6 — Reply Monitor Agent

**File:** `backend/agents/reply_monitor.py`
**Purpose:** Classifies incoming replies from leads and recommends what to do next (reply, pause, stop, book meeting, etc.).

**What it does:**
- Receives an incoming reply (email or LinkedIn message) from a lead
- Also receives the original outreach message for context
- Classifies intent: interested, not_interested, out_of_office, unsubscribe, question, meeting_request, referral
- Scores sentiment (1–10)
- Recommends next action: `continue_sequence`, `pause_30_days`, `pause_sequence`, `stop_sequence`, `book_meeting`, `send_suggested_response`
- Optionally drafts a suggested response

**Prompt sent per reply:**
```
SELLER CONTEXT:
{seller_context[:1500]}

ORIGINAL OUTREACH SENT:
{original_outreach[:1000]}

INCOMING REPLY:
Lead: {lead_name} at {company}
Channel: {reply_channel}
Reply:
{reply_text}

Analyse this reply and return your JSON assessment as per your instructions.
```

**Expected JSON output:**
```json
{
  "intent": "interested",
  "sentiment_score": 8,
  "next_action": "book_meeting",
  "urgency": "high",
  "suggested_response": "Hi Jane, great to hear from you! I'd love to schedule 20 minutes...",
  "notes": "Lead mentioned they're evaluating tools in Q3 — strong buying signal."
}
```

**Celery task integration** (`analyse_reply_task`): When `next_action` is `pause_sequence`, `stop_sequence`, or `pause_30_days`, the task automatically updates the sequence status in the DB.

**Required console config:**
- System prompt defines all intent categories
- System prompt defines all next_action options
- System prompt defines the JSON output schema strictly

---

### Quality Review Loop

**File:** `backend/agents/orchestrator.py` → `review_agent_output()`
**File:** `backend/app/tasks/pipeline_tasks.py` → `_run_agent_with_review()`

Before sequences are saved to the database, every specialist agent output goes through a **review loop** (up to 3 attempts):

```
Specialist Agent runs
        ↓
Orchestrator reviews output (using claude-opus-4-8 direct API call)
        ↓
Score 8–10 → ACCEPT → save to DB
Score 7    → ACCEPT → save to DB with notes
Score 1–6  → REJECT → feedback injected into next attempt's context
        ↓
Attempt 2: agent runs again with "IMPROVEMENT NOTES FROM PREVIOUS ATTEMPT: ..."
        ↓
Attempt 3: auto-ACCEPT regardless of score (prevents infinite loops)
```

**Review scoring criteria:**
1. **Personalisation depth** — does each message reference the lead's specific role, company, or industry?
2. **Format compliance** — correct JSON, all required fields present, no truncated content
3. **Content quality** — compelling, professional, human-sounding copy
4. **Channel rules** — SMS ≤160 chars, LinkedIn connection requests ≤300 chars

---

## Creating Agents in the Anthropic Console — Step by Step

### Prerequisites

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an account and add your API key to `.env` as `ANTHROPIC_API_KEY`
3. Navigate to **Agents** in the left sidebar

### How to Create Each Agent

For each agent below, click **"New Agent"** in the console and:

1. Give it the **name** shown
2. Paste the **system prompt** exactly as written
3. Enable the **tools** listed
4. Click **Create** — copy the `agent_id` to your `.env`
5. Create an **Environment** for the agent (click "New Environment" in the Environments tab):
   - Enable the same tools
   - Copy the `environment_id` to your `.env`
6. Create a **Vault** entry for your `ANTHROPIC_API_KEY` (needed for the Lead Generator):
   - Go to **Vaults** → **New Vault**
   - Copy the `vault_id` to your `.env` as `VAULT_IDS`

---

### Agent System Prompts

#### Agent 1 — Lead Generator

**Name:** `URL-to-Leads Generator`
**Env var names:** `LEAD_AGENT_ID`, `LEAD_AGENT_VERSION`, `LEAD_ENV_ID`
**Tools:** Web search, Browser/computer use

```
You are an expert B2B lead researcher and data analyst. Your mission is to analyse a target company's website and discover verified decision-maker leads who are the best fit for B2B outreach.

RESEARCH PROCESS:
1. Visit the target URL provided
2. Understand what the target company does, their product, market, and typical customer profile
3. Search LinkedIn, company directories, and public databases to find senior decision-makers
4. Focus on roles like: CEO, CTO, CMO, VP Sales, VP Marketing, Head of Growth, Director of Revenue, Founder
5. Verify each lead — confirm they currently work at the company (not former employees)
6. Enrich each lead with all available contact data

LEAD QUALITY STANDARDS:
- Only include currently employed contacts at the target company or companies that are ideal customers
- ICP_Fit_Score must be one of: High, Medium, Low
- Email addresses should be business emails (not personal Gmail/Hotmail)
- LinkedIn URLs must be full profile URLs (https://linkedin.com/in/...)
- Phone numbers in international format (+countrycode number)

OUTPUT FORMAT:
After completing all research, output a detailed narrative report summarising:
- What the company does and their market position
- Their ideal customer profile
- Key findings about the leads discovered

Then, at the very end of your response, output ALL leads as a single fenced CSV code block:

```csv
Name,Title,Company,Email,Phone,LinkedIn,Location,ICP_Fit_Score
[Lead 1 data]
[Lead 2 data]
```

CRITICAL RULES:
- The CSV block MUST use the exact column names: Name, Title, Company, Email, Phone, LinkedIn, Location, ICP_Fit_Score
- Every row must have at minimum: Name, Title, Company
- Do not add extra columns
- Do not split the CSV across multiple blocks — one block only at the very end
- If you cannot find a value, leave that cell empty (do not write "N/A" or "Unknown")
```

---

#### Agent 2 — Campaign Orchestrator

**Name:** `Campaign Orchestrator`
**Env var names:** `ORCHESTRATOR_AGENT_ID`, `ORCHESTRATOR_AGENT_VERSION`, `ORCHESTRATOR_ENV_ID`
**Tools:** None required (pure reasoning)

```
You are a senior B2B sales strategist and campaign orchestrator. You receive a list of leads and produce a detailed campaign plan that routes each lead to the right specialist outreach agents.

YOUR ROLE:
Analyse each lead's profile — their seniority, industry, role type, and available contact channels — and decide the optimal outreach strategy. You coordinate a team of specialist agents:

- outreach_agent: Multi-channel sequences (LinkedIn + email + phone). Best for senior executives, warm leads, and leads with multiple contact channels available.
- email_agent: Deep 5-step email nurture sequences. Best for leads where LinkedIn is unavailable or who prefer formal email communication.
- sms_agent: 3-step SMS sequences. ONLY for leads who have a mobile phone number in their data.

DECISION RULES:
1. If a lead has LinkedIn URL + Email → prefer outreach_agent
2. If a lead has Email only → use email_agent
3. If a lead has Phone → always add sms_agent regardless of other channels
4. If a lead has only LinkedIn → use outreach_agent with LinkedIn-only steps
5. You may assign multiple agents to one lead (e.g., outreach_agent + sms_agent)

MESSAGING ANGLE:
For each lead, write a 1-2 sentence messaging_angle that captures the most relevant personalisation hook. The specialist agents will use this to craft their messages. Reference:
- The lead's specific role and likely pain points
- The company's industry, size, or recent news
- Any signals from the seller context (funding, expansion, tech stack)

OUTPUT FORMAT:
Return ONLY a JSON array. No other text, no markdown, no preamble.

[
  {
    "lead_name": "exact name as it appears in the CSV",
    "agents_to_invoke": ["outreach_agent"],
    "messaging_angle": "Focus on their role as Head of Growth — position our tool as the missing piece in their acquisition stack.",
    "priority": "high"
  }
]

Priority values: "high" | "medium" | "low"
```

---

#### Agent 3 — Outreach Sequence Agent

**Name:** `Multi-Channel Outreach Specialist`
**Env var names:** `OUTREACH_AGENT_ID`, `OUTREACH_AGENT_VERSION`, `OUTREACH_ENV_ID`
**Tools:** None required

```
You are an expert B2B sales copywriter specialising in hyper-personalised multi-channel outreach sequences. You write compelling, human-sounding messages that get replies.

YOUR TASK:
For each lead provided, generate a personalised outreach sequence using their available contact channels. Determine which channels to use based on what data is available:
- LinkedIn URL present → include LinkedIn steps
- Email present → include email steps  
- Phone present → include phone/call steps

SEQUENCE STRUCTURE:
Generate 5-7 steps spread across 14-21 days. Example cadence:
- Day 1: LinkedIn connection request (if LinkedIn available)
- Day 3: LinkedIn message or email intro
- Day 7: Email follow-up
- Day 10: LinkedIn touchpoint or phone call note
- Day 14: Final value-add email
- Day 18: Break-up email (last attempt)

MESSAGE RULES:
- LinkedIn connection requests: MAX 300 characters. No selling, just a hook.
- LinkedIn messages: Conversational, under 150 words
- Emails: Professional but warm. Subject lines under 50 chars. Body under 200 words.
- Phone/call steps: Provide a brief call script outline (bullet points)
- Use [Seller Name] as placeholder — never invent a sender name
- NEVER use generic openers like "I hope this finds you well" or "I wanted to reach out"
- ALWAYS open with something specific to the lead (their role, company, recent news, industry trend)
- Each step must feel like it was written specifically for this one person

PERSONALISATION DEPTH:
Reference at least one specific detail per lead:
- Their job title and what that role actually cares about
- Their company's product, market, or customer base
- An industry trend relevant to their role
- Any data from ICP_Fit_Score to calibrate urgency

OUTPUT FORMAT:
Return ONLY a JSON array. No other text, no markdown, no explanation.

[
  {
    "lead_name": "Jane Smith",
    "title": "Head of Content",
    "company": "Acme Ltd",
    "channels": ["linkedin", "email"],
    "personalisation_note": "One sentence describing the personalisation angle used",
    "sequence": [
      {
        "step": 1,
        "day": 1,
        "channel": "linkedin",
        "type": "connection_request",
        "subject": null,
        "content": "Message text here"
      },
      {
        "step": 2,
        "day": 3,
        "channel": "email",
        "type": "intro",
        "subject": "Email subject line here",
        "content": "Full email body here"
      }
    ]
  }
]

Valid channel values: "linkedin" | "email" | "phone"
Valid type values: "connection_request" | "linkedin_message" | "intro" | "follow_up" | "value_add" | "case_study" | "break_up" | "call_script"
The "subject" field is required for email channel steps, null for all others.
```

---

#### Agent 4 — Email Specialist Agent

**Name:** `Email Nurture Specialist`
**Env var names:** `EMAIL_AGENT_ID`, `EMAIL_AGENT_VERSION`, `EMAIL_ENV_ID`
**Tools:** None required

```
You are an expert B2B email copywriter who creates high-converting, deeply personalised email nurture sequences. You write emails that feel like they come from a thoughtful human, not a template.

YOUR TASK:
For each lead, generate a 5-step email sequence. These emails are the primary outreach channel for this lead.

EMAIL CADENCE (strictly follow these day numbers):
- Step 1 — Day 1: Introduction email. Lead with the most compelling personalised hook. State value prop clearly.
- Step 2 — Day 4: Follow-up. Add a new angle or piece of value. Don't just say "checking in".
- Step 3 — Day 8: Social proof or case study. Reference a customer in their industry or with their role.
- Step 4 — Day 14: Ask a different question or share a relevant insight/resource.
- Step 5 — Day 21: Break-up email. Short, honest, gives them an easy out. Often the highest reply-rate email.

EMAIL RULES:
- Subject lines: Under 50 characters, specific, no clickbait, no ALL CAPS
- Opening line: Must reference something specific to this lead. Never start with "I", "We", or "Hope"
- Body: Under 200 words per email. One clear CTA per email.
- Tone: Professional but human. Like a smart colleague, not a salesperson.
- Use [Seller Name] as placeholder for the sender name
- Thread subject lines: Step 2 onwards should use "Re: {original subject}" to appear as a reply thread

PERSONALISATION REQUIREMENTS:
- Reference the lead's specific role and its typical challenges
- Reference the company's product or market at least once
- If ICP_Fit_Score is "High", increase urgency and directness
- If ICP_Fit_Score is "Low", focus on education and value first

OUTPUT FORMAT:
Return ONLY a JSON array. No preamble, no markdown, no explanation.

[
  {
    "lead_name": "Jane Smith",
    "company": "Acme Ltd",
    "personalisation_note": "Brief note on the personalisation angle",
    "sequence": [
      {
        "step": 1,
        "day": 1,
        "channel": "email",
        "type": "intro",
        "subject": "Subject line here",
        "content": "Full email body here"
      }
    ]
  }
]
```

---

#### Agent 5 — SMS Specialist Agent

**Name:** `SMS Outreach Specialist`
**Env var names:** `SMS_AGENT_ID`, `SMS_AGENT_VERSION`, `SMS_ENV_ID`
**Tools:** None required

```
You are a B2B SMS outreach specialist. You write short, punchy, professional SMS messages that respect the recipient's time and the 160-character hard limit.

YOUR TASK:
For each lead who has a phone number, generate a 3-step SMS sequence.

SMS CADENCE:
- Step 1 — Day 1: Introduction. Identify yourself, mention their company or role, state value in one line, clear CTA.
- Step 2 — Day 5: Follow-up. Reference the first message. Add a different angle. Easy yes/no CTA.
- Step 3 — Day 12: Final attempt. Short, direct, easy out. "Worth a quick reply?" style close.

CRITICAL CHARACTER LIMIT:
EVERY SMS MUST BE 160 CHARACTERS OR FEWER. Count every character including spaces. This is not a guideline — it is a hard technical requirement. Messages over 160 chars will be split into two SMS and appear unprofessional.

SMS RULES:
- Start with "[Seller Name]:" or "Hi [First Name], [Seller Name] here."
- One sentence value prop maximum
- End with a simple CTA: "Worth 10 mins?", "Interested?", "Reply YES to chat.", "Reply STOP to opt out"
- No emojis, no exclamation marks (look desperate), no links in first message
- Do not use the lead's full name in the message body (too formal for SMS)
- Professional but informal tone — like a text from a trusted contact

FORMATTING NOTE:
[First Name] in the message refers to the lead's first name. Extract it from the Name field.
[Seller Name] is the placeholder for the sender — never invent a name.

OUTPUT FORMAT:
Return ONLY a JSON array. No preamble, no markdown.

[
  {
    "lead_name": "Jane Smith",
    "company": "Acme Ltd",
    "phone": "+44 20 7946 0000",
    "sequence": [
      {
        "step": 1,
        "day": 1,
        "channel": "sms",
        "type": "intro",
        "subject": null,
        "content": "Hi Jane, [Seller Name] here. Helping content teams like Acme cut research time 60%. Worth 10 mins this week?"
      }
    ]
  }
]

After generating, count the characters in every "content" field. If any exceed 160, rewrite it shorter before outputting.
```

---

#### Agent 6 — Reply Monitor Agent

**Name:** `Reply Intelligence Agent`
**Env var names:** `REPLY_MONITOR_AGENT_ID`, `REPLY_MONITOR_AGENT_VERSION`, `REPLY_MONITOR_ENV_ID`
**Tools:** None required

```
You are an expert B2B sales analyst specialising in reply intelligence. You analyse incoming replies from leads and recommend the optimal next action for the sales rep.

YOUR TASK:
Analyse the incoming reply from a lead and classify their intent, sentiment, and urgency. Then recommend what the sales rep should do next.

INTENT CLASSIFICATION:
- "interested" — positive signal, wants to learn more, asks a question, suggests availability
- "meeting_request" — explicitly asks to book time, suggests a call, proposes a date
- "not_interested" — politely declines, says now is not the right time
- "unsubscribe" — asks to be removed, says stop emailing, opts out
- "out_of_office" — automated OOO reply, mentions they're on leave
- "question" — asks a specific question about the product/service without clear buying signal
- "referral" — redirects to a colleague, suggests someone else to speak to
- "neutral" — unclear reply, cannot be classified

NEXT ACTION OPTIONS:
- "continue_sequence" — proceed with the next scheduled step as planned
- "send_suggested_response" — pause sequence and send the drafted response first
- "book_meeting" — fast-track to booking a meeting, skip remaining sequence steps
- "pause_30_days" — pause sequence for 30 days (not_interested / bad timing)
- "pause_sequence" — pause indefinitely pending manual review
- "stop_sequence" — immediately stop all outreach (unsubscribe / aggressive opt-out)

RESPONSE DRAFTING:
If next_action is "send_suggested_response" or "book_meeting", provide a complete, ready-to-send reply in suggested_response. It should:
- Acknowledge their specific reply
- Move the conversation forward naturally
- Be under 150 words
- Sound human, not templated
- Propose a specific next step (date/time for meetings)

OUTPUT FORMAT:
Return ONLY a JSON object. No preamble, no markdown.

{
  "intent": "interested",
  "sentiment_score": 8,
  "urgency": "high",
  "next_action": "book_meeting",
  "suggested_response": "Full ready-to-send reply here if applicable, null otherwise",
  "notes": "Brief analyst note explaining the classification and any nuances",
  "referral_name": "Name of referred colleague if intent is referral, null otherwise",
  "referral_email": "Email of referred colleague if provided, null otherwise"
}

Sentiment score: 1 (very negative) to 10 (very positive/excited)
Urgency: "high" | "medium" | "low"
```

---

## Database Schema

9 tables, all created by the Alembic migration at `backend/migrations/versions/0001_initial_schema.py`.

```sql
-- Users (JWT auth — email/password sign-up)
users (id UUID PK, clerk_id VARCHAR UNIQUE, email VARCHAR UNIQUE,
       name VARCHAR, credit_balance INTEGER DEFAULT 0,
       created_at, updated_at)

-- API Keys (SHA-256 hashed, prefix shown in UI)
api_keys (id UUID PK, user_id UUID FK→users, name VARCHAR,
          key_prefix VARCHAR(16), key_hash VARCHAR UNIQUE,
          is_active BOOLEAN, last_used_at, created_at)

-- Campaigns (one per pipeline run)
campaigns (id UUID PK, user_id UUID FK→users, target_url VARCHAR,
           leads_requested INTEGER, batch_size INTEGER DEFAULT 5,
           status VARCHAR(32), slug VARCHAR, credits_charged INTEGER,
           error_message TEXT, celery_task_id VARCHAR,
           created_at, updated_at, completed_at)

-- Campaign status state machine:
-- queued → generating_leads → generating_sequences → review → approved → sending → complete
-- (any) → failed

-- Credit transactions (double-entry ledger)
credit_transactions (id UUID PK, user_id UUID FK→users,
                     amount INTEGER,  -- positive=credit, negative=debit
                     type VARCHAR(32),  -- 'purchase'|'pipeline_run'|'refund'|'bonus'
                     campaign_id UUID FK→campaigns,
                     stripe_payment_intent_id VARCHAR,
                     description VARCHAR, created_at)

-- Leads (enriched contacts discovered by Lead Generator Agent)
leads (id UUID PK, campaign_id UUID FK→campaigns,
       name VARCHAR, title VARCHAR, company VARCHAR,
       email VARCHAR, linkedin_url VARCHAR, phone VARCHAR,
       location VARCHAR, icp_fit_score VARCHAR(16),
       row_index INTEGER, created_at)

-- Sequences (one per lead per campaign)
sequences (id UUID PK, campaign_id UUID FK→campaigns,
           lead_id UUID FK→leads UNIQUE,
           status VARCHAR(32),  -- pending|approved|rejected|sending|complete
           channels JSONB,  -- ["linkedin","email"]
           approved_by UUID FK→users, approved_at,
           created_at)

-- Sequence Steps (individual messages in a sequence)
sequence_steps (id UUID PK, sequence_id UUID FK→sequences,
                lead_id UUID FK→leads, step_number INTEGER,
                day INTEGER, channel VARCHAR(32),  -- email|linkedin|phone|sms
                type VARCHAR(64), subject VARCHAR,
                content TEXT, status VARCHAR(32),  -- pending|scheduled|sent|failed|skipped
                scheduled_for TIMESTAMP, sent_at TIMESTAMP,
                error_message TEXT, created_at)

-- Gmail Connections (OAuth tokens, encrypted at rest)
gmail_connections (id UUID PK, user_id UUID FK→users UNIQUE,
                   gmail_email VARCHAR, access_token TEXT,  -- Fernet encrypted
                   refresh_token TEXT,  -- Fernet encrypted
                   token_expires_at, created_at, updated_at)

-- Campaign Files (GCS paths to output files)
campaign_files (id UUID PK, campaign_id UUID FK→campaigns,
                file_type VARCHAR(32),  -- leads_csv|report_md|sequences_json|sequences_md
                gcs_path VARCHAR, file_size_bytes INTEGER, created_at)

-- Replies (incoming replies from leads, Phase 6)
replies (id UUID PK, sequence_id UUID FK→sequences,
         step_id UUID FK→sequence_steps,
         gmail_message_id VARCHAR UNIQUE, from_email VARCHAR,
         subject VARCHAR, body_preview TEXT,
         received_at TIMESTAMP, action VARCHAR(32), created_at)
```

---

## Local Development Setup

### 1. Clone and install dependencies

```bash
git clone https://github.com/hemant-agentic/amrogen.git
cd amrogen

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 2. Start infrastructure

```bash
# From repo root — starts Postgres + Redis locally
docker compose up db redis -d
```

Or run the full stack including backend + worker:

```bash
docker compose up --build
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values (see Environment Variables section below)
```

### 4. Run database migrations

```bash
cd backend
alembic upgrade head
```

### 5. Start all services (development)

**Terminal 1 — API server:**
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Celery worker (runs the agent pipeline):**
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info --concurrency=2
```

**Terminal 3 — Celery beat (email scheduler, every 15 min):**
```bash
cd backend
celery -A app.tasks.celery_app beat --loglevel=info
```

**Terminal 4 — Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 5 — Stripe webhooks (for local payment testing):**
```bash
stripe listen --forward-to http://localhost:8000/webhooks/stripe
# Copy the whsec_... secret it prints into .env as STRIPE_WEBHOOK_SECRET
```

**Access:**
- Frontend: http://localhost:3000
- Backend API + docs: http://localhost:8000/docs
- MCP Server: http://localhost:8001

---

## Environment Variables Reference

Create `backend/.env` with the following variables:

```env
# ── Environment ───────────────────────────────────────────────────────────────
ENVIRONMENT=development  # development | staging | production

# ── Database (Neon / Cloud Run: use DB_* — do not set DATABASE_URL or REDIS_URL)
DB_HOST=ep-xxx.us-east-1.aws.neon.tech
DB_PORT=5432
DB_NAME=amrogen_prod_db
DB_USER=amrogen_prod_user
DB_PASSWORD=
DB_SSL=true
# Local docker-compose only (optional):
# DATABASE_URL=postgresql+asyncpg://amro:amropass@localhost:5432/amrogen

# ── Anthropic ─────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...

# ── Anthropic Managed Agent IDs ───────────────────────────────────────────────
# Create each agent in console.anthropic.com → Agents
# Then create an Environment for each agent → copy the environment_id

# Lead Generator Agent
LEAD_AGENT_ID=agent_01...
LEAD_AGENT_VERSION=1         # increment each time you update the agent config
LEAD_ENV_ID=env_01...

# Campaign Orchestrator Agent
ORCHESTRATOR_AGENT_ID=agent_01...
ORCHESTRATOR_AGENT_VERSION=1
ORCHESTRATOR_ENV_ID=env_01...

# Multi-Channel Outreach Agent
OUTREACH_AGENT_ID=agent_01...
OUTREACH_AGENT_VERSION=1
OUTREACH_ENV_ID=env_01...

# Email Specialist Agent
EMAIL_AGENT_ID=agent_01...
EMAIL_AGENT_VERSION=1
EMAIL_ENV_ID=env_01...

# SMS Specialist Agent
SMS_AGENT_ID=agent_01...
SMS_AGENT_VERSION=1
SMS_ENV_ID=env_01...

# Reply Monitor Agent
REPLY_MONITOR_AGENT_ID=agent_01...
REPLY_MONITOR_AGENT_VERSION=1
REPLY_MONITOR_ENV_ID=env_01...

# Anthropic Vault (for Lead Generator — holds ANTHROPIC_API_KEY securely)
# Create at console.anthropic.com → Vaults
VAULT_IDS=vlt_01...          # comma-separated if multiple

# ── Auth (JWT — not Clerk or Neon Auth) ───────────────────────────────────────
JWT_SECRET=change-me-in-production   # openssl rand -hex 32
JWT_EXPIRY_DAYS=7

# Frontend: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL
# Frontend bookings: RESEND_API_KEY, RESEND_FROM_EMAIL, BOOKING_NOTIFY_EMAIL

# ── Stripe (Payments) ─────────────────────────────────────────────────────────
# Create at stripe.com → Developers → API keys
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...  # from: stripe listen --forward-to ...
STRIPE_PRICE_STARTER=price_...   # GBP £599/mo
STRIPE_PRICE_GROWTH=price_...    # GBP £2,999/mo
STRIPE_PRICE_SCALE=price_...     # GBP £4,999/mo

# ── Google OAuth (Gmail sending) ──────────────────────────────────────────────
# Create at console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0
# Scopes needed: gmail.send, gmail.readonly, userinfo.email, openid
GOOGLE_CLIENT_ID=123456789-xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:8000/gmail/callback
# Production: https://api.yourdomain.com/gmail/callback

# ── Google Cloud Storage (output files) ──────────────────────────────────────
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# ── Encryption (Gmail token storage) ─────────────────────────────────────────
# Development: uses local Fernet key (32-byte string)
LOCAL_ENCRYPTION_KEY=dev-only-32-byte-secret-key-here!
# Production: use GCP KMS instead
# KMS_KEY_RESOURCE_NAME=projects/your-project/locations/global/keyRings/ring/cryptoKeys/key

# ── Credits pricing ───────────────────────────────────────────────────────────
CREDITS_PER_PIPELINE=8   # credits charged per full pipeline run
CREDIT_PRICE_CENTS=35    # £0.35 per credit (PAYG) — adjust if needed

# ── Misc ──────────────────────────────────────────────────────────────────────
API_BASE_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

---

## API Reference

All endpoints require authentication via:
- **JWT** (web app): `Authorization: Bearer <token>` from `/auth/sign-in`
- **API key** (API/MCP): `Authorization: Bearer amro_sk_<key>`

### Campaigns

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/campaigns` | Create campaign + enqueue pipeline (deducts credits) |
| `GET` | `/campaigns` | List campaigns (paginated) |
| `GET` | `/campaigns/{id}` | Campaign detail with lead/sequence counts |
| `GET` | `/campaigns/{id}/leads` | All leads for a campaign |
| `GET` | `/campaigns/{id}/sequences` | All sequences + steps + lead data |
| `PUT` | `/campaigns/{id}/sequences/{seq_id}` | Approve or reject a sequence |
| `POST` | `/campaigns/{id}/approve-all` | Approve all pending sequences |
| `POST` | `/campaigns/{id}/send` | Start email sending (requires Gmail connected) |
| `GET` | `/campaigns/{id}/stream` | SSE stream of real-time pipeline progress events |

### Credits

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/credits/balance` | Current balance + last 20 transactions |
| `POST` | `/credits/purchase` | Create Stripe checkout session |

### Gmail

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/gmail/auth-url` | Get Google OAuth URL |
| `GET` | `/gmail/callback` | OAuth callback (Google redirects here) |
| `GET` | `/gmail/status` | Check if Gmail is connected |
| `DELETE` | `/gmail/disconnect` | Disconnect Gmail |

### API Keys

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api-keys` | List keys (prefix only, never full key) |
| `POST` | `/api-keys` | Create key (full key shown once only) |
| `DELETE` | `/api-keys/{id}` | Revoke key |

### Webhooks

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/webhooks/stripe` | Stripe payment success → credit user |

---

## Campaign Pipeline — End to End

### SSE Progress Events

Connect to `GET /campaigns/{id}/stream` to receive real-time events during pipeline execution. Each event is a JSON object:

```javascript
// Example events in order:
{ type: "status_change",        status: "generating_leads" }
{ type: "session_created",      session_id: "sess_01..." }
{ type: "agent_text",           text: "Visiting target URL..." }
{ type: "leads_extracted",      count: 10 }
{ type: "leads_found",          count: 10 }
{ type: "status_change",        status: "generating_sequences" }
{ type: "orchestrator_planning", message: "Orchestrator analysing leads..." }
{ type: "orchestrator_start",   leads: 10 }
{ type: "agents_assigned",      email_agent: 3, sms_agent: 2, outreach_agent: 5 }
{ type: "agent_running",        agent: "outreach_agent", leads: 5, attempt: 1 }
{ type: "batch_start",          batch: 1, total: 1, count: 5 }
{ type: "orchestrator_reviewing", agent: "outreach_agent", attempt: 1 }
{ type: "agent_accepted",       agent: "outreach_agent", score: 9, attempt: 1 }
{ type: "sequences_ready",      count: 10 }
{ type: "status_change",        status: "review" }
```

### DB Connection Strategy (Critical for Long-Running Agents)

Postgres will close idle connections after ~5 minutes. Since agents run for 15–25 minutes, the Celery task **opens and closes DB connections** around every agent call:

```python
# ✅ Correct pattern (from pipeline_tasks.py)

# Phase 1: read campaign metadata
db = fresh_db()
try:
    campaign = db.execute(...).scalar_one()
    campaign.status = "generating_leads"
    db.commit()
finally:
    db.close()  # Close before running agent

# Agent runs (15–25 min) — NO DB connection held open
lead_result = lead_gen_run(url=target_url, ...)

# Phase 2: save leads with a fresh connection
db = fresh_db()
try:
    for row in leads_data:
        db.add(Lead(...))
    db.commit()
finally:
    db.close()
```

---

## Credits System

| Plan | Credits/mo | Price (GBP) | Full pipeline runs (~10 leads) |
|---|---|---|---|
| Starter | 100 | £599/mo | ~12 |
| Growth | 500 | £2,999/mo | ~62 |
| Scale | 2,000 | £4,999/mo | ~250 |
| Pay-as-you-go | — | £0.35/credit | 1 run = 8 credits ≈ £2.80 |

**Credit deduction flow:**
1. `POST /campaigns` — credits deducted upfront before pipeline starts
2. If pipeline fails → credits are NOT automatically refunded (manual refund via admin)
3. `credit_transactions` table records every debit/credit as an immutable ledger

**Stripe integration:**
- Checkout session created via `POST /credits/purchase`
- User redirected to Stripe hosted checkout
- On success: Stripe sends `checkout.session.completed` (and renewals via `invoice.paid`) to `/webhooks/stripe`
- Webhook credits the user's balance and records the transaction

---

## Gmail Integration

**OAuth Flow:**

```
1. User clicks "Connect Gmail" in settings
2. Frontend → GET /gmail/auth-url → returns Google OAuth URL
3. User redirected to Google → grants gmail.send + gmail.readonly scopes
4. Google redirects to GET /gmail/callback?code=...&state={user_uuid}
5. Backend exchanges code for tokens
6. Tokens encrypted with Fernet (or GCP KMS in prod) → stored in gmail_connections
7. Access token refreshed automatically before each send
```

**Email Sending (Celery Beat):**

`send_due_steps_task` runs every 15 minutes and dispatches all `sequence_steps` where:
- `status = 'scheduled'`
- `scheduled_for <= now()`
- Lead's sequence is `approved`
- Lead's user has a connected Gmail account

**Day scheduling:** When a sequence is approved, each step's `scheduled_for` is set to `approval_date + (step.day - 1) days`.

**LinkedIn steps:** Never sent automatically (LinkedIn ToS). Shown in UI with "Copy message" and "Open LinkedIn profile" buttons for manual execution.

---

## MCP Server

The MCP server (`mcp/server.py`) exposes the platform as tools for Claude Desktop and other AI builders. **Deploy separately** from the main API (not included in `deploy-production.ps1`).

**Environment** (`mcp/.env.example`):
- `BACKEND_API_URL` — production or local API URL
- `AMROGEN_API_KEY` — `amro_sk_...` from dashboard
- `MCP_PORT` — default `8001`

**Local:**
```bash
cd mcp && pip install -r requirements.txt
BACKEND_API_URL=http://localhost:8000 AMROGEN_API_KEY=amro_sk_... python server.py
```

**Endpoint:** `http://localhost:8001/sse`

**Claude Desktop:**
```json
{
  "mcpServers": {
    "amrogen": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:8001/sse"],
      "env": { "AMROGEN_API_KEY": "amro_sk_your_api_key_here" }
    }
  }
}
```

---

## Deployment

### Cloud Run (current — `deploy-production.ps1`)

Deploy **backend first**, then **frontend**. Uses `backend/.env.production` and `frontend/.env.production` only.

```powershell
# Backend
cd amrogen\backend
.\deploy-production.ps1

# Frontend (after NEXT_PUBLIC_API_URL points at live backend)
cd ..\frontend
.\deploy-production.ps1
```

**Frontend Cloud Run runtime extras** (add to `frontend/.env.production`):
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `BOOKING_NOTIFY_EMAIL` — consultation form
- `GEMINI_API_KEY`, `OPENAI_API_KEY` — optional article studio

**Backend:** create **GBP** Stripe Price IDs before deploy; set `STRIPE_PRICE_STARTER/GROWTH/SCALE`.

If `gcloud` fails SSL on Windows, set certifi bundle (scripts do this automatically):
```powershell
$env:SSL_CERT_FILE = (python -c "import certifi; print(certifi.where())")
gcloud config set core/custom_ca_certs_file $env:SSL_CERT_FILE
```

### Legacy manual gcloud (reference)

**Backend API:**
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/amrogen-api ./backend
gcloud run deploy amrogen-api \
  --image gcr.io/YOUR_PROJECT/amrogen-api \
  --platform managed \
  --region us-central1 \
  --memory 1Gi \
  --min-instances 1 \
  --set-env-vars ENVIRONMENT=production
```

**Celery Worker:**
```bash
gcloud builds submit --tag gcr.io/YOUR_PROJECT/amrogen-worker \
  --file backend/Dockerfile.worker ./backend
gcloud run deploy amrogen-worker \
  --image gcr.io/YOUR_PROJECT/amrogen-worker \
  --platform managed \
  --region us-central1 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 3 \
  --timeout 3600
```

**Frontend env (build-time `NEXT_PUBLIC_*` + runtime Resend):**
```
NEXT_PUBLIC_API_URL=https://your-backend.run.app
NEXT_PUBLIC_APP_URL=https://amrogen.com
NEXT_PUBLIC_SITE_URL=https://amrogen.com
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=AmroGen <noreply@yourdomain.com>
BOOKING_NOTIFY_EMAIL=hello@agentic-ai.ltd
```

### Production checklist

- [ ] `ENVIRONMENT=production` set in all services
- [ ] `DB_HOST` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` pointing to Postgres (Neon OK — **not** Neon Auth)
- [ ] Do **not** set `DATABASE_URL` or `REDIS_URL` on Cloud Run (unused; remove if present)
- [ ] `LOCAL_ENCRYPTION_KEY` (≥32 chars) or `KMS_KEY_RESOURCE_NAME` in production
- [ ] `GOOGLE_REDIRECT_URI` updated to production backend `/gmail/callback`
- [ ] Stripe webhook pointed to production `/webhooks/stripe` with **GBP** price IDs
- [ ] GCS bucket + Cloud Run service account IAM
- [ ] `JWT_SECRET` is a strong random string
- [ ] `FRONTEND_URL` includes production domain (CORS)
- [ ] Frontend `RESEND_*` + `BOOKING_NOTIFY_EMAIL` for AmroMeet fallback form
- [ ] AmroMeet booking URL: `https://amromeet.agentic-ai.ltd/#/book/agentic-ai-amro-consultation`

---

## Troubleshooting

### Agent produces 0 leads
The Lead Generator Agent didn't output a fenced CSV block. Check `lead_result["report_text"]` — the full response is stored. The 4-stage parser attempts to extract CSV from any format, but if the agent completely omits tabular data, regenerate with a retry.

### `SSL connection has been closed unexpectedly`
Postgres closed an idle connection while an agent was running (typical for 20+ min runs). Fixed by the `fresh_db()` pattern — open a new DB connection after each agent call, never hold one open while the agent runs.

### `MissingGreenlet` error on sequences endpoint
SQLAlchemy async can't lazy-load relationships during serialisation. All sequence queries must use `selectinload(Sequence.steps)` and `selectinload(Sequence.lead)`. Check `backend/app/routers/campaigns.py` → `get_sequences`.

### `Warning: Scope has changed` on Gmail OAuth
Set `OAUTHLIB_RELAX_TOKEN_SCOPE=1` in the environment. Google normalises `email` → `userinfo.email` during the OAuth flow, causing oauthlib to raise this as an exception. The env var silences it. Already fixed in `backend/app/services/gmail.py`.

### `InsecureTransportError` on Gmail callback (localhost only)
Set `OAUTHLIB_INSECURE_TRANSPORT=1` when `GOOGLE_REDIRECT_URI` starts with `http://`. Already handled automatically in `backend/app/services/gmail.py` — the env var is set in code when running locally.

### Celery task stuck in `PENDING`
Celery worker is not running. Start it with: `celery -A app.tasks.celery_app worker --loglevel=info`

### Credits deducted but pipeline failed
Credits are deducted upfront. If the pipeline fails (status=`failed`), manually credit the user via psql:
```sql
INSERT INTO credit_transactions (id, user_id, amount, type, description, created_at)
VALUES (gen_random_uuid(), 'user-uuid', 8, 'refund', 'Pipeline failure refund', now());

UPDATE users SET credit_balance = credit_balance + 8 WHERE id = 'user-uuid';
```
