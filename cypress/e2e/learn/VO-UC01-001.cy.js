describe(' Visit Overview - KPI Card Total Visits', () => {
  
  beforeEach(() => {
    // Abaikan error bawaan framework pihak ketiga agar tes tidak berhenti prematur
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

  it('Verifikasi angka KPI Card Total Visits sinkron dengan data API TIRO (Happy Path)', () => {
    
    // 1. Mencegat API Visit Overview saat halaman dimuat
    // Asumsi endpoint-nya mengandung kata visit-overview atau sejenisnya
    cy.intercept('GET', '**/api/v1/visit-overview/visit-summary*').as('getVisitOverviewData')

    // 2. Navigasi ke halaman Visit Overview
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    
    // 3. Tangkap data API dan ekstrak nilainya
    cy.wait('@getVisitOverviewData').then((interception) => {
      const apiBody = interception.response.body;
      
      // Mengambil nilai totalVisits dari JSON (Dalam data kamu saat ini: 883)
      const expectedTotalVisits = apiBody.totalVisits;

      cy.log(`Data API tertangkap: Total Visits = ${expectedTotalVisits}`);

      // Tunggu loading overlay hilang jika ada
      cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
      cy.wait(1000)

      // 4. VALIDASI KPI CARD DI UI
      // Kita cari elemen yang mengandung teks "Total Visits", 
      // lalu cari angka besarnya di dalam komponen kartu yang sama
      cy.contains('Total Visits', { matchCase: false })
        .closest('div') // Naik ke div pembungkus utama kartu (sesuaikan jika perlu)
        .parent()       // Biasanya kartu dibungkus satu div lagi di atasnya
        .invoke('text')
        .then((kpiText) => {
          
          // Memastikan teks di dalam kartu tersebut mengandung angka dari API
          // Kita ubah ke string, dan kita juga antisipasi format ribuan jika datanya > 1000 
          // (misal API 1725, UI mungkin menuliskannya "1.725" atau "1,725")
          
          const formattedExpected = expectedTotalVisits.toLocaleString('id-ID'); // Format ke "1.725" jika perlu
          
          // Cypress mengecek apakah angka tersebut ada tertulis di dalam KPI Card
          expect(kpiText.replace(/[\.,]/g, '')).to.include(expectedTotalVisits.toString());
        })
    })
  })
  // --- SKENARIO NEGATIF 1: DATA KPI NULL / UNDEFINED ---
  it('SKENARIO NEGATIF 1: KPI Card tidak menampilkan "NaN" saat data Total Visits dari API adalah null', () => {
    
    // Injeksi Racun: Kita tangkap API dan ubah angkanya jadi null
    cy.intercept('GET', '**/api/v1/visit-overview/visit-summary*', (req) => {
      req.continue((res) => {
        if (res.body) {
          res.body.totalVisits = null; // Menghapus data total kunjungan
        }
        res.send(res.body);
      })
    }).as('getNullVisits')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.wait('@getNullVisits')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    // VALIDASI: Cari kartu Total Visits, dan pastikanTIDAK ADA tulisan "NaN" (Not a Number) atau "undefined"
    // Biasanya developer yang bagus akan menampilkan angka 0 atau simbol strip (-)
    cy.contains('Total Visits', { matchCase: false })
      .closest('div')
      .parent()
      .should('not.contain', 'NaN')
      .and('not.contain', 'undefined')
      
    // (Opsional) Cek apakah jatuhnya ke angka 0
    // .and('contain', '0') 
  })

  // --- SKENARIO NEGATIF 2: SERVER MATI (ERROR 500) ---
  it('SKENARIO NEGATIF 2: Halaman Overview tidak White Screen (Crash) saat API Summary meledak (Error 500)', () => {
    
    // Injeksi Racun: Buat seolah-olah server lumpuh
    cy.intercept('GET', '**/api/v1/visit-overview/visit-summary*', {
      statusCode: 500,
      body: { message: "Internal Server Error - Database Timeout" }
    }).as('getServerCrash')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.wait('@getServerCrash')

    // VALIDASI: Aplikasi tidak boleh mati total (Layar Putih).
    // Tulisan struktur utama seperti judul halaman harus tetap hidup.
    cy.get('body').should('not.be.empty')
    cy.contains('Visit Overview').should('be.visible')
    
    // Pastikan tidak ada loading spinner/backdrop yang nge-freeze terus-terusan
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
  })

  // --- SKENARIO NEGATIF 3: NILAI KUNJUNGAN NOL BESAR ---
  it('SKENARIO NEGATIF 3: KPI Card merender angka 0 dengan sempurna tanpa merusak UI', () => {
// 1. MATIKAN SEMUA DATA KPI (SUMMARY)
    cy.intercept('GET', '**/api/v1/visit-overview/visit-summary*', (req) => {
      req.continue((res) => {
        if (res.body) {
          res.body.totalVisits = 0; 
          res.body.totalVisitedStores = 0;   // <-- PERBAIKAN: Nol-kan ini
          res.body.visitFrequencyIndex = 0;  // <-- PERBAIKAN: Nol-kan ini
          res.body.coveragePercent = 0;      // <-- PERBAIKAN: Nol-kan ini
          // Note: totalStores dibiarkan utuh karena toko fisiknya mungkin ada, cuma belum dikunjungi
        }
        res.send(res.body);
      })
    }).as('getZeroVisits')

    // 2. MATIKAN DATA HEATMAP
    cy.intercept('GET', '**/api/v1/visit-overview/visit-heatmap*', {
      body: { groupBy: "store", data: [], summary: { totalEntries: 0 } }
    }).as('getEmptyHeatmap')

    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.wait(['@getZeroVisits', '@getEmptyHeatmap'])
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    // --- VALIDASI KPI CARD ---
    
    // Pastikan Total Visits = 0
    cy.contains('Total Visits', { matchCase: false })
      .closest('div').parent().invoke('text').then((text) => expect(text).to.include('0'))

    // Pastikan Stores Visited = 0 (Bukan 102!)
    cy.contains('Stores Visited', { matchCase: false })
      .closest('div').parent().invoke('text').then((text) => expect(text).to.include('0'))

    // Pastikan Freq. Index = 0
    cy.contains('Freq. Index', { matchCase: false })
      .closest('div').parent().invoke('text').then((text) => expect(text).to.include('0'))

    // --- VALIDASI HEATMAP ---
    // Pastikan kotak-kotak biru Heatmap musnah dari layar
    cy.get('td.bg-blue-200').should('not.exist')
  })
})