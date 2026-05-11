describe('TA-UC01-011 Territory Analytics - Filter Kecamatan Summary', () => {
  
  const targetKecamatan = 'Sukolilo';

  beforeEach(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      if (err.message.includes("reading 'lat'")) return false;
      if (err.message.includes("reading '1'")) return false;
      return true; 
    });

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  it('Verifikasi kelengkapan komponen Summary (Stores, Score A, B, C) di Panel (Hapyy Path)', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getAnalytics')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    
    // 1. Tangkap Data API
    cy.wait('@getAnalytics').then((interception) => {
      const apiBody = interception.response.body;
      const districtData = apiBody.districts.find(d => d.name === targetKecamatan);
      
      // Ambil angka dari API, jika null/undefined jadikan 0
      const apiTotal = districtData.storeCount || 0;
      const apiScoreA = districtData.rankA || 0;
      const apiScoreB = districtData.rankB || 0;
      const apiScoreC = districtData.rankC || 0;

      cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
      cy.wait(1000)

      // 2. Interaksi Buka Panel dan Pilih Kecamatan
      cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
      cy.wait(500) 
      cy.contains('label', 'Kecamatan', { matchCase: false }).parent().find('input[type="text"]').click({ force: true }).clear({ force: true }).type(targetKecamatan, { force: true })
      cy.wait(500)
      cy.get('body').contains(targetKecamatan).not('input').last().click({ force: true })
      cy.wait(2000) 

      // 3. VALIDASI KELENGKAPAN PANEL SECARA KESELURUHAN
      // Masuk ke dalam kotak rincian kecamatan
      cy.get('.p-4.border-b.border-slate-100').within(() => {
        
        // Pastikan nama kecamatan benar
        cy.get('h3').should('have.text', targetKecamatan)

        // a. Absen Komponen "Stores" (Berdasarkan laporanmu, ini yang muncul)
        cy.contains('div', 'Stores', { matchCase: false })
          .should('be.visible')
          .parent()
          .find('.text-lg.font-bold')
          .should('have.text', apiTotal.toString());

        // b. Absen Komponen "Score A"
        cy.contains('div', 'Score A', { matchCase: false })
          .should('be.visible') // Memaksa Cypress memastikan elemen ini tergambar di layar!
          .parent()
          .find('.text-lg.font-bold')
          .should('have.text', apiScoreA.toString());

        // c. Absen Komponen "Score B"
        cy.contains('div', 'Score B', { matchCase: false })
          .should('be.visible') 
          .parent()
          .find('.text-lg.font-bold')
          .should('have.text', apiScoreB.toString());

        // d. Absen Komponen "Score C"
        cy.contains('div', 'Score C', { matchCase: false })
          .should('be.visible') 
          .parent()
          .find('.text-lg.font-bold')
          .should('have.text', apiScoreC.toString());
      })
    })
})
    // --- SKENARIO NEGATIF 1: DATA SCORE NULL / UNDEFINED ---
  it('Skenario 1: Panel tidak menampilkan NaN/Undefined saat data Score dari API null', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body && res.body.districts) {
          const districtIndex = res.body.districts.findIndex(d => d.name === targetKecamatan);
          if (districtIndex !== -1) {
            // Kita rusak datanya menjadi null
            res.body.districts[districtIndex].rankA = null;
            res.body.districts[districtIndex].rankB = null;
            res.body.districts[districtIndex].rankC = undefined;
          }
        }
        res.send(res.body);
      })
    }).as('getNullScores')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getNullScores')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 
    cy.contains('label', 'Kecamatan', { matchCase: false }).parent().find('input[type="text"]').click({ force: true }).clear({ force: true }).type(targetKecamatan, { force: true })
    cy.wait(500)
    cy.get('body').contains(targetKecamatan).not('input').last().click({ force: true })

    // VALIDASI: Panel harus mengubah Null menjadi "0" secara otomatis, BUKAN "NaN" atau kosong.
    cy.get('.p-4.border-b.border-slate-100').within(() => {
      cy.contains('.rounded-lg', 'Score A', { matchCase: false }).find('.text-lg.font-bold').should('have.text', '0')
      cy.contains('.rounded-lg', 'Score B', { matchCase: false }).find('.text-lg.font-bold').should('have.text', '0')
      cy.contains('.rounded-lg', 'Score C', { matchCase: false }).find('.text-lg.font-bold').should('have.text', '0')
    })
  })

  // --- SKENARIO NEGATIF 2: SERVER MATI (ERROR 500) ---
  it('Skenario 2: Aplikasi tidak White Screen saat API memunculkan Error 500', () => {
    
    // Kita buat API seolah-olah meledak di server
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', {
      statusCode: 500,
      body: { message: "Internal Server Error" }
    }).as('getServerCrash')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getServerCrash')

    // VALIDASI: Aplikasi tidak boleh mati total (White screen). 
    // Minimal struktur utama aplikasi (seperti sidebar/header) tetap hidup.
    cy.get('body').should('not.be.empty')
    // Harusnya developer membuat notifikasi error yang sopan
    cy.contains('Territory Analytics').should('be.visible')
  })

  // --- SKENARIO NEGATIF 3: TOTAL STORE 0 ---
  it('Skenario 3: Panel menampilkan angka 0 dengan rapi jika kecamatan tidak memiliki toko', () => {
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*', (req) => {
      req.continue((res) => {
        if (res.body) {
          
          // 1. Ubah catatan angka summary jadi 0
          if (res.body.districts) {
            const districtIndex = res.body.districts.findIndex(d => d.name === targetKecamatan);
            if (districtIndex !== -1) {
              res.body.districts[districtIndex].storeCount = 0;
              res.body.districts[districtIndex].rankA = 0;
              res.body.districts[districtIndex].rankB = 0;
              res.body.districts[districtIndex].rankC = 0;
            }
          }

          // 2. PERBAIKAN: Hapus wujud fisik toko dari array stores!
          // Kita filter array stores agar HANYA menyisakan toko yang BUKAN Sukolilo.
          if (res.body.stores) {
            res.body.stores = res.body.stores.filter(s => s.districtName !== targetKecamatan);
          }
        }
        res.send(res.body);
      })
    }).as('getZeroStores')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getZeroStores')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
    cy.wait(500) 
    cy.contains('label', 'Kecamatan', { matchCase: false }).parent().find('input[type="text"]').click({ force: true }).clear({ force: true }).type(targetKecamatan, { force: true })
    cy.wait(500)
    cy.get('body').contains(targetKecamatan).not('input').last().click({ force: true })
    cy.wait(2000) // Beri waktu panel update angka

    // VALIDASI: Panel total store sekarang PASTI memunculkan angka 0
    cy.get('.p-4.border-b.border-slate-100').within(() => {
      cy.contains('.rounded-lg', 'Stores', { matchCase: false })
        .find('.text-lg.font-bold')
        .should('have.text', '0')
    })
  })
  })