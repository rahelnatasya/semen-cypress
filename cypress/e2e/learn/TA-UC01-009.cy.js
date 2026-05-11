describe('Territory Analytics - Summary Card Rank Distribution (Not Working)', () => {
  
  beforeEach(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      if (err.message.includes("reading 'lat'")) return false;
      return true; 
    });

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  it('Verifikasi distribusi Rank A, B, C secara Dinamis dari data Live API', () => {
    
    // 1. Mencegat API dan bersiap menangkap datanya
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getRankData')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    
    // 2. Tangkap data asli dari Model AI / Backend
    cy.wait('@getRankData').then((interception) => {
      const summary = interception.response.body.summary;
      
      const realRankA = summary.rankA;           // Misal: 268 (atau 0 di data saat ini)
      const realRankB = summary.rankB;           // Misal: 354
      const realRankC = summary.rankC;           // Misal: 491
      const realTotalStores = summary.totalStores; 
      
      cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
      cy.wait(1000) 

      // 3. BUKA PANEL RINGKASAN
      // Sama seperti sebelumnya, kita klik toggle chevron-right untuk melihat detailnya
      cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
      cy.wait(500) 

      // 4. VALIDASI DISTRIBUSI RANK DI UI
      // Catatan: Selektor di bawah ini berasumsi UI memiliki teks label "Rank A", "Rank B", dll.
      // Jika UI menggunakan label berbeda (misal hanya huruf "A", "B"), kita perlu menyesuaikannya.
      
      // a. Verifikasi Rank A
      cy.contains('Rank A', { matchCase: false }) // Cari label Rank A
        .parent() // Naik ke kotak containernya
        .invoke('text')
        .should('contain', realRankA.toLocaleString('en-US')) 

      // b. Verifikasi Rank B
      cy.contains('Rank B', { matchCase: false })
        .parent()
        .invoke('text')
        .should('contain', realRankB.toLocaleString('en-US')) 

      // c. Verifikasi Rank C
      cy.contains('Rank C', { matchCase: false })
        .parent()
        .invoke('text')
        .should('contain', realRankC.toLocaleString('en-US')) 

      // 5. VALIDASI MATEMATIKA (Opsional tapi sangat Pro)
      // Memastikan bahwa kalkulasi total stores tidak lebih kecil dari jumlah Rank A+B+C
      const sumABC = realRankA + realRankB + realRankC;
      expect(realTotalStores).to.be.at.least(sumABC, 'Total stores harus memuat semua rank');

      cy.log(`✅ Sukses! Distribusi Rank AI (A:${realRankA}, B:${realRankB}, C:${realRankC}) sinkron dengan UI.`);
    })
  })
})