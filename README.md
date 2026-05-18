# 🧪 Cypress E2E Testing - Dashboard Management

## 📖 Tentang Proyek
Proyek ini berisi rangkaian pengujian otomatis (*Automation Testing*) untuk sistem **Dashboard Management**. 

## 🎯 Tujuan Cypress & E2E Testing
Pengujian ini menggunakan pendekatan **End-to-End (E2E) Testing** dengan **Cypress**. Tujuannya adalah menyimulasikan interaksi pengguna asli secara nyata (seperti login, klik tombol, navigasi halaman, dan unduh laporan). Dengan E2E *testing*, kita memastikan seluruh alur sistem berfungsi sempurna dari ujung ke ujung sebelum aplikasi benar-benar digunakan.

## ⚙️ Persyaratan Sistem (Dependencies)
Sebelum menjalankan proyek ini, pastikan sistem kamu sudah terinstal:
1. **Node.js** (Rekomendasi: versi LTS).
2. **npm** (Otomatis terinstal bersama Node.js) atau **yarn**.
3. **Git Bash** atau terminal lain di Windows.

## 🚀 Cara Instalasi
1. *Clone* repositori ini ke dalam lokal komputermu:
   ```bash
   git clone [https://github.com/rahelnatasya/semen-cypress.git](https://github.com/rahelnatasya/semen-cypress.git)
   cd semen-cypress
2. Instal semua dependencies yang dibutuhkan: **npm install**

## Cara Menjalankan di Windows
1. Mode Interaktif (GUI Browser):
   **npx cypress open**
   Langkah Selanjutnya:
   Jendela Cypress akan terbuka.
   Pilih menu E2E Testing.
   Pilih browser (misalnya Chrome atau Edge), lalu klik Start E2E Testing.
   Klik salah satu file skrip .cy.js untuk mulai menjalankan pengujian.
2. Mode Headless (CLI / Background)
   **npx cypress run**

## 📂 Struktur Utama Proyek
1. **cypress/e2e/**: Folder utama tempat menyimpan seluruh skrip testing Cypress (.cy.js).
2. **cypress/fixtures/**: Tempat menyimpan data statis (contoh: file .xlsx atau .json)    yang disuntikkan ke dalam test.
3. **cypress/downloads/**: Folder tempat menampung file laporan yang berhasil diunduh selama proses automation testing.

