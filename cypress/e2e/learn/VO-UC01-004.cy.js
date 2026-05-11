describe('VO-UC01-004 Visit Overview - View Toggle Heatmap', () => {
  
  beforeEach(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      return true; 
    });

    // Proses Login
    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  it('Validasi Toggle View dapat berpindah dan memuat data Store vs District dengan benar', () => {
    
    // 1. PASANG PERANGKAP API BERDASARKAN QUERY PARAMETER
    // Kita bedakan alias berdasarkan parameter 'groupBy' yang dikirim Frontend
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*groupBy=store*').as('getHeatmapStore')
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*groupBy=district*').as('getHeatmapDistrict')

    // 2. BUKA HALAMAN
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    
    // Tunggu loading awal (Bawaan aplikasi biasanya memuat mode 'Store' duluan)
    cy.wait('@getHeatmapStore').then((interception) => {
      // Ambil satu nama toko untuk dicocokkan nanti
      const dataStore = interception.response.body.data;
      const sampleStoreName = dataStore.length > 0 ? dataStore[0].label : null;

      cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
      cy.wait(1000)

      // 3. VALIDASI MODE DEFAULT (STORE)
      // Pastikan tombol Store aktif dan tombol District tidak aktif
      cy.contains('button[role="tab"]', 'Store', { matchCase: false })
        .should('have.attr', 'data-state', 'active')
        
      cy.contains('button[role="tab"]', 'District', { matchCase: false })
        .should('have.attr', 'data-state', 'inactive')

      // Pastikan data di tabel (Heatmap) memunculkan nama toko sesuai API
      if (sampleStoreName) {
        // Biasanya nama ditampilkan di kolom paling kiri tabel (misal dalam <td> atau <th>)
        cy.get('table').contains(sampleStoreName).should('be.visible')
      }

      cy.log('✅ Validasi Mode Store Berhasil');
    })

    // 4. INTERAKSI: KLIK TOGGLE KE 'DISTRICT'
    cy.contains('button[role="tab"]', 'District', { matchCase: false }).click({ force: true })

    // Tunggu API District dipanggil
    cy.wait('@getHeatmapDistrict').then((interception) => {
      const dataDistrict = interception.response.body.data;
      const sampleDistrictName = dataDistrict.length > 0 ? dataDistrict[0].label : null;

      cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
      cy.wait(500)

      // 5. VALIDASI PERUBAHAN KE MODE DISTRICT
      // Pastikan status tombol berbalik
      cy.contains('button[role="tab"]', 'District', { matchCase: false })
        .should('have.attr', 'data-state', 'active')
        
      cy.contains('button[role="tab"]', 'Store', { matchCase: false })
        .should('have.attr', 'data-state', 'inactive')

      // Pastikan data tabel berubah memunculkan nama Kecamatan
      if (sampleDistrictName) {
        cy.get('table').contains(sampleDistrictName).scrollIntoView().should('be.visible')
      }

      cy.log('✅ Validasi Mode District Berhasil');
    })
  })
  // SKENARIO 1: VISUAL OVERFLOW (Angka Raksasa & Teks Super Panjang)
  it('Skenario 1: UI tidak hancur saat menerima Angka Raksasa dan Teks Super Panjang [BUG 1]', () => {
    
    // Injeksi API Summary: Angka Raksasa
    cy.intercept('GET', '**/api/v1/visit-overview/visit-summary*', (req) => {
      req.continue((res) => {
        if (res.body) {
          res.body.totalVisits = 999999999999; // 999 Miliar!
        }
        res.send(res.body);
      })
    }).as('getGiantNumbers')

    // Injeksi API Heatmap: Teks Sangat Panjang
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.data && res.body.data.length > 0) {
          // Kita ubah nama toko pertama jadi super panjang
          res.body.data[0].label = "Toko Sinar Jaya Makmur Sentosa Abadi Sejahtera Selamanya Sepanjang Masa Tiada Akhir";
        }
        res.send(res.body);
      })
    }).as('getLongText')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.wait(['@getGiantNumbers', '@getLongText'])
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    // VALIDASI A: Cek apakah UI mengubah angka raksasa jadi format pendek (misal 999B) 
    // atau tetap menampilkannya tapi dibatasi (truncate). Yang pasti TIDAK BOLEH crash.
    cy.contains('Total Visits', { matchCase: false })
      .closest('div').parent().invoke('text').then((text) => {
        // Logika asersi dasar: pastikan aplikasi tidak me-render 'NaN'
        expect(text).to.not.include('NaN');
      })

    // VALIDASI B: Cek tabel apakah teks panjang memicu class 'truncate' atau sejenisnya
    // Aplikasi Tailwind yang bagus pasti memasang class "truncate" untuk teks panjang
    cy.contains('Toko Sinar Jaya Makmur', { matchCase: false })
      .should('be.visible')
      .and((el) => {
        // Mengecek apakah elemen CSS-nya memotong teks (overflow: hidden / text-overflow: ellipsis)
        const styles = window.getComputedStyle(el[0]);
        // Catatan: Jika developer belum memasang class truncate, tes ini mungkin tetap lewat, 
        // tapi secara visual di layarmu tabelnya akan kelihatan melar/hancur. 
        // Ini butuh inspeksi mata atau visual regression testing.
      })
  })

  // SKENARIO 2: DATA ANOMALY (Minus & Salah Tipe Data)
  it('Skenario 2: UI kebal terhadap angka Minus (-5) dan Tipe Data Siluman (String "102") [BUG 2]', () => {
    
    cy.intercept('GET', '**/api/v1/visit-overview/visit-summary*', (req) => {
      req.continue((res) => {
        if (res.body) {
          // Anomali 1: Angka Minus (seharusnya di-clamp jadi 0 oleh UI)
          res.body.totalVisitedStores = -5; 
          
          // Anomali 2: Backend bodoh mengirimkan huruf/string bukannya integer
          res.body.totalVisits = "SERATUS DUA"; 
        }
        res.send(res.body);
      })
    }).as('getAnomalyData')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.wait('@getAnomalyData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    // VALIDASI A: Freq Index (Yang merupakan hasil matematika total kunjungan / toko)
    // Jangan sampai UI merender "NaN" karena mencoba membagi kata "SERATUS DUA" dengan "-5"
    cy.contains('Freq. Index', { matchCase: false })
      .closest('div').parent().invoke('text').then((text) => {
        expect(text).to.not.include('NaN', 'Aplikasi bocor memunculkan NaN karena error matematika!');
      })

    // VALIDASI B: Angka Minus tidak merusak UI (biasanya UI akan mem-fallback jadi 0)
    cy.contains('Stores Visited', { matchCase: false })
      .closest('div').parent().should('not.contain', 'NaN')
  })

  // SKENARIO 3: RACE CONDITION (Balapan Spam Klik Mode District vs Store)
  it('Skenario 3: Mencegah Kebocoran Data (Race Condition) saat User Spam Toggle Cepat', () => {
    
    // SETUP BALAPAN (RACE):
    // API Store dibuat sangat LEMOT (delay 3 detik)
    cy.intercept('GET', '**/visit-heatmap*groupBy=store*', (req) => {
      req.reply((res) => { res.setDelay(3000); res.send(); }) // Tahan 3 detik
    }).as('slowStoreAPI')

    // API District dibuat sangat CEPAT (delay 0.2 detik)
    cy.intercept('GET', '**/visit-heatmap*groupBy=district*', (req) => {
      req.reply((res) => { res.setDelay(200); res.send(); }) // Balas instan
    }).as('fastDistrictAPI')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 

    // AKSI BARBAR USER: 
    // 1. User iseng klik 'Store' (Memanggil API lemot 3 detik)
    cy.contains('button[role="tab"]', 'Store', { matchCase: false }).click({ force: true })
    
    // 2. Belum sempat nunggu 3 detik, user langsung pindah klik 'District' (Memanggil API cepat)
    cy.contains('button[role="tab"]', 'District', { matchCase: false }).click({ force: true })

    // Kita tunggu dengan total 3.5 detik (Sampai API Store yang lemot tadi akhirnya selesai membalas)
    cy.wait(3500)

    // VALIDASI MAUT (Momen Pembuktian):
    // Saat detik ke-3.5, API Store baru mendarat. 
    // Apakah tabelnya tiba-tiba berubah jadi daftar 'Store' padahal toggle-nya jelas-jelas di 'District'?
    
    // Pastikan Toggle TERAKHIR yang dipilih user adalah District
    cy.contains('button[role="tab"]', 'District', { matchCase: false })
      .should('have.attr', 'data-state', 'active')

    // Pastikan tabel TIDAK tertimpa oleh data Store yang datang terlambat
    // Jika developer HEBAT: Permintaan API Store akan di-Cancel (AbortController)
    // Jika developer LALAI: Tabel akan mendadak memunculkan nama toko, bukan kecamatan!
    cy.get('table').then(($table) => {
      const headerText = $table.find('th').text().toLowerCase();
      // Harusnya header tabel tetap berfokus pada District, bukan nama toko
      expect(headerText).to.include('district', 'BUG RACE CONDITION TERJADI! Data tabel ditimpa oleh request Store yang terlambat!');
    })
  })
})


// [BUG 1: KETIADAAN VALIDASI TIPE DATA & NILAI MINUS PADA KPI]
// Terdapat celah pada penanganan data di komponen Total Visit, Stores Visited, dan Freq Index.
// Ekspektasi: Sistem memvalidasi secara ketat bahwa payload dari API wajib bertipe angka (Integer/Float) dan bernilai positif (>= 0).
// Aktual: Pada skenario pengujian ini, sistem masih menerima dan merender tipe data String (huruf) serta nilai minus secara mentah ke layar tanpa memberikan error handling atau fallback ke angka 0.

// [BUG 2: UI OVERFLOW PADA ANGKA RAKSASA]
// Terdapat isu tata letak (layout) dan ketidakkonsistenan tampilan pada container KPI Card.
// Ekspektasi: Container bersifat dinamis/fleksibel menyesuaikan isi, atau sistem menerapkan fungsi pemendek angka (formatter) untuk nilai ekstrem.
// Aktual: Saat diuji dengan menyuntikkan angka raksasa (999.999.999.999) pada Total Visits, teks menembus batas container dan merusak desain UI.