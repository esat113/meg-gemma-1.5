# PLAN.md: MedGemma Destekli Tıbbi Anamnez Web Uygulaması

## Özet

- React 18 + Vite frontend, FastAPI backend ve Postgres veritabanından oluşan Docker tabanlı MVP üretim sürümü.
- MedGemma backend container içinde GPU'da çalışır; ayrı model servisi yoktur.
- Sunucu ilk açılışta `HF_TOKEN` ile `google/medgemma-1.5-4b-it` modelini indirir ve cache volume'da saklar.
- Auth yoktur. Uygulama yalnızca kapalı ağ, VPN veya reverse proxy erişim kısıtı arkasında çalıştırılmalıdır.
- Hasta profili, anamnez, yüklenen dosyalar, follow-up cevapları ve analiz raporları Postgres + upload volume üzerinde kalıcı tutulur.

## Ana Bileşenler

- `frontend`: production build'i nginx ile servis eder, dış port `3000`.
- `backend`: FastAPI, dosya işleme, Postgres kayıtları ve MedGemma inference, dış port `8080`.
- `postgres`: hasta profilleri, analiz kayıtları ve dosya metadata verisi.
- `docker-compose.gpu.yml`: backend için `gpus: all` ve NVIDIA runtime ortam değişkenleri.

## API

- `POST /api/upload`: JPG, PNG, WEBP, HEIC ve PDF dosyalarını yükler; UUID dosya adıyla saklar, PDF metni çıkarır, görseli normalize eder.
- `POST /api/analyze`: hasta profili, anamnez ve dosya ID'leriyle Phase 1 analiz + 3-5 ek soru üretir.
- `POST /api/complete`: follow-up cevaplarıyla final raporu üretir ve kaydeder.
- `GET /api/patients`: hasta listesini döner.
- `GET /api/patients/{id}`: hasta profilini ve analiz geçmişini döner.
- `GET /api/files/{file_id}`: dosyayı kontrollü endpoint üzerinden servis eder.
- `GET /api/health`: model, mock mode ve GPU durumunu döner.

## Güvenlik Notları

- Dosyalar şifrelenmeden volume'da tutulur; public internet erişimi verilmemelidir.
- Request body, hasta verisi ve dosya içerikleri loglanmaz.
- Upload klasörü static olarak açılmaz.
- Prompt builder, yüklenen doküman metinlerini güvenilmeyen hasta içeriği olarak işaretler.
- Model kesin tanı, reçete veya ilaç dozajı üretmemesi için promptlanır.
- Acil durum kırmızı bayrakları için backend tarafında basit rule-based kontrol de çalışır.

## Testler

- Backend: Pydantic validation, prompt builder, emergency rules, upload işleme ve mock model kontratları.
- Frontend: form validasyonları, dosya yükleme, mock API akışı, final rapor ve PDF export.
- Docker/GPU: mock smoke test, GPU smoke test, `/api/health`, model cache doğrulaması.
