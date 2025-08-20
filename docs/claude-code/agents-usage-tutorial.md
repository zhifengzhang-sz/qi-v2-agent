# Claude Code Agents Usage Tutorial

> **Complete guide to using the 17 specialized agents and 4 multi-agent workflows in the qi-v2-agent project**

## Table of Contents
- [Quick Start](#quick-start)
- [Agent Categories](#agent-categories)
- [Individual Agent Usage](#individual-agent-usage)
- [Multi-Agent Workflows](#multi-agent-workflows)
- [Best Practices](#best-practices)
- [Real-World Examples](#real-world-examples)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites
✅ **Already Set Up for qi-v2-agent:**
- Claude Code installed and configured
- 17 specialized agents in `.claude/agents/`
- 4 custom workflows in `.claude/commands/`
- MCP servers: Brave Search + Context7

### Basic Usage Patterns
```bash
# Individual agent usage
> Use the [agent-name] agent to [specific task]

# Multi-agent workflows
> /[workflow-name] [description of what you want to achieve]

# List available resources
> /agents list
> /commands
```

## Agent Categories

### 🔧 Development (3 agents)
| Agent | Use Case | Key Strengths |
|-------|----------|---------------|
| `frontend-developer` | React, Vue, Angular, UI/UX | Modern frameworks, responsive design, performance |
| `backend-developer` | APIs, databases, microservices | Scalable architecture, security, optimization |
| `typescript-expert` | Type systems, migrations, advanced patterns | Type safety, DX optimization, complex types |

### 🛡️ Quality (3 agents)  
| Agent | Use Case | Key Strengths |
|-------|----------|---------------|
| `code-reviewer` | Code quality, best practices | Comprehensive reviews, actionable feedback |
| `security-auditor` | OWASP, vulnerabilities, compliance | Security testing, threat modeling, audits |
| `performance-optimizer` | Profiling, optimization, scaling | Bottleneck analysis, load testing, monitoring |

### 🏗️ Infrastructure (3 agents)
| Agent | Use Case | Key Strengths |
|-------|----------|---------------|
| `devops-engineer` | CI/CD, containerization, deployment | Automation, monitoring, reliability |
| `database-specialist` | Schema design, query optimization | Performance tuning, scaling strategies |
| `cloud-architect` | Distributed systems, serverless | Multi-cloud, cost optimization, resilience |

### 🤖 AI/ML (2 agents)
| Agent | Use Case | Key Strengths |
|-------|----------|---------------|
| `ml-engineer` | MLOps, model deployment, production AI | Model serving, monitoring, optimization |
| `data-scientist` | Statistical analysis, research, BI | Data analysis, modeling, business insights |

### 📊 Product (2 agents)
| Agent | Use Case | Key Strengths |
|-------|----------|---------------|
| `product-manager` | Requirements, roadmaps, stakeholder mgmt | User stories, prioritization, strategy |
| `documentation-specialist` | Technical writing, API docs, guides | Clear communication, comprehensive docs |

### 🎯 Project-Specific (4 agents)
| Agent | Use Case | Key Strengths |
|-------|----------|---------------|
| `qicore-specialist` | QiCore patterns, functional programming | Result<T>, error handling, architecture |
| `classification-expert` | Input classification, LLM integration | Structured output, method optimization |
| `bun-runtime-specialist` | Bun optimization, TypeScript, builds | Performance, path resolution, deployment |
| `agent-workflow-designer` | Multi-agent coordination, SubAgents | Workflow orchestration, coordination |

## Individual Agent Usage

### Development Tasks

#### Frontend Development
```bash
# Component creation
> Use the frontend-developer agent to create a responsive React dashboard component with TypeScript

# Performance optimization
> Use the frontend-developer agent to optimize Core Web Vitals for the user profile page

# Framework migration
> Use the frontend-developer agent to migrate this jQuery code to modern React with hooks
```

#### Backend Development
```bash
# API design
> Use the backend-developer agent to design a REST API for user authentication with JWT

# Database integration
> Use the backend-developer agent to implement connection pooling for PostgreSQL

# Microservices architecture
> Use the backend-developer agent to break down this monolithic service into microservices
```

#### TypeScript Expertise
```bash
# Advanced types
> Use the typescript-expert agent to create branded types for user IDs and order IDs

# Migration assistance
> Use the typescript-expert agent to migrate this JavaScript codebase to TypeScript

# Performance optimization
> Use the typescript-expert agent to optimize TypeScript compilation for this large codebase
```

### Quality Assurance Tasks

#### Code Review
```bash
# Comprehensive review
> Use the code-reviewer agent to review this authentication module for security and best practices

# Performance analysis
> Use the code-reviewer agent to identify performance bottlenecks in this React component

# Architecture assessment
> Use the code-reviewer agent to evaluate the overall architecture of this microservices setup
```

#### Security Auditing
```bash
# OWASP assessment
> Use the security-auditor agent to perform OWASP Top 10 vulnerability assessment

# API security review
> Use the security-auditor agent to review this GraphQL API for security vulnerabilities

# Infrastructure security
> Use the security-auditor agent to audit our Kubernetes deployment for security best practices
```

#### Performance Optimization
```bash
# Database optimization
> Use the performance-optimizer agent to analyze and optimize these slow PostgreSQL queries

# Frontend performance
> Use the performance-optimizer agent to improve the Lighthouse scores for our landing page

# Load testing
> Use the performance-optimizer agent to design a load testing strategy for our API
```

### Infrastructure Tasks

#### DevOps Engineering
```bash
# CI/CD pipeline
> Use the devops-engineer agent to create a GitHub Actions pipeline for automated testing and deployment

# Monitoring setup
> Use the devops-engineer agent to implement comprehensive monitoring with Prometheus and Grafana

# Container optimization
> Use the devops-engineer agent to optimize our Docker images for faster builds and smaller size
```

#### Database Management
```bash
# Schema optimization
> Use the database-specialist agent to design an efficient schema for our e-commerce product catalog

# Migration strategy
> Use the database-specialist agent to plan a zero-downtime migration from MySQL to PostgreSQL

# Performance tuning
> Use the database-specialist agent to optimize this database for 100k concurrent users
```

#### Cloud Architecture
```bash
# Multi-cloud strategy
> Use the cloud-architect agent to design a multi-cloud architecture for high availability

# Serverless migration
> Use the cloud-architect agent to migrate our monolithic application to serverless architecture

# Cost optimization
> Use the cloud-architect agent to analyze and reduce our AWS costs by 30%
```

### Project-Specific Tasks

#### QiCore Development

> ⚠️ **CRITICAL LIMITATION: qicore-specialist reliability issues**
> 
> The qicore-specialist agent has proven unreliable for concrete code analysis, frequently fabricating violations that don't exist in actual files. While it has solid QiCore theoretical knowledge, it should **NOT** be used for:
> - ❌ Analyzing existing code for violations
> - ❌ Finding specific QiCore compliance issues  
> - ❌ Auditing file contents for patterns
> 
> **Alternative approaches for QiCore work:**
> - ✅ Read `app/docs/qicore/` documentation directly
> - ✅ Use `bun run check` for quality verification
> - ✅ Direct code examination and manual QiCore pattern application
> - ✅ Ask qicore-specialist conceptual questions only ("How should I implement two-layer architecture?")

```bash
# UNRELIABLE - avoid for code analysis:
# > Use the qicore-specialist agent to review this classification implementation for QiCore compliance

# RELIABLE alternatives:
# 1. Conceptual guidance only
> Use the qicore-specialist agent to explain the correct two-layer architecture pattern for external APIs

# 2. Manual implementation with documentation
> Read app/docs/qicore/tutorial.md and manually apply Result<T> patterns to this code

# 3. Quality verification
> Run 'bun run check' to verify QiCore implementation quality
```

#### Classification System
```bash
# Method optimization
> Use the classification-expert agent to improve the accuracy of our input classification system

# Schema design
> Use the classification-expert agent to create an optimized schema for workflow classification

# LLM integration
> Use the classification-expert agent to integrate Claude Sonnet 4 with structured output
```

## Multi-Agent Workflows

### 1. Complete Feature Development
```bash
> /fullstack-feature user profile management system

# This orchestrates:
# 1. product-manager → Requirements analysis
# 2. backend-developer → API design
# 3. frontend-developer → UI implementation
# 4. typescript-expert → Type safety
# 5. security-auditor → Security review
# 6. code-reviewer → Quality assurance
# 7. devops-engineer → Deployment pipeline
```

### 2. Security Assessment
```bash
> /security-audit complete application security review

# This orchestrates:
# 1. security-auditor → OWASP assessment
# 2. code-reviewer → Security code review
# 3. cloud-architect → Infrastructure security
# 4. database-specialist → Data security
# 5. documentation-specialist → Security documentation
```

### 3. Performance Optimization
```bash
> /performance-optimization API response times under 100ms

# This orchestrates:
# 1. performance-optimizer → Baseline analysis
# 2. backend-developer → API optimization
# 3. database-specialist → Query optimization
# 4. frontend-developer → UI performance
# 5. cloud-architect → Infrastructure scaling
# 6. devops-engineer → Monitoring setup
```

### 4. ML Integration
```bash
> /ml-integration recommendation engine for user preferences

# This orchestrates:
# 1. data-scientist → Data analysis
# 2. ml-engineer → Model development
# 3. backend-developer → API integration
# 4. cloud-architect → ML infrastructure
# 5. security-auditor → Model security
# 6. documentation-specialist → ML documentation
```

## Best Practices

### 1. Agent Selection
- **Specific tasks**: Use individual agents for focused work
- **Complex projects**: Use multi-agent workflows for coordination
- **Unknown scope**: Start with product-manager agent for analysis

### 2. Task Description
- **Be specific**: "Create a React component with TypeScript" vs "Help with frontend"
- **Include context**: Reference existing code, constraints, requirements
- **Set expectations**: Performance targets, security requirements, deadlines

### 3. Multi-Agent Coordination
- **Sequential tasks**: When output of one agent feeds into another
- **Parallel tasks**: When multiple agents can work independently
- **Review cycles**: Use code-reviewer and security-auditor for validation

### 4. Context Management
- **Project awareness**: Agents understand qi-v2-agent architecture
- **Tool integration**: Leverage context7 for latest documentation
- **Result patterns**: Follow QiCore functional programming principles

## Real-World Examples

### Example 1: Adding Authentication
```bash
# Step 1: Requirements analysis
> Use the product-manager agent to analyze requirements for JWT-based authentication

# Step 2: Security design
> Use the security-auditor agent to create a threat model for authentication system

# Step 3: Backend implementation
> Use the backend-developer agent to implement JWT authentication with refresh tokens

# Step 4: Frontend integration
> Use the frontend-developer agent to create login/register components with proper error handling

# Step 5: Type safety
> Use the typescript-expert agent to create type-safe authentication state management

# Step 6: Review and deployment
> Use the code-reviewer agent to review the complete authentication implementation
> Use the devops-engineer agent to set up secure deployment with environment variables
```

### Example 2: Performance Problem
```bash
# Use the performance-optimizer agent to analyze why our API response times increased from 200ms to 2s

# Follow-up based on findings:
> Use the database-specialist agent to optimize the slow queries identified in the performance analysis
> Use the cloud-architect agent to implement caching strategy for frequently accessed data
```

### Example 3: QiCore Migration
```bash
# Use the qicore-specialist agent to migrate this error handling code from try/catch to Result<T> patterns

# Follow-up:
> Use the typescript-expert agent to ensure all types are properly defined for the Result<T> implementation
> Use the code-reviewer agent to verify QiCore compliance across the entire module
```

## Troubleshooting

### Common Issues

#### Agent Not Responding Appropriately
```bash
# Check agent availability
> /agents list

# Use explicit agent invocation
> Use the [specific-agent] agent to [detailed task description]

# Provide more context
> Use the backend-developer agent to create a REST API for user management. 
  The project uses Express.js, PostgreSQL, and JWT authentication. 
  Follow RESTful conventions and include proper error handling.
```

#### Workflow Not Starting
```bash
# Check available workflows
> /commands

# Use explicit workflow command
> /fullstack-feature [detailed description]

# Break down into individual agents if workflow fails
> Use the product-manager agent to analyze requirements for [your feature]
```

#### Context Issues
```bash
# Provide project context
> Use the qicore-specialist agent to review this code. 
  This is part of the qi-v2-agent classification system using Result<T> patterns.

# Reference specific files
> Use the typescript-expert agent to improve types in lib/src/classifier/
```

### Performance Tips

1. **Batch Related Tasks**: Group similar tasks for the same agent
2. **Use Workflows**: For multi-step processes, workflows are more efficient
3. **Provide Context**: More context = better results, fewer follow-ups
4. **Leverage Project Specialists**: Use project-specific agents for qi-v2-agent tasks

### Getting Help

```bash
# List all available agents
> /agents list

# List all available workflows  
> /commands

# Get help with Claude Code
> /help

# Check agent performance
> Use the agent-workflow-designer agent to analyze and optimize our current agent usage patterns
```

---

## Summary

With 17 specialized agents and 4 multi-agent workflows, you have a comprehensive AI development team at your disposal. Start with individual agents for focused tasks, use workflows for complex coordination, and leverage the project-specific agents for qi-v2-agent development.

**Key Success Factors:**
- ✅ Be specific in task descriptions  
- ✅ Use appropriate agents for each domain
- ✅ Leverage multi-agent workflows for complex projects
- ✅ Follow QiCore patterns with project-specific agents
- ✅ Iterate and refine based on results

Your Claude Code agents are now ready to handle everything from simple code reviews to complete feature development! 🚀