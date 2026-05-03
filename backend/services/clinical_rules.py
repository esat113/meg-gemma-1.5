import os
from functools import lru_cache


@lru_cache
def get_clinical_rules() -> str:
    path = os.getenv("CLINICAL_RULES_PATH", "/app/prompts/clinical_rules.md")
    if not path or not os.path.exists(path):
        return ""
    with open(path, encoding="utf-8") as rules_file:
        return rules_file.read().strip()
