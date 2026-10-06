from datetime import datetime, timedelta, timezone
import unittest

from guard import check


class FreePlanGuardTests(unittest.TestCase):
    def plan(self, **updates):
        plan = {"accountId": "123456789012", "accountPlanType": "FREE", "accountPlanStatus": "ACTIVE",
                "accountPlanRemainingCredits": {"amount": 100, "unit": "USD"},
                "accountPlanExpirationDate": (datetime.now(timezone.utc) + timedelta(days=90)).isoformat()}
        return plan | updates

    def test_active_free_plan_is_accepted(self):
        check({"Account": "123456789012"}, self.plan(), "123456789012")

    def test_unsafe_accounts_are_rejected(self):
        cases = [{"accountId": "other"}, {"accountPlanType": "PAID"}, {"accountPlanStatus": "EXPIRED"},
                 {"accountPlanRemainingCredits": {"amount": 14, "unit": "USD"}},
                 {"accountPlanExpirationDate": datetime.now(timezone.utc).isoformat()}]
        for case in cases:
            with self.subTest(case=case), self.assertRaises(ValueError):
                check({"Account": "123456789012"}, self.plan(**case), "123456789012")
        with self.assertRaises(ValueError):
            check({"Account": "other"}, self.plan(), "123456789012")


if __name__ == "__main__":
    unittest.main()
