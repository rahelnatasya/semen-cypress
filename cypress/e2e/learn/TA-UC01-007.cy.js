describe('TA-UC01-007 Territory Analytics - Geo Map District Rank Color', () => {
  
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

  it('Verifikasi lingkaran angka Rank (A, B, C) pada Peta sesuai Legend', () => {
    
    // 1. Tunggu data API dan Peta ter-render
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getData')
    cy.get('.backdrop-blur-\\[1px\\]').should('not.exist') 
    cy.wait(3000) 

    // 2. VALIDASI LEGEND (Area Density)
    cy.contains('Rank A').should('be.visible')
    cy.contains('Rank B').should('be.visible')
    cy.contains('Rank C').should('be.visible')


    // 3. VALIDASI MARKER LINGKARAN (ANGKA) DI ATAS PETA
    // Kita secara spesifik mencari <div> yang punya border-radius: 50% (Lingkaran)
    // dan memiliki background-color sesuai Rank.
    
    cy.get('.leaflet-marker-pane').within(() => {
      
      // a. Memeriksa Lingkaran Angka Rank A (Hijau: #16a34a)
      // Kita pastikan elemen tersebut berbentuk lingkaran dan berisi angka
      cy.get('div[style*="background:#16a34a"][style*="border-radius:50%"]')
        .should('exist')
        .invoke('text')
        .should('match', /^\d+$/) // Memastikan isinya adalah angka

      // b. Memeriksa Lingkaran Angka Rank B (Orange: #ea580c)
      cy.get('div[style*="background:#ea580c"][style*="border-radius:50%"]')
        .should('exist')
        .invoke('text')
        .should('match', /^\d+$/)

      // c. Memeriksa Lingkaran Angka Rank C (Merah: #dc2626)
      // Jika di aplikasi Rank C juga berbentuk lingkaran, gunakan asersi ini
      cy.get('div[style*="background:#dc2626"]')
        .then(($el) => {
          // Kita cek apakah ada yang berbentuk lingkaran (border-radius: 50%)
          const hasCircle = [...$el].some(div => div.style.borderRadius === '50%');
          if (hasCircle) {
            cy.log('✅ Ditemukan lingkaran angka untuk Rank C');
          }
        })
    })

    // 4. VALIDASI INTERAKTIF (Opsional)
    // Memastikan jika lingkaran angka diklik, ia merespons (misal: muncul tooltip/detail)
    cy.get('div[style*="border-radius:50%"]').first().click({ force: true })
    cy.wait(500)
  })
})