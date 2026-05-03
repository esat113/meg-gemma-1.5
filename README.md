# MedGemma Anamnez Web Uygulaması

Doktor gözetiminde kullanılmak üzere MedGemma destekli tıbbi anamnez ve klinik karar destek MVP'si.

## Ön Koşullar

- Docker Compose
- NVIDIA driver
- NVIDIA Container Toolkit
- Hugging Face hesabında MedGemma erişim koşullarının kabul edilmiş olması
- `HF_TOKEN`
- MedGemma/Gemma3 inference için backend image PyTorch `2.6.0` ve Transformers `4.57.1` kullanır.
- Model çıktısını yönlendiren kurum/klinik kuralları `backend/prompts/clinical_rules.md` dosyasından okunur.

GPU erişimini sunucuda kontrol edin:

```bash
docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi
```

## Kurulum

```bash
cd medgemma-app
cp .env.example .env
# .env içindeki HF_TOKEN değerini doldurun
```

Mock modda hızlı smoke test:

```bash
MOCK_MODEL=true docker compose up --build
```

Bu makinedeki indirilmiş lokal model ile çalıştırma:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Varsayılan olarak Docker, repo'nun bir üst klasöründeki `../medgemma-1.5-4b-it` dizinini container içine read-only mount eder. Bu klasör geçerli model dosyalarını içeriyorsa backend Hugging Face'e gitmeden lokal modeli kullanır.

Farklı bir host model yolu kullanmak için `.env` içinde ayarlayın:

```bash
LOCAL_MODEL_HOST_PATH=/absolute/path/to/medgemma-1.5-4b-it
LOCAL_MODEL_PATH=/models/medgemma-1.5-4b-it
```

Sunucuda lokal model klasörü yoksa Hugging Face'den indirme:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Adresler:

- Frontend: http://localhost:3000
- Backend health: http://localhost:8080/api/health

Sunucuya uzaktan erişilecekse `.env` içindeki `VITE_API_URL` değerini tarayıcının erişebileceği backend adresine ayarlayın.

İlk gerçek model başlatmasında model Hugging Face'den indirilir. Cache `huggingface_cache` volume içinde tutulur.
Lokal model klasörü geçerliyse `HF_TOKEN` gerekmez. Lokal model yoksa veya boşsa `HF_TOKEN` zorunludur.

## Model Çıktı Kuralları

Modelin hangi çerçevede rapor üreteceğini düzenlemek için:

```bash
nano backend/prompts/clinical_rules.md
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Örnek eklenebilecek kurallar:

- Belirli klinik kırmızı bayrakları her zaman acil bölümünde yaz.
- Olası durumlarda kardiyak nedenleri aile öyküsü varsa üst sıraya al.
- Reçete, doz ve ilaç kesme/başlatma önerisi verme.
- Raporu hasta dilinde, kısa paragraflar ve maddelerle yaz.

Varsayılan çıktı token ayarları küçük limit olmayacak şekilde geniş tutulur:

```bash
PHASE1_MAX_NEW_TOKENS=2048
FINAL_MAX_NEW_TOKENS=8192
```

## Üretim Notları

- Auth yoktur. Bu uygulamayı public internete doğrudan açmayın.
- VPN, klinik iç ağı, IP allowlist veya reverse proxy erişim kısıtı kullanın.
- Yüklenen tıbbi dosyalar ve hasta kayıtları kalıcı tutulur.
- Dosyalar uygulama seviyesinde şifrelenmez.
- Hasta verisi ve dosya içeriği loglanmaz.

## Geliştirme

Backend mock mod:

```bash
cd backend
MOCK_MODEL=true DATABASE_URL=sqlite+pysqlite:///./dev.db uvicorn main:app --reload --port 8080
```

Frontend:

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

## Kaynaklar

- https://developers.google.com/health-ai-developer-foundations/medgemma
- https://huggingface.co/google/medgemma-1.5-4b-it
