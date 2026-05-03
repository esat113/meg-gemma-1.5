# MedGemma Anamnez Web Uygulaması

Doktor gözetiminde kullanılmak üzere MedGemma destekli tıbbi anamnez ve klinik karar destek MVP'si.

## Ön Koşullar

- Docker Compose
- NVIDIA driver
- NVIDIA Container Toolkit
- Hugging Face hesabında MedGemma erişim koşullarının kabul edilmiş olması
- `HF_TOKEN`

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

GPU ve gerçek model ile çalıştırma:

```bash
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build
```

Adresler:

- Frontend: http://localhost:3000
- Backend health: http://localhost:8080/api/health

Sunucuya uzaktan erişilecekse `.env` içindeki `VITE_API_URL` değerini tarayıcının erişebileceği backend adresine ayarlayın.

İlk gerçek model başlatmasında model Hugging Face'den indirilir. Cache `huggingface_cache` volume içinde tutulur.

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
