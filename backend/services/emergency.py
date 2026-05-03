from models.schemas import MedicalHistory


EMERGENCY_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("göğüs ağrısı", "nefes darlığı"),
        "Göğüs ağrısı ve nefes darlığı birlikte bildirildi. Acil tıbbi değerlendirme gerekir.",
    ),
    (
        ("chest pain", "shortness of breath"),
        "Chest pain with shortness of breath was reported. Urgent medical evaluation is required.",
    ),
    (
        ("felç",),
        "Felç/inme düşündürebilecek ifade bildirildi. Acil yardım alınmalıdır.",
    ),
    (
        ("konuşma bozukluğu", "yüzde kayma"),
        "İnme açısından kırmızı bayrak olabilecek belirtiler bildirildi. Acil yardım alınmalıdır.",
    ),
    (
        ("şiddetli alerji",),
        "Şiddetli alerjik reaksiyon olasılığı bildirildi. Acil tıbbi değerlendirme gerekir.",
    ),
)


def check_emergency(history: MedicalHistory) -> tuple[bool, str | None]:
    text = " ".join(
        [
            history.chief_complaint,
            history.extra_notes or "",
            " ".join(history.symptoms),
        ]
    ).lower()

    for terms, message in EMERGENCY_RULES:
        if all(term in text for term in terms):
            return True, message

    if history.severity >= 9 and any(
        symptom.lower() in {"nefes darlığı", "göğüs ağrısı", "bayılma", "chest pain", "shortness of breath"}
        for symptom in history.symptoms
    ):
        return True, "Çok yüksek şiddette kırmızı bayrak belirtisi bildirildi. Acil değerlendirme önerilir."

    return False, None
