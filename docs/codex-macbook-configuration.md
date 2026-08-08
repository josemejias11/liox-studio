# Complete Codex configuration for a MacBook

This is the full, reproducible Codex setup used with Moto AI as of Codex CLI
`0.147.0`. It covers the base configuration, custom agents, enabled plugins
and skills, MCP servers, credentials, and validation. It deliberately omits
all passwords, API keys, bearer tokens, and machine-specific paths.

Use this with [MacBook setup](macbook-setup.md), which configures Moto AI
itself.

## Scope and safe transfer rules

| Item                     | Action                                                                 |
| ------------------------ | ---------------------------------------------------------------------- |
| `~/.codex/config.toml`   | Recreate it from this guide with MacBook paths and local secrets.      |
| `~/.codex/agents/*.toml` | Securely copy from the working Mac to preserve full role instructions. |
| Plugins and skills       | Install through the Codex marketplace; do not copy caches.             |
| Credentials              | Add independently from the password manager.                           |
| Moto AI instructions     | Already arrive with the repository in `AGENTS.md`.                     |

Never copy an entire `~/.codex` directory. It can contain credentials,
sessions, caches, and machine-specific paths.

## 1. Install and validate Codex

Install and authenticate Codex using the current official OpenAI flow. Then
confirm the installation:

```bash
codex --version
codex doctor --summary --ascii --no-color
```

The working-machine baseline is Codex CLI `0.147.0`; a newer compatible
release is preferable.

## 2. Base `~/.codex/config.toml`

Create `~/.codex/config.toml`, replacing the paths with real MacBook paths:

```toml
model = "gpt-5.6-terra"
model_reasoning_effort = "medium"
service_tier = "default"
approvals_reviewer = "auto_review"

[projects."/absolute/path/to/your-home"]
trust_level = "trusted"

[projects."/absolute/path/to/moto-ai"]
trust_level = "trusted"

[agents]
max_concurrent_threads_per_session = 4
max_depth = 2

[agents.ai-ml-engineer]
config_file = "agents/ai-ml-engineer.toml"
[agents.application-engineer]
config_file = "agents/application-engineer.toml"
[agents.content-engineer]
config_file = "agents/content-engineer.toml"
[agents.data-platform-engineer]
config_file = "agents/data-platform-engineer.toml"
[agents.delivery-implementer]
config_file = "agents/delivery-implementer.toml"
[agents.mobile-engineer]
config_file = "agents/mobile-engineer.toml"
[agents.platform-reliability-engineer]
config_file = "agents/platform-reliability-engineer.toml"
[agents.product-experience-lead]
config_file = "agents/product-experience-lead.toml"
[agents.quality-engineer]
config_file = "agents/quality-engineer.toml"
[agents.security-engineer]
config_file = "agents/security-engineer.toml"
[agents.software-architecture-lead]
config_file = "agents/software-architecture-lead.toml"
[agents.systems-domain-engineer]
config_file = "agents/systems-domain-engineer.toml"

[features]
memories = true
prevent_idle_sleep = true

[plugins."figma@openai-curated"]
enabled = true
[plugins."github@openai-curated"]
enabled = true
[plugins."vercel@openai-curated"]
enabled = true
[plugins."superpowers@openai-curated"]
enabled = true
[plugins."build-web-apps@openai-curated"]
enabled = true
[plugins."coderabbit@openai-curated"]
enabled = true
```

Only mark directories you own and intend Codex to modify as `trusted`.

## 3. Custom agents

The registry above expects exactly twelve files in `~/.codex/agents/`. Securely
copy that directory from the working Mac to preserve full instructions, then
validate it on the MacBook:

```bash
find ~/.codex/agents -maxdepth 1 -name '*.toml' -print | sort
python3 -c 'import tomllib, pathlib; tomllib.load((pathlib.Path.home() / ".codex/config.toml").open("rb")); print("config.toml parses")'
codex doctor --summary --ascii --no-color
```

For a private AirDrop or encrypted-file transfer, make an archive on the
working Mac, transfer it, then expand it on the MacBook:

```bash
# Working Mac: archive only agent profiles, never the full .codex directory.
tar -C ~/.codex -czf ~/Desktop/codex-agents.tgz agents

# MacBook: expand the transferred archive.
mkdir -p ~/.codex
tar -C ~/.codex -xzf ~/Downloads/codex-agents.tgz
```

Delete the transferred archive once the validation commands succeed.

| Agent                           | Model / reasoning        | Sandbox         | Responsibility                                                  |
| ------------------------------- | ------------------------ | --------------- | --------------------------------------------------------------- |
| `ai-ml-engineer`                | `gpt-5.6-sol` / high     | workspace-write | LLM apps, RAG, agents, evaluation, model serving.               |
| `application-engineer`          | `gpt-5.6-terra` / high   | workspace-write | Web UI, APIs, application data, shared contracts.               |
| `content-engineer`              | `gpt-5.6-luna` / medium  | workspace-write | Docs, instructional design, developer content, product wording. |
| `data-platform-engineer`        | `gpt-5.6-terra` / high   | workspace-write | Telemetry, ETL/ELT, dbt, warehouse, metrics, BI.                |
| `delivery-implementer`          | `gpt-5.6-terra` / medium | workspace-write | One bounded decision-complete implementation.                   |
| `mobile-engineer`               | `gpt-5.6-terra` / high   | workspace-write | iOS, Android, React Native, mobile delivery.                    |
| `platform-reliability-engineer` | `gpt-5.6-terra` / high   | workspace-write | Dev environment, CI/CD, cloud, reliability.                     |
| `product-experience-lead`       | `gpt-5.6-sol` / high     | workspace-write | Product, UX, design systems, accessibility.                     |
| `quality-engineer`              | `gpt-5.6-sol` / high     | workspace-write | Verification, browser/API automation, release evidence.         |
| `security-engineer`             | `gpt-5.6-sol` / xhigh    | read-only       | Threat modeling, security architecture, review.                 |
| `software-architecture-lead`    | `gpt-5.6-sol` / xhigh    | read-only       | Architecture, ownership, plan review.                           |
| `systems-domain-engineer`       | `gpt-5.6-terra` / high   | workspace-write | Rust/Go, WASM, graphics, performance, embedded.                 |

## 4. Credentials and environment

Keep all values in the password manager and export them from the MacBook's
`~/.zshenv`; replace every placeholder locally.

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="<GitHub token>"
export FIRECRAWL_API_KEY="<Firecrawl API key>"
export POSTMAN_API_KEY="<Postman API key>"
export OLLAMA_HOST="http://localhost:11434"
```

Figma uses its own connection or OAuth flow. Context7 has an HTTP-header key
in `config.toml`; PostgreSQL has a password-bearing local URL. Fill both only
on the MacBook and never in this repository.

## 5. MCP server setup

Add standard MCPs through the CLI. Replace every placeholder before running:

```bash
# Browser and local development
codex mcp add playwright -- npx @playwright/mcp@latest
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest
codex mcp add sequential-thinking -- npx -y @modelcontextprotocol/server-sequential-thinking
codex mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem "$HOME/"
codex mcp add next-devtools -- npx -y next-devtools-mcp@latest
codex mcp add gitnexus -- npx -y gitnexus@latest mcp

# Local service adapters
codex mcp add ollama --env OLLAMA_HOST=http://localhost:11434 -- npx -y ollama-mcp
codex mcp add postgres -- npx -y @modelcontextprotocol/server-postgres "postgresql://<user>:<password>@localhost:5432/<database>"

# Remote adapters
codex mcp add figma --url https://mcp.figma.com/mcp
codex mcp add github --url https://api.githubcopilot.com/mcp/ --bearer-token-env-var GITHUB_PERSONAL_ACCESS_TOKEN
```

Add this remaining configuration to `~/.codex/config.toml`. The Context7 value
is a secret; replace it only on the MacBook.

```toml
[mcp_servers.context7]
url = "https://mcp.context7.com/mcp"
http_headers = { CONTEXT7_API_KEY = "<Context7 API key>" }

[mcp_servers.figma.tools.generate_figma_design]
enabled = true
[mcp_servers.figma.tools.use_figma]
enabled = true

[mcp_servers.playwright.tools.browser_click]
enabled = true
[mcp_servers.playwright.tools.browser_evaluate]
enabled = true
[mcp_servers.playwright.tools.browser_navigate]
enabled = true
[mcp_servers.playwright.tools.browser_resize]
enabled = true
[mcp_servers.playwright.tools.browser_run_code_unsafe]
enabled = true
[mcp_servers.playwright.tools.browser_tabs]
enabled = true

[mcp_servers.chrome-devtools.tools.click]
enabled = true
[mcp_servers.chrome-devtools.tools.close_page]
enabled = true
[mcp_servers.chrome-devtools.tools.evaluate_script]
enabled = true
[mcp_servers.chrome-devtools.tools.new_page]
enabled = true
[mcp_servers.chrome-devtools.tools.take_screenshot]
enabled = true
[mcp_servers.chrome-devtools.tools.take_snapshot]
enabled = true
```

### Firecrawl and Postman wrappers

The working setup uses local wrappers so those secrets stay out of
`config.toml`. Create executable scripts with these contents, then register
them:

```bash
# ~/.codex/bin/firecrawl-mcp
#!/bin/zsh
exec npx -y firecrawl-mcp

# ~/.codex/bin/postman-mcp
#!/bin/zsh
exec npx -y @postman/postman-mcp-server --full
```

```bash
mkdir -p ~/.codex/bin
chmod 700 ~/.codex/bin/firecrawl-mcp ~/.codex/bin/postman-mcp
codex mcp add firecrawl-mcp -- ~/.codex/bin/firecrawl-mcp
codex mcp add postman -- ~/.codex/bin/postman-mcp
```

| MCP                   | Transport     | Purpose                                 | Requirement                   |
| --------------------- | ------------- | --------------------------------------- | ----------------------------- |
| `figma`               | Remote HTTP   | Figma design context and operations.    | Figma OAuth/connection.       |
| `playwright`          | Local stdio   | Browser automation.                     | Node and browser runtime.     |
| `chrome-devtools`     | Local stdio   | Chrome DevTools inspection.             | Node and Chrome.              |
| `context7`            | Remote HTTP   | Version-specific library documentation. | Context7 API key.             |
| `sequential-thinking` | Local stdio   | Structured reasoning.                   | Node.                         |
| `filesystem`          | Local stdio   | Home-directory file access.             | Correct MacBook home path.    |
| `github`              | Remote HTTP   | GitHub MCP.                             | GitHub personal access token. |
| `postgres`            | Local stdio   | PostgreSQL inspection.                  | Local database URL.           |
| `ollama`              | Local stdio   | Local Ollama development tool.          | Ollama at `OLLAMA_HOST`.      |
| `next-devtools`       | Local stdio   | Next.js runtime diagnostics.            | Node and Next app.            |
| `firecrawl-mcp`       | Local wrapper | Firecrawl retrieval.                    | Firecrawl API key.            |
| `postman`             | Local wrapper | Postman API/collection operations.      | Postman API key.              |
| `gitnexus`            | Local stdio   | Repository graph navigation.            | Node.                         |

Validate MCPs after setup:

```bash
codex mcp list
codex mcp get context7
codex mcp get github
```

## 6. Plugins and complete skill catalog

Install the six enabled marketplace plugins:

```bash
codex plugin add figma@openai-curated
codex plugin add github@openai-curated
codex plugin add vercel@openai-curated
codex plugin add superpowers@openai-curated
codex plugin add build-web-apps@openai-curated
codex plugin add coderabbit@openai-curated
codex plugin list
```

Plugin versions are marketplace-managed. Do not copy cache directories; verify
effective versions with `codex plugin list`.

| Plugin         | Skills                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Figma          | `figma-code-connect`, `figma-create-new-file`, `figma-design-to-code`, `figma-generate-design`, `figma-generate-diagram`, `figma-generate-library`, `figma-implement-motion`, `figma-swiftui`, `figma-use`, `figma-use-figjam`, `figma-use-motion`, `figma-use-slides`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| GitHub         | `gh-address-comments`, `gh-fix-ci`, `github`, `yeet`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Build Web Apps | `frontend-app-builder`, `frontend-testing-debugging`, `react-best-practices`, `shadcn-best-practices`, `stripe-best-practices`, `supabase-best-practices`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| CodeRabbit     | `coderabbit-review`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Superpowers    | `brainstorming`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Vercel         | `agent-browser`, `agent-browser-verify`, `ai-elements`, `ai-gateway`, `ai-generation-persistence`, `ai-sdk`, `auth`, `bootstrap`, `cdn-caching`, `chat-sdk`, `cms`, `cron-jobs`, `deployments-cicd`, `email`, `env-vars`, `eve`, `geist`, `geistdocs`, `investigation-mode`, `json-render`, `knowledge-update`, `marketplace`, `micro`, `microfrontends`, `ncc`, `next-cache-components`, `next-forge`, `next-upgrade`, `nextjs`, `observability`, `payments`, `react-best-practices`, `routing-middleware`, `runtime-cache`, `satori`, `shadcn`, `sign-in-with-vercel`, `swr`, `turbopack`, `turborepo`, `v0-dev`, `vercel-agent`, `vercel-api`, `vercel-cli`, `vercel-connect`, `vercel-firewall`, `vercel-flags`, `vercel-functions`, `vercel-queues`, `vercel-sandbox`, `vercel-services`, `vercel-storage`, `verification`, `workflow` |

Skills are surfaced automatically when the task matches their trigger; do not
copy them into the Moto AI repository.

## 7. Final validation and safety

```bash
python3 -c 'import tomllib, pathlib; tomllib.load((pathlib.Path.home() / ".codex/config.toml").open("rb")); print("config.toml parses")'
codex --version
codex plugin list
codex mcp list
codex doctor --summary --ascii --no-color
```

- Never commit `~/.codex/config.toml`, `~/.codex/agents/`, `~/.zshenv`, or MCP wrappers.
- Keep `filesystem` scoped only to directories you intend Codex to access.
- Use read-only security and architecture agents for review, not implementation.
- After a configuration change, run `codex doctor` and `codex mcp list`.

## References

- [OpenAI Developers: Codex](https://developers.openai.com/)
- [OpenAI Developers: plugins](https://developers.openai.com/)
