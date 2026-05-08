describe('Executive Overview - Market Share Brand', () => {
  
  beforeEach(() => {
    // Abaikan error Vite HMR
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      return true; 
    });

    // Proses Login
    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })

    // Pastikan berhasil masuk dashboard
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  // --- SKENARIO UTAMA: Happy Path Memastikan UI Dropdown & Satuan ---
  it('Memverifikasi perubahan satuan (ZAK dan %) berdasarkan dropdown filter', () => {
    
    // SOLUSI: Kita berikan Mock Data agar Legend pasti muncul baik saat Volume maupun Visits!
    cy.intercept('GET', '**/api/v1/dashboard/market-share*', {
      statusCode: 200,
      body: {
        status: "success",
        data: [
          { name: "Semen Grobogan", value: 5000 },
          { name: "Tiga Roda", value: 3000 }
        ]
      }
    }).as('getMockMarketShareMain')

    cy.visit('http://pepi-semen.inaai.ai:5173/')
    cy.wait('@getMockMarketShareMain')

    cy.contains('h3', /Market Share Brand by (Volume|ASI)/)
      .scrollIntoView()
      .closest('.bg-white') 
      .within(() => {
        
        // --- UJI VOLUME ---
        cy.get('select').select('volume')
        cy.get('select').should('have.value', 'volume')
        cy.contains('h3', 'Market Share Brand by Volume').should('be.visible')

        // Verifikasi Satuan Produk (ZAK)
        cy.get('.mt-3 > div > span.font-medium').each(($span) => {
          cy.wrap($span).should('contain.text', 'ZAK')
          cy.wrap($span).should('not.contain.text', '%')
        })

        // --- UJI VISITS (ASI) ---
        cy.get('select').select('visits')
        cy.get('select').should('have.value', 'visits')
        cy.contains('h3', 'Market Share Brand by ASI').should('be.visible')

        // Verifikasi Satuan Produk (ASI %)
        cy.get('.mt-3 > div > span.font-medium').each(($span) => {
          cy.wrap($span).should('contain.text', '%')
          cy.wrap($span).should('not.contain.text', 'ZAK') 
        }) 
      })
  })

  // --- SKENARIO 1: Empty State (Data Kosong) ---
  it('Skenario 1: Menampilkan Empty State saat API mengembalikan data kosong', () => {
    
    cy.intercept('GET', '**/api/v1/dashboard/market-share*', {
      statusCode: 200,
      body: { status: 'success', data: [] }
    }).as('getEmptyMarketShare')

    cy.visit('http://pepi-semen.inaai.ai:5173/')
    cy.wait('@getEmptyMarketShare')

    cy.contains('h3', /Market Share Brand by (Volume|ASI)/)
      .scrollIntoView()
      .closest('.bg-white')
      .within(() => {
        cy.get('.recharts-surface').should('not.exist')
        cy.contains('No data yet').should('be.visible')
        cy.contains('Data will appear once available').should('be.visible')
        cy.get('select').should('not.be.disabled').select('visits')
      })
  })

  // --- SKENARIO 2: Kegagalan API (Network Error 500) ---
  it('Skenario 2: Menangani error server (500) tanpa membuat aplikasi crash', () => {
    
    cy.intercept('GET', '**/api/v1/dashboard/market-share*', {
      statusCode: 500,
      body: { message: "Internal Server Error" }
    }).as('getErrorMarketShare')

    cy.visit('http://pepi-semen.inaai.ai:5173/')
    cy.wait('@getErrorMarketShare')

    // SOLUSI: Tambahkan scrollIntoView sebelum should('be.visible') agar elemen tidak dianggap 'clipped'
    cy.contains('h3', /Market Share Brand by/)
      .scrollIntoView()
      .should('be.visible')
      .closest('.bg-white')
      .within(() => {
        cy.get('.recharts-surface').should('not.exist')
        cy.contains('No data yet').should('be.visible') 
      })
  })

  // --- SKENARIO 3: Interaksi dengan Date Range Filter ---
  it('Skenario 3: Filter satuan (Volume/ASI) tetap bekerja setelah filter tanggal diubah', () => {
    
    // Kita berikan Mock Data agar saat tanggal difilter (April 2026), chart TIDAK kosong 
    // dan elemen Legend (.mt-3) pasti dirender untuk diuji.
    cy.intercept('GET', '**/api/v1/dashboard/market-share*', {
      statusCode: 200,
      body: {
        status: "success",
        data: [{ name: "Semen Grobogan", value: 5000 }]
      }
    }).as('getMockMarketShareDate')

    cy.contains('button', 'Choose Date Range').click()
    cy.get('input[type="date"]').first().type('2026-04-01') 
    cy.get('input[type="date"]').last().type('2026-04-30')  
    cy.contains('button', 'Apply Filter').click()

    cy.wait('@getMockMarketShareDate')

    cy.contains('h3', /Market Share Brand by/)
      .scrollIntoView()
      .closest('.bg-white')
      .within(() => {
        cy.get('select').select('volume')
        cy.get('.mt-3 > div > span.font-medium').first().should('contain.text', 'ZAK')

        cy.get('select').select('visits')
        cy.get('.mt-3 > div > span.font-medium').first().should('contain.text', '%')
      })
  })

  // --- SKENARIO 4: Validasi Teks (Info Box) ---
  it('Skenario 4: Teks informasi kotak biru berubah mengikuti filter', () => {
    
    // SOLUSI: Mengganti asersi teks SVG dengan asersi teks kotak informasi biru.
    // Ini jauh lebih valid dan stabil daripada menguji isi teks Recharts SVG.
    cy.contains('h3', /Market Share Brand by/)
      .scrollIntoView()
      .closest('.bg-white')
      .within(() => {
        
        // 1. Saat Volume dipilih
        cy.get('select').select('volume')
        cy.contains('Volume represents the total accumulated volume').should('be.visible')
        cy.contains('Average monthly market share percentage').should('not.exist')

        // 2. Saat Visits (ASI) dipilih
        cy.get('select').select('visits')
        cy.contains('Average monthly market share percentage').should('be.visible')
        cy.contains('Volume represents the total accumulated volume').should('not.exist')

      })
  })
})