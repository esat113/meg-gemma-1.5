import re
from typing import Any

from services.medgemma_service import DISCLAIMER


SECTION_MARKERS = (
    "summary",
    "possible conditions",
    "recommendations",
    "lifestyle",
    "diet",
    "monitoring",
    "when to seek care",
    "disclaimer",
)


def clean_model_text(text: str) -> str:
    text = re.sub(r"<unused\d+>\s*thought\\?n?", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<unused\d+>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"```(?:json)?|```", " ", text, flags=re.IGNORECASE)
    text = text.replace("\\n", "\n")
    text = re.sub(r"\*\*", "", text)
    text = re.sub(r"\s+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)

    # If the model echoed its internal planning, keep only the patient-facing part.
    matches = list(re.finditer(r"(?:^|\n)\s*(?:\d+\.\s*)?summary\s*:", text, flags=re.IGNORECASE))
    if matches:
        text = text[matches[-1].start() :]
    else:
        marker = re.search(r"phase\s*2\s*(?:content generation|final analysis|task)\s*:?", text, flags=re.IGNORECASE)
        if marker:
            text = text[marker.end() :]

    return text.strip(" \n\t:-")


def _section(text: str, start: str, stops: tuple[str, ...]) -> str:
    stop_pattern = "|".join(re.escape(stop) for stop in stops)
    pattern = rf"{re.escape(start)}\s*:?\s*(.*?)(?=\n?\s*(?:\d+\.\s*)?(?:{stop_pattern})\s*:|\Z)"
    match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
    return _clean_value(match.group(1)) if match else ""


def _clean_value(value: str) -> str:
    value = re.sub(r"^\s*[-*]\s*", "", value, flags=re.MULTILINE)
    value = re.sub(r"\s+", " ", value)
    return value.strip(" \n\t:-")


def _sentences(value: str, limit: int = 4) -> str:
    parts = re.split(r"(?<=[.!?])\s+", value.strip())
    return " ".join(part for part in parts[:limit] if part).strip()


def _list_from_section(value: str) -> list[str]:
    if not value:
        return []
    raw_items = re.split(r"(?:\n\s*[-*]\s+)|(?:\s+\*\s+)|(?:;\s+)", value)
    items = [_clean_value(item) for item in raw_items if _clean_value(item)]
    if len(items) <= 1:
        sentences = re.split(r"(?<=[.!?])\s+", value)
        items = [_clean_value(sentence) for sentence in sentences if len(_clean_value(sentence)) > 12]
    return items[:8]


def _conditions(value: str) -> list[dict[str, str]]:
    if not value:
        return []

    candidates = re.split(r"\s+(?=(?:Arrhythmias|Anxiety|Structural|Substance|Thyroid|Electrolyte|Other|[A-ZÇĞİÖŞÜ][\wÇĞİÖŞÜçğıöşü\s/-]{3,50})\s*(?:\(|:))", value)
    result: list[dict[str, str]] = []
    for candidate in candidates:
        item = _clean_value(candidate)
        if not item:
            continue
        name_match = re.match(r"([^:.]{3,90})(?::|\.)?\s*(.*)", item)
        if not name_match:
            continue
        name = _clean_value(name_match.group(1))
        explanation = _clean_value(name_match.group(2)) or item
        if len(name) > 90 or name.lower() in SECTION_MARKERS:
            continue
        result.append({"name": name, "likelihood": "medium", "explanation": _sentences(explanation, 3)})
        if len(result) >= 6:
            break
    return result


def report_from_raw_text(raw_text: str, emergency: tuple[bool, str | None]) -> dict[str, Any]:
    text = clean_model_text(raw_text)
    summary = _section(text, "Summary", ("Possible Conditions", "Recommendations", "Disclaimer"))
    possible = _section(text, "Possible Conditions", ("Recommendations", "Lifestyle", "Diet", "Monitoring", "When to Seek Care", "Disclaimer"))
    recommendations = _section(text, "Recommendations", ("Disclaimer",))
    lifestyle = _section(text, "Lifestyle", ("Diet", "Monitoring", "When to Seek Care", "Disclaimer"))
    diet = _section(text, "Diet", ("Monitoring", "When to Seek Care", "Disclaimer"))
    monitoring = _section(text, "Monitoring", ("When to Seek Care", "Disclaimer"))
    seek_care = _section(text, "When to Seek Care", ("Disclaimer",))

    if not summary:
        summary = _sentences(text, 5) or "Model yapılandırılmış rapor üretemedi; hekim değerlendirmesi önerilir."

    if not lifestyle and recommendations:
        lifestyle = recommendations

    is_emergency, rule_message = emergency
    return {
        "patient_profile": None,
        "generated_at": None,
        "summary": summary,
        "clinical_reasoning": [
            "Model yapılandırılmış JSON yerine serbest metin ürettiği için rapor bölümleri güvenli biçimde ayrıştırıldı.",
            "Özet, olası durumlar ve öneriler hastanın sağladığı anamnez ve ek yanıtlarla birlikte hekim değerlendirmesine destek amacıyla kullanılmalıdır.",
        ],
        "possible_conditions": _conditions(possible),
        "recommendations": {
            "lifestyle": _list_from_section(lifestyle),
            "diet": _list_from_section(diet),
            "monitoring": _list_from_section(monitoring) or ["Belirtileri takip edin ve kötüleşme olursa sağlık profesyoneline başvurun."],
            "when_to_seek_care": seek_care or "Kırmızı bayrak belirtileri veya hızlı kötüleşme varsa acil değerlendirme alın.",
        },
        "evidence": [],
        "is_emergency": is_emergency,
        "emergency_message": rule_message,
        "disclaimer": DISCLAIMER,
    }
