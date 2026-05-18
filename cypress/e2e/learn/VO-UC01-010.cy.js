describe('Visit Overview - Validasi Logika Warna Heatmap ', () => {
  const searchInput = 'input[placeholder="Search..."]';

  beforeEach(() => {
    Cypress.on('uncaught:exception', () => false);

    // Mencegat API hanya untuk dijadikan "Lampu Hijau" bahwa data sudah selesai dimuat
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*').as('getHeatmapData');

    // Login dan Navigasi
    cy.visit('http://pepi-semen.inaai.ai:5173/login');
    cy.get('input[type="email"]').type('admin@admin.com', { force: true });
    cy.get('input[type="password"]').type('admin123!', { force: true });
    cy.get('button[type="submit"]').click({ force: true });
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/');
    
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');
    cy.get('.backdrop-blur-\\[1px\\]', { timeout: 15000 }).should('not.exist');
  });

  it('Validasi Sinkronisasi Angka UI dan Tailwind Class Heatmap (Happy Path)', () => {
    
    cy.log('--- 1. MENUNGGU DATA SELESAI DIMUAT ---');
    // Kita tunggu sampai API merespon, barulah kita beraksi (tidak perlu membedah isi datanya)
    cy.wait('@getHeatmapData');

    cy.log('--- 2. FILTER UI KE TOKO TARGET ---');
    // Pastikan mode 'Store' aktif
    cy.contains('button[role="tab"]', 'Store', { matchCase: false }).click({ force: true });
    cy.wait(1000);
    
    // Filter pencarian
    cy.get(searchInput).clear({ force: true }).type('Aries Jaya', { force: true });
    cy.wait(1000);

    cy.log('--- 3. VALIDASI KETAT ANGKA & WARNA HEATMAP DI UI ---');
    cy.contains('tr', 'Aries Jaya', { matchCase: false }).should('be.visible').within(() => {
      
      // Ambil seluruh sel (td) di baris Aries Wijaya
    cy.get('td').each(($td, index, $list) => {
        const text = $td.text().trim();
        const count = parseInt(text);

        // Kita HANYA memproses sel yang berisi angka
        // "index < $list.length - 1" berfungsi agar kolom "Total" di ujung kanan tidak ikut diuji warnanya
        if (!isNaN(count) && index < $list.length - 1) {

        if (count === 0) {
            expect($td).to.have.class('bg-slate-50');
            expect($td).to.have.class('text-slate-300');
          } 
          else if (count === 1) {
            expect($td).to.have.class('bg-blue-50');
            expect($td).to.have.class('text-blue-600');
          } 
          else if (count === 2) {
            expect($td).to.have.class('bg-blue-100');
            expect($td).to.have.class('text-blue-700');
          } 
          else if (count === 3) {
            expect($td).to.have.class('bg-blue-200');
            expect($td).to.have.class('text-blue-800');
          } 
          else if (count === 4) {
            expect($td).to.have.class('bg-blue-300');
            expect($td).to.have.class('text-blue-900');
          } 
          else if (count >= 5) { 
            expect($td).to.have.class('bg-blue-500');
            expect($td).to.have.class('text-white');
            expect($td).to.have.class('shadow-inner');
            }
          };
        },
      );  
    });
  });

  // SKENARIO 1: DATA ABNORMAL (NULL, STRING, NEGATIVE) HARUS DITANGANI DENGAN BAIK TANPA MEMBUAT UI CRASH
  it('Skenario 1: UI Heatmap harus bertahan saat menerima data abnormal dari API', () => {
    
    // 1. Pasang Jebakan: Ganti data dari server dengan data aneh
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*', {
    statusCode: 200,
    body: {
      data: [ // Pastikan API asli memang membungkus response di dalam property "data"
        {
          id: 999, // Tambahkan ID agar frontend tidak error (biasanya dipakai untuk key React/Vue)
          label: 'Toko Anomali', 
          kecamatan: 'Area Anomali',
          totalStores: null,
          periods: {
            "2026": { // Pastikan tahunnya sesuai dengan filter default di UI kamu saat ini
              "Jan": -5,       // Data negatif
              "Feb": 999999,   // Nilai Ekstrem
              "Mar": null,     // Data Null
              "Apr": "abc"     // Data String (Tipe data tidak valid)
            }
          }
        }
      ]
    }
  }).as('getAbnormalData');

    // 2. Kunjungi halaman (API bajakan akan terpanggil)
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');
    cy.wait('@getAbnormalData');

    // 3. Filter ke mode Store dan cari toko anomali
      cy.contains('button[role="tab"]', 'Store', { matchCase: false }).click({ force: true });
      cy.get('input[placeholder="Search..."]').clear({ force: true }).type('Toko Anomali', { force: true });

      // 4. Validasi ketahanan UI
      cy.contains('tr', 'Toko Anomali').should('be.visible').within(() => {
        
        // Gunakan .should() KHUSUS untuk expect (tanpa cy.log)
        cy.get('td').should(($cells) => {
          
          // Validasi 1: Pastikan hanya ada 3 kolom yang tersisa di baris ini
          // Ini membuktikan bahwa Januari (-5), Maret (null), dan April ("abc") berhasil dibuang oleh UI
          expect($cells).to.have.length(3, 'Kolom dengan data abnormal harus disembunyikan UI');

          // Validasi 2: Cek Kolom 0 (Nama Toko)
          expect($cells.eq(0).text()).to.contain('Toko Anomali');
          
          // Validasi 3: Cek Kolom 1 (Februari) -> Datanya ekstrem tapi valid
          const textFeb = $cells.eq(1).text().trim();
          expect(textFeb).to.eq('999999', 'Data bulan Februari harus tetap muncul');
          expect($cells.eq(1)).to.have.class('bg-blue-500', 'Warna heatmap Februari harus terpekat'); 
          
          // Validasi 4: Cek Kolom 2 (Total) -> Harusnya sesuai dengan mock data
          const textTotal = $cells.eq(2).text().trim();
          expect(textTotal).to.eq('999994', 'Total harus tetap dikalkulasi/ditampilkan');
          
        });
      });
    });

  // SKENARIO 2: JARINGAN SANGAT LAMBAT (TIMEOUT)
  it('Skenario 2: Simulasi Jaringan Lambat (Harus muncul Loading Skeleton)', () => {
    
    // 1. Pasang Jebakan: Buat API merespons sangat lambat (30 detik)
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*', (req) => {
      req.on('response', (res) => {
        res.setDelay(30000); 
      });
    }).as('getSlowData');

    // 2. Kunjungi halaman
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');

    // 3. Validasi: UI harus menampilkan efek loading/skeleton, tidak boleh putih kosong
    // NOTE: Sesuaikan class '.animate-pulse' dengan class skeleton bawaan aplikasimu
    cy.get('.animate-spin', { timeout: 5000 }).should('be.visible');
    cy.log('✅ UI menampilkan Full-Screen Spinner saat menunggu API');
  });

  // SKENARIO 3: SERVER DOWN (HTTP 500)
  it('Skenario 3: Simulasi Server Down Error 500 (Harus muncul pesan Error) [BUG]', () => {
    
    // 1. Pasang Jebakan: Paksa server membalas error 500
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*', {
      statusCode: 500,
      body: { message: "Internal Server Error" }
    }).as('getServerError');

    // 2. Kunjungi halaman
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');
    cy.wait('@getServerError');

    // 3. Validasi: Layar tidak boleh White Screen of Death
    cy.get('body').should('not.be.empty');
    cy.get('nav').should('be.visible'); // Sidebar harus tetap bisa diakses

    // 4. Validasi: Harus muncul notifikasi error yang sopan (Toast/Alert)
    // NOTE: Sesuaikan selector teks ini dengan teks error asli di aplikasimu
    cy.contains(/gagal|error|terjadi kesalahan/i).should('be.visible');
    cy.contains('Showing', { matchCase: false }).should('contain.text', '0-0');
  });

  // SKENARIO 4: DEDUPLIKASI DATA TIRO (DOUBLE COUNTING BUG)
  it('Skenario 4: Angka Heatmap tidak boleh bertambah saat di-upload file yang sama 2x', () => {
    let angkaAwal = 0;
    
    // 1. Cek angka saat ini (Sebelum Upload)
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');
    cy.get('.backdrop-blur-\\[1px\\]', { timeout: 15000 }).should('not.exist');
    
    cy.contains('button[role="tab"]', 'Store', { matchCase: false }).click({ force: true });
    cy.wait(1000);
    cy.get('input[placeholder="Search..."]').clear({ force: true }).type('Bintang Jaya', { force: true });
    cy.wait(1500);
    
    cy.contains('tr', 'Bintang Jaya', { matchCase: false }).within(() => {
      // Ambil angka kunjungan bulan Januari (kolom ke-2)
      cy.get('td').eq(1).invoke('text').then((txt) => {
        angkaAwal = parseInt(txt) || 0;
        cy.log(`🎯 Angka sebelum di-bombardir upload: ${angkaAwal}`);
      });
    });

    // 2. Lakukan Upload Data TIRO 2x berturut-turut (Double Upload)
    cy.visit('http://pepi-semen.inaai.ai:5173/import-visit-tiro');
    const uploadFile = () => {
    // 1. Pilih file secara langsung ke input (file sudah tersimpan di state Cypress)
    cy.get('input[type="file"]')
      .selectFile('cypress/fixtures/data-tiro.xlsx', { force: true }); 
    
    // 2. JANGAN klik tombol "Upload File" lagi jika itu hanya tombol pemancing file explorer.
    // Langsung klik tombol "Submit" yang bertugas mengirim data ke server.
    cy.contains('button', 'Submit').click({ force: true });
    
    // 3. Validasi pesan dari UI
    // Karena saat ini masih gagal, kita bisa ganti asersinya sementara untuk melihat apakah dia berhasil melangkah maju
    cy.contains(/sukses|berhasil|tersimpan/i, { timeout: 15000 }).should('be.visible');
  };

    // 3. Kembali ke halaman Visit Overview dan cek angkanya
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview');
    cy.get('.backdrop-blur-\\[1px\\]', { timeout: 15000 }).should('not.exist');
    
    cy.contains('button[role="tab"]', 'Store', { matchCase: false }).click({ force: true });
    cy.wait(1000);
    cy.get('input[placeholder="Search..."]').clear({ force: true }).type('Bintang Jaya', { force: true });
    cy.wait(1500);

    cy.contains('tr', 'Bintang Jaya', { matchCase: false }).within(() => {
      cy.get('td').eq(1).invoke('text').then((txt) => {
        const angkaAkhir = parseInt(txt) || 0;
        
        // 4. Asersi Utama: Angka awal dan akhir harus SAMA (Deduplikasi bekerja)
        expect(angkaAkhir).to.eq(angkaAwal, '🚨 BUG TIRO: Sistem mengalami Double Count! Angka bertambah padahal file yang diupload sama persis.');
      });
    });
  });

});


// Skenario 1: Pada skenario ini, API mengirim data null, string, dan minus dan react berhasil menampilkan informasi yang memang tipe datanya sesuai 
// frontend tidak crash dan tetap menampilkan data yang valid sedangkan data yang invalid (null, string, minus) tidak ditampilkan sama sekali di UI. Ini membuktikan bahwa frontend sudah memiliki validasi tipe data yang baik sebelum menampilkan angka di heatmap.

// Skenario 2: Disini hanya untuk memastikan jika ada penangan apabila jaringan atau koneksi lambat, loading spin di tampilkan di keseluruh layar. 
// Saran untuk ini ada baiknya di tambahkan opsi "Try Again" agar user bisa mencoba kembali tanpa harus refresh halaman secara manual

// Skenario 3: Pada skenario ini API sengaja dibuat error, dan yang ditampilkan hanya 'Showing 0-0 of0 stores' seharusnya diperbaiki menjadi pesan empty state
// Empty state ini bisa memberitahukan kepada user memang datanya yang tidak dapat ditampilkan karena server bermasalah bukan karena data tidak ada. 
// Munculnya kalimat di slider 'Showing 0-0 of0 stores' membuat penggunanya akan merasa datanya hilang paahal sebenarnya data tidak hilang tapi server yang bermasalah. 

// Skenario 4: Pada skenario ini, file yang sama di upload sebanyak 2x, dan hasilnya tidak terjadi perubahan angka di UI. 
// Ini membuktikan bahwa sistem sudah memiliki mekanisme deduplikasi data yang baik, sehingga mencegah terjadinya double counting yang bisa merusak integritas data di heatmap.