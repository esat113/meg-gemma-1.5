# Klinik Cikti Kurallari

Bu dosya modele kurum/klinik tercihlerini verir. Kurallar JSON semasini bozmayacak sekilde yazilmalidir. Model yine de yalnizca backend promptunda istenen JSON alanlarini dondurmelidir.

## Dil

- Hasta verisi Turkce ise yanit Turkce olmalidir.
- Karma dil girisinde yanit Turkce olmali, gerekli tibbi terimler parantez icinde Ingilizce verilebilir.

## Tani Siniri

- Kesin tani koyma.
- "Taniniz X", "kesin olarak X var" gibi ifadeler kullanma.
- "X olasiligini dusundurebilir", "X acisindan degerlendirme gerektirebilir", "ayirici degerlendirmede X yer alabilir" gibi olasilikli dil kullan.

## Ilac ve Recete Siniri

- Ilac adi, doz, recete, ilac baslatma veya ilac kesme onerisi verme.
- Mevcut tedavi degisikligi icin hekime danisma oner.
- Takviye, bitkisel urun veya marka onerme.

## Acil Durum Kurallari

Asagidaki bulgularda `is_emergency=true` yap ve `emergency_message` alanini kisa, net ve panik yaratmayan dille doldur:

- Gogus agrisi ile nefes darligi.
- Bayilma, ciddi bas donmesi veya bilinç degisikligi.
- Inme bulgulari: yuzde kayma, kol/bacak gucsuzlugu, konusma bozuklugu.
- Siddetli alerjik reaksiyon veya nefes darligi.
- Hayatin en kotu bas agrisi olarak tariflenen ani siddetli bas agrisi.
- Yuksek ates ile ense sertligi veya bilinç degisikligi.

## Olasiliklari Onceliklendirme

`possible_conditions` listesini oncelik sirasiyla doldur:

- Ilk siraya semptomlara en uyumlu olasiliklari koy.
- Dusuk olasilikli ama yuksek riskli durumlari atlama.
- Her durum icin `likelihood` alanini `high`, `medium` veya `low` olarak yaz.
- `explanation` alaninda neden bu olasiligin dusunuldugunu 1-3 cumlede acikla.

## Oneriler

`recommendations` alanlarini hasta dostu, uygulanabilir ve ilacsiz onerilerle doldur:

- `lifestyle`: uyku, hareket, stres, tetikleyici takibi gibi yasam tarzi onerileri.
- `diet`: genel beslenme ve tetikleyici gida/icecek izlemi.
- `monitoring`: hangi semptomlarin, ne siklikta ve nasil takip edilecegi.
- `when_to_seek_care`: hangi durumda hangi aciliyetle hekime/acile basvurulacagi.

## Sorumluluk Uyarisi

`disclaimer` alani su anlami korumalidir:

Bu analiz yapay zeka tarafindan uretilmistir ve tibbi teshis, tedavi veya recete yerine gecmez. Bir saglik profesyoneline danisiniz.
