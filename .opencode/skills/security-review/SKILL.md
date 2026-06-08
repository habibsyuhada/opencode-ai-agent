# Security Review Skill

Check:
- Secrets in source, logs, or docs.
- Injection risks: SQL, command, template, LDAP, NoSQL.
- XSS and unsafe HTML rendering.
- Broken auth/authz and tenant boundary issues.
- CSRF for state-changing browser actions.
- SSRF/file path traversal for URL/file input.
- Error messages leaking internals.
- Dependency vulnerabilities where tooling exists.

If risk exists, produce exact remediation steps and do not mark PASS.
