describe('Executive Overview - Price Trend by Brand', () => {
  beforeEach(() => {
    // Menyembunyikan error WebSocket dari Vite HMR
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) {
        return false; 
      }
      return true; 
    });

    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })

    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  it('Memverifikasi filter Brand dan Line Chart pada Price Trend (Happy Path)', () => {
    cy.contains('h3', 'Price Trend by Brand')
      .scrollIntoView()
      .should('be.visible')
      .closest('.bg-white.rounded-xl') 
      .within(() => {
        
        // Validasi default Brand
        const defaultBrands = ['Semen Grobogan', 'Semen Merdeka', 'Semen Gresik', 'Tiga Roda']
        defaultBrands.forEach((brand) => {
          cy.contains('button', brand)
            .should('be.visible')
            .and('have.class', 'text-white') 
            .and('have.class', 'border-transparent')
        })

        cy.contains('Selling Price Trend').should('be.visible')
        cy.contains('Buying Price Trend').should('be.visible')

        // Uji interaksi Button Brand Tiga Roda
        cy.contains('button', 'Tiga Roda').click()
        cy.contains('button', 'Tiga Roda')
          .should('have.class', 'text-slate-400')
          .and('not.have.class', 'text-white')

        cy.contains('button', 'Tiga Roda').click()
        cy.contains('button', 'Tiga Roda').should('have.class', 'text-white')

        // Hover mouse ke Line Chart
        cy.get('.recharts-surface')
          .first() 
          .trigger('mouseover', { force: true })
          .trigger('mousemove', 150, 100, { force: true })
      }) 

    // Verifikasi Tooltip (Di luar within)
    cy.get('.recharts-tooltip-wrapper')
      .should('be.visible')
      .and('contain', 'Rp') 
  })
  
  it('Skenario 1: Menghapus semua pilihan brand dan Memilih semua brand', () => {
    cy.contains('h3', 'Price Trend by Brand')
      .scrollIntoView()
      .closest('.bg-white.rounded-xl')
      .within(() => {
        
        // --- SKENARIO UNSELECT ALL ---
        cy.get('.flex.flex-wrap.gap-2 button.text-white').each(($btn) => {
          cy.wrap($btn).click({ force: true })
        })

        cy.contains('0 brand selected').should('be.visible')
        cy.get('.flex.flex-wrap.gap-2 button.text-white').should('not.exist')


        // --- SKENARIO SELECT ALL ---
        cy.get('.flex.flex-wrap.gap-2 button.text-slate-400').each(($btn) => {
          cy.wrap($btn).click({ force: true })
        })

        cy.get('.flex.flex-wrap.gap-2 button').then(($buttons) => {
          const totalBrands = $buttons.length
          cy.contains(`${totalBrands} brand selected`).should('be.visible')
        })

        cy.get('.flex.flex-wrap.gap-2 button.text-slate-400').should('not.exist')
      })
  })

  it('Skenario 2: Data Kosong: Section disembunyikan jika tidak ada trend data', () => {
    
    // PERBAIKAN 3: Intercept API dengan aman tanpa memutus URL spesifik
    cy.intercept('GET', '**/api/**', (req) => {
      req.continue((res) => {
        // Cek jika response memiliki data trend, lalu kosongkan
        if (res.body && res.body.data && res.body.data.sellPriceTrendData) {
          res.body.data.sellPriceTrendData = []
          res.body.data.buyPriceTrendData = []
        }
      })
    }).as('getEmptyDashboardData')

    // Kunjungi ulang halaman dashboard untuk memicu request API yang baru dicegat
    cy.visit('http://pepi-semen.inaai.ai:5173/')

    // Tunggu request selesai
    cy.wait('@getEmptyDashboardData')

    // Verifikasi: Komponen tidak boleh di-render
    cy.contains('Price Trend by Brand').should('not.exist')
  })
})