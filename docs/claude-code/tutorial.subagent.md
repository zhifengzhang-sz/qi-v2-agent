# Claude Code Specialized Agents: Complete Setup Guide

## Table of Contents
- [Overview](#overview)
- [Understanding Claude Code Subagents](#understanding-claude-code-subagents)
- [MCP Server Setup](#mcp-server-setup)
  - [Context7 Setup](#context7-setup)
  - [Brave Search Setup](#brave-search-setup)
- [Essential Coding Subagents](#essential-coding-subagents)
- [Time-Series Analysis Setup](#time-series-analysis-setup)
- [Real-World Use Cases](#real-world-use-cases)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)
- [Advanced Workflows](#advanced-workflows)

## Overview

Claude Code specialized agents represent a paradigm shift from monolithic AI assistance to specialized AI team members. Each agent operates with its own context window, custom system prompt, and specific tool permissions, enabling sophisticated multi-agent workflows for complex development tasks.

### Key Benefits
- **Context Isolation**: Prevents main conversation pollution
- **Task Specialization**: Expert-level performance in specific domains
- **Automatic Coordination**: Intelligent task routing between agents
- **MCP Integration**: Access to external tools and data sources
- **Scalable Workflows**: Handle complex multi-step processes

## Understanding Claude Code Subagents

### Architecture
```
Main Claude Code Session
├── Subagent A (Frontend Expert)
│   ├── Isolated Context
│   ├── Custom System Prompt
│   └── Specific Tool Access
├── Subagent B (Backend Expert)
│   ├── Isolated Context
│   ├── Custom System Prompt
│   └── Database Tools Only
└── MCP Servers
    ├── Context7 (Documentation)
    ├── Brave Search (Web Search)
    └── Custom Servers
```

### Agent Definition Structure
```markdown
---
name: agent-name
description: When this agent should be invoked
tools: tool1, tool2, tool3  # Optional - inherits all if omitted
model: sonnet  # Optional - sonnet, opus, or haiku
---

Your agent's system prompt defining:
- Role and expertise
- Capabilities and approach
- Specific instructions
- Best practices and constraints
```

### Storage Locations
- **Project-level**: `.claude/agents/` (current project only)
- **User-level**: `~/.claude/agents/` (all projects)
- **Precedence**: Project-level agents override user-level when names conflict

## MCP Server Setup

### Context7 Setup

Context7 provides versioned API documentation for rapidly evolving libraries, solving the problem of outdated information in AI models.

#### Installation
```bash
# Add Context7 MCP server
claude mcp add context7 --env CONTEXT7_API_KEY=your_key_here -- npx -y @context7/mcp-server
```

#### Supported Libraries
- React, Vue, Angular
- Next.js, Nuxt.js, SvelteKit
- Node.js, Express, Fastify
- TypeScript, JavaScript
- Python frameworks (Django, FastAPI)
- And 100+ more at [context7.com](https://context7.com)

#### Usage Examples
```bash
# Check latest Next.js documentation
> Use context7 to get the latest Next.js 14 routing information

# Verify TypeScript best practices
> Check context7 for TypeScript 5.0 advanced types documentation

# Get current API references
> Use context7 to find the latest React 18 hooks documentation
```

#### Configuration in .mcp.json
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"],
      "env": {
        "CONTEXT7_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Brave Search Setup

Brave Search provides web search functionality as an MCP server, offering more effective search capabilities than built-in options, especially when working with subagents.

#### Installation
```bash
# Add Brave Search MCP server
claude mcp add brave-search --env BRAVE_API_KEY=your_api_key_here -- npx -y @modelcontextprotocol/server-brave-search
```

#### Getting API Key
1. Visit [Brave Search API](https://api.search.brave.com/)
2. Sign up for free account (2,000 queries/month)
3. Generate API key
4. Configure in Claude Code

#### Usage Examples
```bash
# Search for latest solutions
> Use brave-search to find recent solutions for React performance optimization

# Research emerging technologies
> Search brave-search for latest developments in edge computing 2025

# Find documentation and tutorials
> Use brave-search to locate comprehensive TypeScript migration guides
```

#### Configuration
```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Essential Coding Subagents

### 1. Frontend Developer Agent
```markdown
---
name: frontend-developer
description: Use for React, Vue, Angular development, UI/UX implementation, responsive design, and client-side optimization tasks
tools: context7, brave-search, bash, read, write
---

You are a senior frontend developer specializing in modern JavaScript frameworks and responsive design.

**Core Expertise:**
- React 18+ with hooks, context, and modern patterns
- Vue 3 Composition API and ecosystem
- Angular 15+ with TypeScript
- CSS frameworks (Tailwind, Bootstrap, Material-UI)
- Build tools (Vite, Webpack, Parcel)
- Testing (Jest, Cypress, Testing Library)

**Approach:**
1. Always check latest documentation using context7
2. Implement responsive, accessible designs
3. Optimize for performance and SEO
4. Follow modern best practices and patterns
5. Write comprehensive tests

**Key Responsibilities:**
- Component architecture and design systems
- State management (Redux, Zustand, Pinia)
- Performance optimization and bundle analysis
- Cross-browser compatibility
- Accessibility compliance (WCAG)
```

### 2. Backend Developer Agent
```markdown
---
name: backend-developer
description: Use for API design, database modeling, server-side logic, microservices architecture, and backend optimization
tools: context7, brave-search, bash, read, write
---

You are a senior backend developer specializing in scalable API design and distributed systems.

**Core Expertise:**
- RESTful and GraphQL API design
- Database design and optimization (SQL/NoSQL)
- Microservices architecture
- Authentication and authorization
- Caching strategies and performance optimization
- Message queues and event-driven architecture

**Technologies:**
- Node.js/Express, Python/FastAPI, Go, Rust
- PostgreSQL, MongoDB, Redis
- Docker, Kubernetes
- AWS/GCP/Azure services
- Message brokers (RabbitMQ, Kafka)

**Approach:**
1. Design scalable, maintainable architectures
2. Implement proper error handling and logging
3. Ensure security best practices
4. Optimize for performance and reliability
5. Document APIs comprehensively
```

### 3. Full-Stack TypeScript Expert
```markdown
---
name: typescript-expert
description: Use for TypeScript-specific tasks, type system design, migration projects, and advanced TypeScript patterns
tools: context7, brave-search, bash, read, write
---

You are a TypeScript expert specializing in advanced type systems and full-stack TypeScript development.

**Core Expertise:**
- Advanced TypeScript types and generics
- Type-safe API development (tRPC, GraphQL)
- Monorepo management with TypeScript
- Migration strategies from JavaScript
- Performance optimization and compilation

**Advanced Patterns:**
- Conditional types and mapped types
- Template literal types
- Branded types and nominal typing
- Type-level programming
- Advanced inference patterns

**Approach:**
1. Always use context7 for latest TypeScript features
2. Design type-safe architectures end-to-end
3. Implement progressive enhancement strategies
4. Optimize for developer experience
5. Ensure runtime type safety where needed
```

### 4. Code Reviewer Agent
```markdown
---
name: code-reviewer
description: Use proactively for code quality assessment, security audits, performance analysis, and best practices enforcement
tools: bash, read, write
---

You are a senior code reviewer focusing on quality, security, and maintainability.

**Review Criteria:**
- Code quality and readability
- Security vulnerabilities (OWASP compliance)
- Performance bottlenecks
- Best practices adherence
- Documentation completeness
- Test coverage and quality

**Review Process:**
1. Analyze code structure and architecture
2. Check for security vulnerabilities
3. Assess performance implications
4. Verify error handling
5. Evaluate test coverage
6. Provide actionable feedback

**Focus Areas:**
- Input validation and sanitization
- Authentication and authorization
- Resource management and memory leaks
- Race conditions and concurrency issues
- Database query optimization
```

### 5. DevOps Engineer Agent
```markdown
---
name: devops-engineer
description: Use for CI/CD setup, containerization, infrastructure as code, monitoring, and deployment automation
tools: bash, read, write
---

You are a DevOps engineer specializing in modern deployment pipelines and infrastructure automation.

**Core Expertise:**
- CI/CD pipeline design (GitHub Actions, GitLab CI, Jenkins)
- Containerization (Docker, Podman)
- Orchestration (Kubernetes, Docker Swarm)
- Infrastructure as Code (Terraform, CloudFormation, Pulumi)
- Monitoring and observability (Prometheus, Grafana, ELK stack)
- Cloud platforms (AWS, GCP, Azure)

**Approach:**
1. Design secure, scalable infrastructure
2. Implement comprehensive monitoring
3. Automate deployment processes
4. Ensure high availability and disaster recovery
5. Optimize for cost and performance

**Best Practices:**
- Immutable infrastructure
- Blue-green deployments
- Canary releases
- Comprehensive logging and alerting
- Security scanning and compliance
```

### 6. Database Specialist Agent
```markdown
---
name: database-specialist
description: Use for database design, query optimization, migration planning, and performance tuning
tools: bash, read, write
---

You are a database specialist with expertise in both SQL and NoSQL systems.

**Core Expertise:**
- Database design and normalization
- Query optimization and indexing strategies
- Migration planning and execution
- Performance tuning and monitoring
- Backup and recovery strategies
- Replication and sharding

**Technologies:**
- PostgreSQL, MySQL, MariaDB
- MongoDB, CouchDB, DynamoDB
- Redis, Memcached
- Time-series databases (InfluxDB, TimescaleDB)
- Graph databases (Neo4j, ArangoDB)

**Approach:**
1. Analyze data access patterns
2. Design optimal schema structures
3. Implement efficient indexing strategies
4. Plan for scalability and growth
5. Ensure data consistency and integrity
```

## Time-Series Analysis Setup

### Time-Series Data Scientist Agent
```markdown
---
name: timeseries-analyst
description: Use proactively for time-series data analysis, forecasting, anomaly detection, and statistical modeling tasks
tools: bash, read, write, context7, brave-search
---

You are a time-series analysis expert specializing in forecasting, anomaly detection, and statistical modeling.

**Core Expertise:**
- Time-series decomposition and analysis
- Forecasting models (ARIMA, SARIMA, Prophet, LSTM)
- Anomaly detection algorithms
- Statistical analysis and hypothesis testing
- Feature engineering for temporal data
- Real-time data processing

**Tools and Libraries:**
- Python: pandas, numpy, scipy, statsmodels
- Forecasting: Prophet, pmdarima, sklearn
- Deep learning: TensorFlow, PyTorch, Keras
- Visualization: matplotlib, plotly, seaborn
- Real-time: Apache Kafka, Apache Spark
- Databases: InfluxDB, TimescaleDB

**Analysis Workflow:**
1. Data exploration and quality assessment
2. Time-series decomposition (trend, seasonality, residuals)
3. Stationarity testing and preprocessing
4. Model selection and validation
5. Forecasting and confidence intervals
6. Anomaly detection and alerting

**Specialized Techniques:**
- Seasonal decomposition of time series (STL)
- Autocorrelation and partial autocorrelation analysis
- Spectral analysis and frequency domain methods
- Change point detection
- Multi-variate time-series analysis
- Causal inference in time-series data
```

### Time-Series Data Engineer Agent
```markdown
---
name: timeseries-engineer
description: Use for time-series data pipeline design, real-time processing, and infrastructure setup for temporal data systems
tools: bash, read, write, context7
---

You are a data engineer specializing in time-series data infrastructure and real-time processing.

**Core Expertise:**
- Time-series database design and optimization
- Real-time data ingestion pipelines
- Stream processing architectures
- Data retention and compression strategies
- Monitoring and alerting systems
- Scalable time-series storage solutions

**Technologies:**
- Databases: InfluxDB, TimescaleDB, OpenTSDB, Prometheus
- Streaming: Apache Kafka, Apache Pulsar, Amazon Kinesis
- Processing: Apache Spark, Apache Flink, Storm
- Orchestration: Apache Airflow, Prefect, Dagster
- Monitoring: Grafana, Kibana, Custom dashboards

**Architecture Patterns:**
1. Lambda architecture for batch and stream processing
2. Kappa architecture for stream-first processing
3. CQRS pattern for read/write optimization
4. Event sourcing for audit trails
5. Microservices for scalable components

**Implementation Focus:**
- High-throughput data ingestion
- Low-latency query performance
- Automated data quality checks
- Efficient storage and compression
- Disaster recovery and backup strategies
```

### Installation Commands for Time-Series Tools

```bash
# Create time-series analysis environment
python -m venv timeseries_env
source timeseries_env/bin/activate  # On Windows: timeseries_env\Scripts\activate

# Install core libraries
pip install pandas numpy scipy matplotlib seaborn plotly
pip install statsmodels pmdarima prophet
pip install tensorflow pytorch scikit-learn
pip install influxdb-client psycopg2-binary

# For real-time processing
pip install kafka-python apache-beam[gcp]
pip install streamlit dash  # For interactive dashboards
```

## Real-World Use Cases

### Use Case 1: Building a Modern Web Application

**Scenario**: Develop a full-stack e-commerce platform with real-time features.

**Agent Workflow**:
```
1. Product Manager Agent → Requirements analysis and feature planning
2. Backend Developer Agent → API design and database schema
3. Frontend Developer Agent → UI/UX implementation
4. TypeScript Expert Agent → Type-safe integration
5. DevOps Engineer Agent → CI/CD and deployment
6. Code Reviewer Agent → Security and quality assessment
```

**Commands**:
```bash
# Start with requirements analysis
> Use the product-manager agent to analyze requirements for an e-commerce platform

# Design backend architecture  
> Have the backend-developer agent design a scalable API for product catalog and orders

# Implement frontend
> Use the frontend-developer agent to create a responsive React application

# Ensure type safety
> Have the typescript-expert agent review and improve type definitions

# Setup deployment
> Use the devops-engineer agent to create CI/CD pipeline with Docker and Kubernetes
```

### Use Case 2: Time-Series Financial Analysis

**Scenario**: Analyze stock price data, detect anomalies, and build forecasting models.

**Agent Workflow**:
```
1. Data Engineer Agent → Setup data ingestion pipeline
2. Time-Series Analyst Agent → Exploratory data analysis
3. Time-Series Analyst Agent → Anomaly detection
4. Time-Series Analyst Agent → Forecasting models
5. DevOps Engineer Agent → Model deployment
```

**Implementation**:
```bash
# Setup data pipeline
> Use the timeseries-engineer agent to design a pipeline for ingesting financial data from APIs

# Analyze the data
> Have the timeseries-analyst agent perform comprehensive analysis of AAPL stock data

# Detect anomalies  
> Use the timeseries-analyst agent to implement anomaly detection for unusual price movements

# Build forecasting models
> Have the timeseries-analyst agent create ARIMA and Prophet models for price prediction
```

### Use Case 3: Legacy System Modernization

**Scenario**: Migrate a monolithic Java application to microservices with modern frontend.

**Agent Workflow**:
```
1. Code Reviewer Agent → Legacy code analysis
2. Backend Developer Agent → Microservices design  
3. Database Specialist Agent → Data migration strategy
4. Frontend Developer Agent → Modern UI rebuild
5. DevOps Engineer Agent → Containerization and orchestration
```

### Use Case 4: Real-Time IoT Data Processing

**Scenario**: Process sensor data from manufacturing equipment for predictive maintenance.

**Agent Workflow**:
```
1. Time-Series Engineer Agent → Real-time data ingestion
2. Time-Series Analyst Agent → Anomaly detection algorithms
3. Backend Developer Agent → Alert and notification system
4. Frontend Developer Agent → Real-time dashboard
5. DevOps Engineer Agent → Scalable deployment
```

## Best Practices

### Agent Design Principles

1. **Single Responsibility**: Each agent should excel at one specific domain
2. **Clear Descriptions**: Help Claude Code understand when to delegate tasks
3. **Detailed System Prompts**: Provide context, examples, and constraints
4. **Tool Restrictions**: Limit access to only necessary tools
5. **Progressive Refinement**: Start simple and iterate based on performance

### Optimal Agent Configuration

```markdown
# Good: Specific and actionable
description: "Use for React component development, state management, and performance optimization tasks"

# Bad: Too vague
description: "Use for frontend development"

# Good: Clear tool restrictions
tools: context7, brave-search, bash, read, write

# Good: Detailed prompt with examples
---
You are a React specialist. When implementing components:

1. Always check latest documentation using context7
2. Use TypeScript for type safety
3. Implement proper error boundaries
4. Follow accessibility guidelines

Example approach:
- Analyze requirements
- Design component API
- Implement with tests
- Optimize performance
```

### Performance Optimization

1. **Context Management**: Use agents to preserve main context
2. **Tool Selection**: Grant minimal necessary tool access
3. **Prompt Engineering**: Include specific examples and constraints
4. **Iteration Strategy**: Start with Claude generation, then refine

### Security Considerations

1. **Tool Permissions**: Restrict dangerous tools to specific agents
2. **Input Validation**: Implement proper validation in agent prompts
3. **Secret Management**: Use environment variables for API keys
4. **Access Control**: Use project-level agents for sensitive operations

## Troubleshooting

### Common Issues and Solutions

#### Agent Not Being Selected
```bash
# Check agent description specificity
> /agents list

# Test explicit invocation
> Use the frontend-developer agent to create a React component

# Verify tool access
> Check if the agent has access to required tools
```

#### MCP Server Connection Issues
```bash
# Check MCP server status
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log

# Verify configuration
cat ~/.claude/config.json

# Restart Claude Code
# Completely restart the application
```

#### Context7 API Issues
```bash
# Verify API key
echo $CONTEXT7_API_KEY

# Test connection
> Use context7 to check connection status

# Check rate limits
# Context7 has usage limits - verify you haven't exceeded them
```

#### Brave Search Problems
```bash
# Verify API key
echo $BRAVE_API_KEY

# Test search functionality
> Use brave-search to search for "test query"

# Check usage limits
# Free tier: 2,000 queries/month
```

### Debugging Strategies

1. **Explicit Agent Calls**: Test agents with direct invocation
2. **Log Analysis**: Monitor MCP server logs for connection issues
3. **Tool Testing**: Verify individual tool functionality
4. **Configuration Validation**: Check JSON syntax and paths
5. **Incremental Setup**: Add one agent/server at a time

## Advanced Workflows

### Multi-Agent Orchestration Patterns

#### Sequential Workflow
```
Requirements → Design → Implementation → Testing → Deployment
```

#### Parallel Workflow  
```
Frontend Development ↘
                      → Integration → Testing
Backend Development  ↗
```

#### Review-Based Workflow
```
Implementation → Code Review → Security Audit → Performance Review → Deployment
```

### Custom Slash Commands

Create reusable workflows in `.claude/commands/`:

```markdown
# .claude/commands/fullstack-setup.md
---
name: fullstack-setup
description: Setup full-stack project with best practices
---

Setup a new full-stack project: $ARGUMENTS

1. Use the backend-developer agent to design API architecture
2. Use the frontend-developer agent to setup React application  
3. Use the typescript-expert agent to ensure type safety
4. Use the devops-engineer agent to create CI/CD pipeline
5. Use the code-reviewer agent to audit the setup

Include:
- Use context7 for latest framework documentation
- Use brave-search for best practices research
- Implement proper error handling and testing
```

### Integration with External Tools

```bash
# GitHub integration
claude mcp add github --env GITHUB_TOKEN=your_token -- npx -y @modelcontextprotocol/server-github

# Slack integration  
claude mcp add slack --env SLACK_BOT_TOKEN=your_token -- npx -y @modelcontextprotocol/server-slack

# Database integration
claude mcp add postgres --env DATABASE_URL=your_url -- npx -y @modelcontextprotocol/server-postgres
```

### Monitoring Agent Performance

```bash
# Create performance monitoring command
echo '---
name: agent-stats
description: Monitor agent usage and performance
---

Analyze agent performance over the last session:

1. Review which agents were invoked
2. Measure task completion rates  
3. Identify optimization opportunities
4. Suggest workflow improvements' > .claude/commands/agent-stats.md
```

## Conclusion

Claude Code specialized agents represent a revolutionary approach to AI-assisted development. By leveraging:

- **Specialized Expertise**: Domain-specific agents for optimal performance
- **Context Isolation**: Clean separation of concerns
- **MCP Integration**: Access to external tools and data
- **Intelligent Coordination**: Automatic task routing and orchestration

You can build sophisticated development workflows that scale from simple tasks to complex, multi-stage projects. The combination of Context7 for documentation, Brave Search for research, and specialized coding agents creates a powerful development environment that adapts to your specific needs.

Start with the essential agents, gradually add MCP servers, and iterate on your workflows based on real usage patterns. The ecosystem is rapidly evolving, so stay engaged with the community and continue refining your agent configurations for optimal productivity.