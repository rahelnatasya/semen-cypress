describe('VO-UC01-008 Visit Overview - Export XLSX Button', () => {
  
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

  it('Validasi Fungsi Export XLSX dan Kesesuaian Data pada UI (Happy Path)', () => {
    
    // 1. SETUP DATA MOCK UNTUK VALIDASI (Kasus "K2 Jaya")
    // Kita injeksi data persis seperti expected result di test case-mu
    cy.intercept({
      method: 'GET',
      pathname: '**/api/v1/visit-overview/visit-heatmap',
      query: { groupBy: 'store' }
    }, (req) => {
      req.continue((res) => {
        if (res.body) {
          res.body.data = [
            { 
              id: 217, 
              label: "K2 Jaya", 
              kecamatan: "Mulyorejo",
              // Mocking breakdown sesuai test case
              periods: {
                "2025": { "Oct": 3, "Nov": 2, "Dec": 5 }, // Total 2025 = 10
                "2026": { "Jan": 5, "Feb": 3 }            // Total 2026 = 8
              }
            }
          ];
        }
        res.send(res.body);
      })
    }).as('getHeatmapStore')

    // 2. BUKA HALAMAN VISIT OVERVIEW
    cy.visit('http://pepi-semen.inaai.ai:5173/visit-overview') 
    cy.wait('@getHeatmapStore')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(1000)

    // 3. VALIDASI UI TABEL (Sebelum Export)
    cy.log('--- VALIDASI TAMPILAN HEATMAP ---')
    // Pastikan Mode Store Aktif
    cy.contains('button[role="tab"]', 'Store', { matchCase: false })
      .should('have.attr', 'data-state', 'active')

    // Validasi data spesifik "K2 Jaya" di layar
    cy.get('table').contains('K2 Jaya', { matchCase: false }).scrollIntoView().should('be.visible')
    
    // Asumsi: Kita mencari nilai 5 (Jan) dan 3 (Feb) di dalam baris K2 Jaya
    // Developer biasanya merender tabel per baris (<tr>). Kita cari baris milik K2 Jaya.
    cy.contains('tr', 'K2 Jaya').within(() => {
      // Memastikan angka 5 dan 3 muncul di baris tersebut
      cy.contains('5').should('exist')
      cy.contains('3').should('exist')
      
      // Memastikan Total All Time (18) muncul di baris tersebut (10 + 8)
      // Karena 18 adalah kombinasi dari 2025 dan 2026
      cy.contains('18').should('exist') 
    })


    // 4. KLIK TOMBOL EXPORT DAN VALIDASI DOWNLOAD
    cy.log('--- VALIDASI TOMBOL EXPORT XLSX ---')
    
    // Biasanya nama tombolnya "Export", "Download", atau logo icon Excel
    // Sesuaikan selector ini jika developer menggunakan ikon (SVG) tanpa teks
    cy.contains('button', /export|download/i).click({ force: true })

    // 5. MEMASTIKAN FILE BERHASIL DIUNDUH KE KOMPUTER
    // Cypress secara otomatis menyimpan file unduhan ke folder cypress/downloads/
    // Kita harus memverifikasi bahwa file baru dengan ekstensi .xlsx berhasil dibuat.
    
    const downloadsFolder = Cypress.config('downloadsFolder')
    
    // Tunggu sedikit agar proses download selesai (terutama jika dari server)
    cy.wait(3000) 
    
    // Verifikasi bahwa ada file xlsx di dalam folder downloads
    cy.task('findFiles', { folder: downloadsFolder, mask: '*.xlsx' }).then((foundFiles) => {
      // foundFiles adalah array berisi nama-nama file yang cocok
      expect(foundFiles.length).to.be.greaterThan(0, '🚨 File XLSX gagal terunduh! Periksa API atau fungsi onClick tombol Export.');
      
      cy.log(`✅ File berhasil diunduh: ${foundFiles[0]}`)
    })
  })
})