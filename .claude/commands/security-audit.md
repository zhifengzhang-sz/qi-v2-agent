---
name: security-audit
description: Comprehensive security assessment workflow using security and quality specialists
---

Perform comprehensive security audit: $ARGUMENTS

## Multi-Agent Security Workflow

### 1. Initial Assessment
- Use the **security-auditor** agent to conduct OWASP Top 10 vulnerability assessment
- Use the **code-reviewer** agent to identify security code smells and anti-patterns
- Use context7 for latest security standards and CVE databases

### 2. Architecture Review
- Use the **cloud-architect** agent to review infrastructure security
- Use the **backend-developer** agent to assess API security and authentication
- Use the **database-specialist** agent to review data security and encryption

### 3. Application Security Testing
- Use the **security-auditor** agent to perform:
  - Static Application Security Testing (SAST)
  - Dynamic Application Security Testing (DAST)
  - Dependency vulnerability scanning
  - Configuration security review

### 4. Performance Security Analysis
- Use the **performance-optimizer** agent to identify performance-based security issues
- Analyze for timing attacks, resource exhaustion, and DDoS vulnerabilities

### 5. Infrastructure Security
- Use the **devops-engineer** agent to review CI/CD security
- Use the **cloud-architect** agent to assess cloud security configurations
- Review container security and orchestration setup

### 6. Data Protection Assessment
- Use the **database-specialist** agent to review data encryption and access controls
- Use the **data-scientist** agent to assess data privacy and compliance (GDPR, CCPA)

### 7. Documentation & Reporting
- Use the **documentation-specialist** agent to create:
  - Security assessment report
  - Remediation plan with priorities
  - Security best practices documentation
  - Incident response procedures

## Deliverables
- ✅ OWASP compliance assessment
- ✅ Vulnerability report with CVSS scores
- ✅ Infrastructure security review
- ✅ Remediation roadmap with timelines
- ✅ Security policies and procedures
- ✅ Continuous security monitoring setup