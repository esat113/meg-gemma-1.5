import asyncio
import json
import os
import re
from typing import Any

from config import Settings
from models.schemas import AnalysisReport, AnalysisResponse


DISCLAIMER = "Bu analiz yapay zeka tarafından üretilmiştir ve tıbbi teşhis yerine geçmez. Bir sağlık profesyoneline danışınız."


def _extract_json(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise ValueError("No JSON object found in model output")
    return json.loads(match.group(0))


class MedGemmaService:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.processor = None
        self.model = None
        self.loaded = False
        self.error: str | None = None
        self.model_source: str | None = None
        self.gpu_available = False
        self.gpu_name: str | None = None
        self.cuda_device_count = 0
        self._lock = asyncio.Lock()

    def load(self) -> None:
        if self.settings.mock_model:
            self.loaded = True
            self.model_source = "mock"
            return

        try:
            import torch
            from transformers import AutoModelForImageTextToText, AutoProcessor

            self.gpu_available = torch.cuda.is_available()
            self.cuda_device_count = torch.cuda.device_count() if self.gpu_available else 0
            self.gpu_name = torch.cuda.get_device_name(0) if self.gpu_available else None
            model_ref = self._resolve_model_ref()
            token = None if self.model_source == "local" else self.settings.hf_token

            self.processor = AutoProcessor.from_pretrained(model_ref, token=token)
            self.model = AutoModelForImageTextToText.from_pretrained(
                model_ref,
                token=token,
                torch_dtype=torch.bfloat16,
                device_map="auto" if self.gpu_available else None,
            )
            if not self.gpu_available:
                self.model = self.model.to("cpu")
            self.loaded = True
            self.error = None
        except Exception as exc:
            self.loaded = False
            self.error = str(exc)

    def _resolve_model_ref(self) -> str:
        local_path = self.settings.local_model_path
        if local_path and self._looks_like_model_dir(local_path):
            self.model_source = "local"
            return local_path

        if not self.settings.hf_token:
            checked = f" Checked LOCAL_MODEL_PATH={local_path!r}." if local_path else ""
            raise RuntimeError(f"HF_TOKEN is required when no valid local model path is available.{checked}")

        self.model_source = "huggingface"
        return self.settings.model_id

    @staticmethod
    def _looks_like_model_dir(path: str) -> bool:
        if not os.path.isdir(path):
            return False
        required = ("config.json", "tokenizer_config.json")
        has_required = all(os.path.exists(os.path.join(path, name)) for name in required)
        has_weights = any(
            name.endswith((".safetensors", ".bin"))
            for name in os.listdir(path)
        )
        return has_required and has_weights

    async def generate_phase1(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        if self.settings.mock_model:
            return self._mock_phase1()
        return await self._generate_json(messages, self.settings.phase1_max_new_tokens)

    async def generate_followup(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        if self.settings.mock_model:
            return self._mock_followup()
        return await self._generate_json(messages, self.settings.phase1_max_new_tokens)

    async def generate_final(self, messages: list[dict[str, Any]]) -> dict[str, Any]:
        if self.settings.mock_model:
            return self._mock_final()
        return await self._generate_json(messages, self.settings.final_max_new_tokens)

    async def _generate_json(self, messages: list[dict[str, Any]], max_new_tokens: int) -> dict[str, Any]:
        if not self.loaded or self.model is None or self.processor is None:
            raise RuntimeError(self.error or "Model is not loaded")

        async with self._lock:
            return await asyncio.to_thread(self._blocking_generate_json, messages, max_new_tokens)

    def _blocking_generate_json(self, messages: list[dict[str, Any]], max_new_tokens: int) -> dict[str, Any]:
        import torch

        inputs = self.processor.apply_chat_template(
            messages,
            add_generation_prompt=True,
            tokenize=True,
            return_dict=True,
            return_tensors="pt",
        ).to(self.model.device, dtype=torch.bfloat16)
        input_len = inputs["input_ids"].shape[-1]

        with torch.inference_mode():
            generation = self.model.generate(**inputs, max_new_tokens=max_new_tokens, do_sample=False)
            generation = generation[0][input_len:]

        decoded = self.processor.decode(generation, skip_special_tokens=True)
        try:
            return _extract_json(decoded)
        except Exception:
            return {"raw_text": decoded}

    def health(self) -> dict[str, Any]:
        if not self.settings.mock_model:
            try:
                import torch

                self.gpu_available = torch.cuda.is_available()
                self.cuda_device_count = torch.cuda.device_count() if self.gpu_available else 0
                self.gpu_name = torch.cuda.get_device_name(0) if self.gpu_available else None
            except Exception:
                pass

        return {
            "status": "ok" if self.loaded else "degraded",
            "mock_model": self.settings.mock_model,
            "model_id": self.settings.model_id,
            "model_source": self.model_source,
            "local_model_path": self.settings.local_model_path,
            "model_loaded": self.loaded,
            "gpu_available": self.gpu_available,
            "gpu_name": self.gpu_name,
            "cuda_device_count": self.cuda_device_count,
            "error": self.error,
        }

    def _mock_phase1(self) -> dict[str, Any]:
        return AnalysisResponse(
            session_id="mock",
            initial_assessment=(
                "Girilen anamnez bilgileri hekim değerlendirmesi için yapılandırılmıştır. "
                "Ek sorular semptomların zamanlamasını, eşlik eden bulguları ve risk düzeyini netleştirmeyi amaçlar."
            ),
            follow_up_questions=[
                {
                    "id": "q1",
                    "question": "Şikayetiniz istirahat halinde de devam ediyor mu?",
                    "options": ["Evet", "Hayır", "Zaman zaman", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Semptomların sürekliliğini değerlendirmek için.",
                },
                {
                    "id": "q2",
                    "question": "Son günlerde ateş, yeni döküntü veya nefes darlığı yaşadınız mı?",
                    "options": ["Ateş", "Döküntü", "Nefes darlığı", "Hiçbiri", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Kırmızı bayrak bulguları taramak için.",
                },
                {
                    "id": "q3",
                    "question": "Belirtilerinizi artıran veya azaltan belirgin bir durum var mı?",
                    "options": ["Hareketle artıyor", "Yemekten sonra artıyor", "Dinlenince azalıyor", "Belirgin değil", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Ayırıcı değerlendirmeyi desteklemek için.",
                },
            ],
        ).model_dump(exclude={"session_id"})

    def _mock_final(self) -> dict[str, Any]:
        return AnalysisReport(
            summary=(
                "Hasta tarafından sağlanan anamnez ve ek cevaplar klinik değerlendirme için özetlenmiştir. "
                "Bulgular kesin tanı koydurmaz; hekim muayenesi ve gerekirse laboratuvar/görüntüleme ile birlikte değerlendirilmelidir."
            ),
            possible_conditions=[
                {
                    "name": "Semptom ilişkili klinik durum",
                    "likelihood": "medium",
                    "explanation": "Mevcut yakınmalar bu olasılığın hekim tarafından değerlendirilmesini gerektirebilir.",
                }
            ],
            recommendations={
                "lifestyle": ["Semptomları ve tetikleyicileri not alın.", "Ağırlaşan belirtilerde değerlendirmeyi geciktirmeyin."],
                "diet": ["Belirtileri artıran yiyecek/içecekleri takip edin."],
                "monitoring": ["Ateş, nefes darlığı, göğüs ağrısı veya hızlı kötüleşme açısından izlem yapın."],
                "when_to_seek_care": "Belirtiler şiddetlenirse, yeni kırmızı bayrak bulguları oluşursa veya endişe varsa sağlık profesyoneline başvurun.",
            },
            is_emergency=False,
            emergency_message=None,
            disclaimer=DISCLAIMER,
        ).model_dump()

    def _mock_followup(self) -> dict[str, Any]:
        return {
            "initial_assessment": (
                "İlk yanıtlar sonrasında ayırıcı değerlendirmeyi netleştirmek için ikinci tur hedefli sorular hazırlanmıştır. "
                "Bu sorular olası klinik durumları birbirinden ayırmaya yardımcı olur."
            ),
            "follow_up_questions": [
                {
                    "id": "r2_q1",
                    "question": "Şikayet sırasında göğüs ağrısı, bayılma hissi veya nefes darlığı eşlik ediyor mu?",
                    "options": ["Göğüs ağrısı", "Bayılma hissi", "Nefes darlığı", "Hiçbiri", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Kardiyak ve acil değerlendirme gerektiren bulguları ayırmak için.",
                },
                {
                    "id": "r2_q2",
                    "question": "Belirtiler kafein, alkol, sigara, stres veya egzersiz sonrası belirginleşiyor mu?",
                    "options": ["Kafein/enerji içeceği", "Alkol/sigara", "Stres", "Egzersiz", "Belirgin tetikleyici yok", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Tetikleyici ve yaşam tarzı ilişkisini değerlendirmek için.",
                },
                {
                    "id": "r2_q3",
                    "question": "Ataklar genellikle ne kadar sürüyor?",
                    "options": ["Saniyeler", "Dakikalar", "Saatler", "Sürekli", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Atak süresi olası nedenleri önceliklendirmeye yardımcı olur.",
                },
                {
                    "id": "r2_q4",
                    "question": "Ailede genç yaşta ani ölüm, ritim bozukluğu veya kalp pili öyküsü var mı?",
                    "options": ["Evet", "Hayır", "Kısmen/bilmiyorum", "Emin değilim / Bilmiyorum"],
                    "clinical_rationale": "Ailesel kardiyak riskleri değerlendirmek için.",
                },
            ],
            "is_emergency": False,
            "emergency_message": None,
        }
