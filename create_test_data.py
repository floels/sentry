#!/usr/bin/env python3
"""
Create 10 issues with 100 events each, all with multivariate tags
Usage: python create_test_data.py
"""

import subprocess

script = """
from sentry.testutils.factories import Factories
from sentry.models import Project
import random

BROWSERS = ["Chrome", "Firefox", "Safari", "Edge", "Opera"]
ENVIRONMENTS = ["production", "staging", "development", "testing"]
COUNTRIES = ["US", "GB", "DE", "FR", "JP", "CA", "AU", "BR"]

project = Project.objects.get(id=1)

for issue_num in range(10):
    # Create different error types to ensure separate issues
    error_types = [
        "TypeError: Cannot read property 'length' of undefined",
        "ReferenceError: $ is not defined",
        "SyntaxError: Unexpected token '}'",
        "RangeError: Maximum call stack size exceeded",
        "URIError: URI malformed",
        "EvalError: Function constructor not available",
        "Network Error: Failed to fetch data",
        "ValidationError: Invalid email format",
        "TimeoutError: Request timed out after 30s",
        "PermissionError: Access denied to resource"
    ]

    message = error_types[issue_num]
    print(f"Creating issue {issue_num + 1}/10: {message}")

    for event_num in range(100):
        event_data = {
            "message": message,
            "level": "error",
            "platform": "javascript",
            "exception": {
                "values": [{
                    "type": message.split(":")[0],
                    "value": message,
                    "stacktrace": {"frames": [{"filename": f"app_{issue_num}.js", "lineno": event_num + 1}]}
                }]
            },
            "tags": {
                "browser.name": random.choice(BROWSERS),
                "environment": random.choice(ENVIRONMENTS),
                "country": random.choice(COUNTRIES),
                "release": f"{random.randint(1,3)}.{random.randint(0,9)}.0"
            },
            "user": {"id": f"user_{event_num % 20 + 1}"}
        }
        Factories.store_event(data=event_data, project_id=project.id)

        if (event_num + 1) % 25 == 0:
            print(f"  Created {event_num + 1}/100 events")

print("✅ Created 10 issues with 100 varied events each")
"""

subprocess.run(["sentry", "django", "shell", "--command", script], timeout=600)
