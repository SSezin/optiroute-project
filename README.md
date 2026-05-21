# Logistics Network Optimizer (Lojistik Dağıtım Ağı Optimizasyon Aracı)

Bu proje, tedarik zinciri ve lojistik ağlarının optimizasyonu için geliştirilmiş, maliyet ve çevresel sürdürülebilirliği (karbon ayak izi) bir arada değerlendiren karar destek sistemidir.

## 🌟 Temel Özellikler

- **Çift Yönlü Optimizasyon:** Kullanıcılar ağı optimize ederken ister **Maliyet Odaklı (Cost)** ister **Çevre Odaklı (CO2 Emisyonu)** hedef fonksiyonunu seçebilirler.
- **Dinamik Harita Arayüzü:** Leaflet.js tabanlı etkileşimli harita üzerinde yeni depolar (warehouses) ve perakendeciler (retailers) eklenebilir, mevcut olanların konumları değiştirilebilir.
- **Gerçek Karayolu Mesafeleri:** Teslimat mesafeleri kuş uçuşu değil, **OSRM API** kullanılarak gerçek karayolu rotalarına göre hesaplanır. (API'ye ulaşılamaması durumunda akıllı Haversine formülü yedeği devreye girer).
- **Detaylı Tesis Yönetimi:** Depolar için sabit maliyet, sabit CO2 emisyonu ve kapasite kısıtları tanımlanabilir. Ayrıca depolar "Zorunlu Açık" veya "Zorunlu Kapalı" olarak manuel olarak işaretlenebilir.
- **Gelişmiş Sonuç Paneli:** Optimizasyon sonrası toplam maliyet, ulaşım maliyetleri, toplam CO2 salınımı detaylıca raporlanır. Ayrıca çevresel farkındalık için üretilen karbonu dengelemek adına **"Dikilmesi Gereken Ağaç Sayısı"** hesaplanır.
- **Modern ve Duyarlı UI:** "Glassmorphism" tasarımıyla geliştirilmiş, mobil cihazlarla uyumlu şık bir kullanıcı arayüzü sunar.

## 🛠 Kullanılan Teknolojiler

- **Backend:** Python 3, FastAPI, Uvicorn
- **Optimizasyon Motoru:** PuLP (Karışık Tam Sayılı Doğrusal Programlama / MILP)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Harita ve API'ler:** Leaflet.js, OpenStreetMap, OSRM (Open Source Routing Machine) API

## 🚀 Kurulum ve Çalıştırma

Projeyi yerel bilgisayarınızda çalıştırmak için aşağıdaki adımları izleyin:

### 1. Backend (Sunucu) Kurulumu
Backend Python tabanlıdır ve FastAPI kullanır.

1. Terminali açın ve `backend` klasörüne gidin:
   ```bash
   cd backend
   ```
2. Gerekli kütüphaneleri yükleyin:
   ```bash
   pip install -r requirements.txt
   ```
3. Sunucuyu başlatın:
   ```bash
   uvicorn main:app --reload
   ```
   *Sunucu varsayılan olarak `http://127.0.0.1:8000` adresinde çalışacaktır.*

### 2. Frontend (İstemci) Kurulumu
Frontend tamamen statik dosyalardan oluşur (HTML, CSS, JS).

1. `frontend` klasörünün içine gidin.
2. Herhangi bir derlemeye ihtiyaç yoktur. `index.html` dosyasını doğrudan bir web tarayıcısında (Chrome, Firefox vb.) açmanız yeterlidir.
3. *Tavsiye:* Eğer VS Code kullanıyorsanız, "Live Server" veya benzeri bir eklentiyle projeyi başlatmanız daha sağlıklı bir deneyim sunar. 
   *(Not: Live Server kullandığınızda arayüz genellikle `http://localhost:3000` veya `http://127.0.0.1:5500` üzerinde açılacaktır. Arayüzün sorunsuz çalışması için arka plandaki Python sunucusunun da 8000 portunda çalışır durumda olduğundan emin olun.)*

## 📌 Kullanım Senaryosu
1. Uygulama açıldığında sol panelden **"Maliyet (Cost)"** veya **"Karbon Emisyonu (CO2)"** odaklı optimizasyon hedefini seçin.
2. Harita üzerinden mevcut depoların ve perakendecilerin üzerine tıklayarak kapasite, talep veya zorunlu durum ayarlarını güncelleyin.
3. Sağ üstteki **"Optimizasyonu Çalıştır"** butonuna tıklayın.
4. Ağın en verimli hali harita üzerinde rotalar çizilerek gösterilecek ve sol paneldeki sonuç ekranında tüm detaylar (Maliyet, CO2, Ağaç Sayısı) belirecektir.
