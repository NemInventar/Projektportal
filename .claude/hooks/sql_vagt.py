"""PreToolUse-vagt for Supabase execute_sql.

execute_sql er tilladt i .claude/settings.json, så almindelige SELECT/INSERT/UPDATE ... WHERE
kører uden prompt. Destruktiv SQL skal stadig godkendes (root CLAUDE.md, "Bed om bekræftelse før"):
DELETE, DROP, TRUNCATE, UPDATE uden WHERE, ALTER ... DROP, GRANT/REVOKE, slukket RLS.
"""
import json
import re
import sys


def strip_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.S)
    return re.sub(r"--[^\n]*", " ", sql)


def reasons(sql: str) -> list[str]:
    s = strip_comments(sql).lower()
    found = []
    for word in ("delete", "drop", "truncate", "grant", "revoke"):
        if re.search(rf"\b{word}\b", s):
            found.append(word.upper())
    if re.search(r"disable\s+row\s+level\s+security", s):
        found.append("RLS slukkes")
    for stmt in s.split(";"):
        if re.search(r"\bupdate\b", stmt) and re.search(r"\bset\b", stmt) and not re.search(r"\bwhere\b", stmt):
            found.append("UPDATE uden WHERE")
            break
    return found


def main() -> None:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    sql = (data.get("tool_input") or {}).get("query") or ""
    hits = reasons(sql)
    if hits:
        print(json.dumps({"hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "ask",
            "permissionDecisionReason": "Destruktiv SQL: " + ", ".join(sorted(set(hits))),
        }}))


if __name__ == "__main__":
    main()
