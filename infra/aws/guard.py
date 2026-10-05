"""Fail closed before deployment: explicit account, active Free plan, credit reserve."""

import argparse
from datetime import datetime, timezone, timedelta
import json
import subprocess


def check(identity, plan, account):
    if identity.get("Account") != account or plan.get("accountId") != account:
        raise ValueError("Wrong AWS account; no deployment permitted")
    if plan.get("accountPlanType") != "FREE" or plan.get("accountPlanStatus") != "ACTIVE":
        raise ValueError("An active Free plan is required; never upgrade automatically")
    credits = plan.get("accountPlanRemainingCredits", {})
    if credits.get("unit") != "USD" or float(credits.get("amount", 0)) < 15:
        raise ValueError("Keep at least $15 in free credits before deploying")
    expiry = datetime.fromisoformat(plan["accountPlanExpirationDate"].replace("Z", "+00:00"))
    if expiry <= datetime.now(timezone.utc) + timedelta(days=7):
        raise ValueError("Free plan expires within seven days; deployment refused")


def verify(account, profile, region):
    def read(*args):
        command = ["aws", "--profile", profile, "--region", region, *args, "--output", "json", "--no-cli-pager"]
        return json.loads(subprocess.check_output(command, text=True))
    identity = read("sts", "get-caller-identity")
    plan = read("freetier", "get-account-plan-state")
    check(identity, plan, account)
    print("Verified Free plan:", account, plan["accountPlanRemainingCredits"], "expires", plan["accountPlanExpirationDate"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--account", required=True)
    parser.add_argument("--profile", default="budget-buddy")
    parser.add_argument("--region", default="us-east-2")
    args = parser.parse_args()
    verify(args.account, args.profile, args.region)
