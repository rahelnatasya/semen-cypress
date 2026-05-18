readme_content = """# Automation Test with Cypress on Dashboard Management Project

Proyek ini berisi rangkaian pengujian otomatis end-to-end (E2E) menggunakan **Cypress** untuk memastikan fungsionalitas, keamanan, dan keandalan dari sistem **Dashboard Management**. 

Sistem yang diuji mencakup manajemen inventaris gudang (*warehouse*) dan toko (*store*) yang terintegrasi dengan teknologi **RFID**, serta dilengkapi dengan fitur **Role-Based Access Control (RBAC)** untuk peran *SuperAdmin*, *Warehouse Admin*, dan *Store Admin*.

---

## 🚀 Fitur Utama Pengujian

Rangkaian *automation test* ini dirancang untuk memvalidasi beberapa alur kerja krusial, antara lain:
- **Autentikasi & Otorisasi (RBAC):** Memastikan hak akses halaman dan tindakan sesuai dengan role pengguna (*SuperAdmin*, *Warehouse Admin*, dan *Store Admin*).
- **Manajemen Inventaris Gudang & Toko:** Pengujian alur *rebalancing* stok, pelacakan barang, dan sinkronisasi data.
- **Simulasi Integrasi RFID:** Pengujian otomatisasi input data berbasis RFID untuk akurasi pelacakan inventaris.
- **Pengujian Laporan & Unduhan:** Validasi akurasi ekspor data dalam format dokumen (seperti file laporan excel `.xlsx`) yang diunduh langsung melalui sistem.
- **Data-Driven Testing:** Memanfaatkan file *fixtures* (baik JSON maupun Excel seperti `data-tiro.xlsx`) untuk menguji berbagai variasi input secara dinamis.

---

## 📂 Struktur Folder Proyek

Struktur direktori pengujian Cypress diatur sebagai berikut untuk memudahkan pengelolaan *test case*: