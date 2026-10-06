#!/usr/bin/env python3
"""Read a fixed users query through SSM; produce a private local HTML snapshot.

No database password, public database port, web server, or paid service needed.
Run again to refresh. Never returns hashes, auth tokens, or bank credentials.
"""
import datetime
import html
import json
import os
from pathlib import Path
import subprocess
import time

AWS = ["aws", "--profile", "budget-buddy", "--region", "us-east-2", "--no-cli-pager"]
INSTANCE = "i-09f610d343528349e"
ACCOUNT = "455012390237"
ROOT = Path(__file__).resolve().parents[2]
SQL = """SELECT json_build_object(
  'total', (select count(*) from users),
  'users', coalesce(json_agg(row_to_json(u)), '[]'::json))
FROM (SELECT email, first_name, last_name, created_at,
             email_verified_at IS NOT NULL AS verified, onboarding_complete
      FROM users ORDER BY created_at DESC LIMIT 50) u;"""


def aws(*args):
    result = subprocess.run(AWS + list(args) + ["--output", "json"],
                            text=True, capture_output=True, timeout=45)
    if result.returncode:
        raise RuntimeError("AWS request failed. Check your budget-buddy CLI login and permissions.")
    return json.loads(result.stdout)


def fetch_users():
    if aws("sts", "get-caller-identity")["Account"] != ACCOUNT:
        raise RuntimeError("Wrong AWS account; query refused.")
    # Default read-only at the database session level, not just a SELECT convention.
    command = "docker exec -i -e PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=5000' budget-buddy-pilot-db-1 psql -X -qAt -v ON_ERROR_STOP=1 -U budget_buddy -d budget_buddy <<'SQL'\n" + SQL + "\nSQL"
    response = aws("ssm", "send-command", "--instance-ids", INSTANCE,
                   "--document-name", "AWS-RunShellScript", "--comment", "Read-only user directory snapshot",
                   "--parameters", json.dumps({"commands": [command]}))
    command_id = response["Command"]["CommandId"]
    for _ in range(30):
        time.sleep(2)
        try:
            status = aws("ssm", "get-command-invocation", "--command-id", command_id,
                         "--instance-id", INSTANCE)
        except RuntimeError:
            continue
        if status["Status"] == "Success":
            return json.loads(status["StandardOutputContent"])
        if status["Status"] in {"Failed", "Cancelled", "TimedOut"}:
            raise RuntimeError("The read-only server query failed. No user data was changed.")
    raise RuntimeError("Timed out reading users. Run again later.")


def render(data):
    esc = lambda value: html.escape(str(value or ""), quote=True)
    rows = "".join("<tr>" + "".join("<td>" + esc(value) + "</td>" for value in [
        row["email"], (row["first_name"] + " " + row["last_name"]).strip(),
        "Verified" if row["verified"] else "Pending", "Complete" if row["onboarding_complete"] else "In progress",
        row["created_at"]]) + "</tr>" for row in data["users"])
    if not rows:
        rows = '<tr><td colspan="5">No registered users in the AWS database yet.</td></tr>'
    generated = datetime.datetime.now().astimezone().strftime("%b %d, %Y at %I:%M %p %Z")
    return f"""<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>Budget Buddy · AWS users</title>
<style>body{{font:16px system-ui,sans-serif;background:#f5f8f5;color:#15251b;margin:40px auto;max-width:1100px;padding:0 24px}}
h1{{font-size:32px;margin-bottom:6px}}p{{color:#526359;line-height:1.6}}.count{{font-size:24px;font-weight:700;margin:28px 0}}
.table{{overflow:auto;border:1px solid #d6e2d8;border-radius:12px;background:white}}table{{border-collapse:collapse;width:100%}}th,td{{text-align:left;padding:15px;border-bottom:1px solid #e7eee8}}th{{background:#eaf4ec;font-size:13px}}td{{font-size:14px}}code{{font-size:14px}}</style>
<h1>Budget Buddy users</h1><p>AWS pilot database · Read-only snapshot · {esc(generated)}</p>
<div class="count">{int(data['total'])} registered users</div>
<div class="table"><table><thead><tr><th>Email</th><th>Name</th><th>Email status</th><th>Onboarding</th><th>Registered (UTC)</th></tr></thead><tbody>{rows}</tbody></table></div>
<p>Showing the latest {len(data['users'])} registrations (up to 50). Double-click <code>View AWS Users.command</code> to fetch a fresh snapshot.
Local Docker accounts are separate. This file stays on your Mac and contains personal data; do not share it publicly.</p></html>"""


def main():
    os.umask(0o077)
    data = fetch_users()
    directory = ROOT / ".cache" / "admin"
    directory.mkdir(parents=True, exist_ok=True)
    directory.chmod(0o700)
    output = directory / "aws-users.html"
    temporary = output.with_suffix(".tmp")
    temporary.write_text(render(data))
    temporary.chmod(0o600)
    temporary.replace(output)
    print(f"Loaded {len(data['users'])} of {data['total']} users from AWS. Saved private read-only viewer: {output}")


if __name__ == "__main__":
    main()
