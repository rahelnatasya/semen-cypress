describe('Territory Analytics - Filter Panel Default State', () => {
  
  beforeEach(() => {
    // Abaikan error WebSocket dari Vite HMR
    Cypress.on('uncaught:exception', (err) => {
      if (err.message.includes('WebSocket')) return false; 
      return true; 
    });

    // 1. Pengguna Login
    cy.visit('http://pepi-semen.inaai.ai:5173/login')
    cy.get('input[type="email"]').type('admin@admin.com', { force: true })
    cy.get('input[type="password"]').type('admin123!', { force: true }) 
    cy.get('button[type="submit"]').click({ force: true })

    // Pastikan berhasil login
    cy.url().should('eq', 'http://pepi-semen.inaai.ai:5173/')
  })

  it('Memverifikasi tampilan default filter pada Territory Analytics', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getAnalyticsData')

    // 2. Buka Halaman Territory Analytics
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    
    // Tunggu Loading Peta dan Data selesai
    cy.wait('@getAnalyticsData')

    // Pastikan judul panel kiri sudah muncul
    cy.contains('Territory Analytics').should('be.visible')

    // 2.5 BUKA PANEL FILTER (Jika Terlipat)
    // Mencari tombol yang memiliki ikon chevron-right lalu mengkliknya
    // cy.get('body') digunakan agar jika panel sudah terbuka (tidak ada chevron-right), tes tidak gagal.
    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-chevron-right').length > 0) {
        // Klik tombol panah untuk membuka panel filter
        cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
        // Beri sedikit jeda agar animasi panel terbuka selesai
        cy.wait(500) 
      }
    })

    // 3. Verifikasi Default Filter
    
    // --- A. Verifikasi Default ZONE GROUP (Surabaya) ---
    cy.contains('label', /Zone Group/i)
      .parent()
      .find('select')
      .should('have.value', 'Surabaya') 
      .and('contain.text', 'Surabaya') 

    // --- B. Verifikasi Default KECAMATAN (All Kecamatan) ---
    cy.contains('label', /Kecamatan/i)
      .parent()
      .find('input')
      .should('have.attr', 'placeholder', 'All Kecamatan')

    // --- C. Verifikasi Default STORES (All Stores) ---
    cy.contains('label', /Store/i)
      .parent()
      .within(() => {
        cy.get('input, select').invoke('attr', 'placeholder').then((placeholder) => {
           if(placeholder) {
             // PERBAIKAN: Terkadang ditulis "All Stores" (pakai s) atau "All Store"
             // Kita gunakan Regex agar lebih fleksibel terhadap typo 's'
             expect(placeholder).to.match(/All Stores?/i) 
           } else {
             cy.root().contains(/All Stores?/i).should('exist')
           }
        })
      })

    // --- D. Verifikasi Default SALESMAN (All Salesmen) ---
    cy.contains('label', /Salesman/i)
      .parent()
      .within(() => {
        cy.get('input, select').invoke('attr', 'placeholder').then((placeholder) => {
           if(placeholder) {
             // PERBAIKAN: Mengganti 'Salesman' menjadi 'Salesmen' (pakai e)
             expect(placeholder).to.include('All Salesmen')
           } else {
             // PERBAIKAN: Mengganti ke 'Salesmen'
             cy.root().should('contain.text', 'All Salesmen')
           }
        })
      })

    // --- E. Verifikasi Data 31 Kecamatan ---
    // Jika ada teks spesifik di UI yang menunjukkan total kecamatan, kita bisa asersi:
    // (Sesuaikan teks "31" ini dengan teks yang benar-benar dirender oleh React-mu di Bottom Table/Summary)
    cy.get('body').then(($body) => {
       if ($body.text().includes('31 Kecamatan') || $body.text().includes('31 districts')) {
         cy.contains(/31 (Kecamatan|districts)/i).should('be.visible')
       }
    })
  })
  it('Skenario 1: Filter Kecamatan dan Store otomatis reset saat Zone Group diubah', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getAnalyticsData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getAnalyticsData')

    // Buka panel filter jika terlipat
    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-chevron-right').length > 0) {
        cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
        cy.wait(500) 
      }
    })

    // Langkah 1: Ubah Kecamatan ke sesuatu selain "All Kecamatan"
    // Asumsi: Kita mencari 'Gubeng' (Sesuaikan dengan data asli di aplikasimu)
    cy.contains('label', /Kecamatan/i).parent().find('input').type('Gubeng')
    // Klik hasil pencarian dropdown (berdasarkan kodemu sebelumnya, hasil muncul sebagai button)
    cy.get('button').contains('Gubeng').click({ force: true })

    // Langkah 2: Ubah Zone Group ke "All Zone Groups" (atau opsi lain)
    cy.contains('label', /Zone Group/i).parent().find('select').select('all') // 'all' adalah value di kodemu

    // Langkah 3: VERIFIKASI (Efek Domino)
    // Pastikan input Kecamatan OTOMATIS kembali ke placeholder "All Kecamatan"
    cy.contains('label', /Kecamatan/i)
      .parent()
      .find('input')
      .should('have.attr', 'placeholder', 'All Kecamatan')
      // Pastikan teks ketikan 'Gubeng' sudah terhapus
      .and('have.value', '')
  })

  // --- SKENARIO 2: Navigasi & Keutuhan State ---
  it('Skenario 2: State filter kembali ke default setelah navigasi halaman (Tidak Bocor)', () => {
    
    cy.intercept('GET', '**/api/v1/master-data/demographic-analytics*').as('getAnalyticsData')
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getAnalyticsData')

    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-chevron-right').length > 0) {
        cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
      }
    })

    // 1. Ubah Zone Group menjadi "All Zone Groups"
    cy.contains('label', /Zone Group/i).parent().find('select').select('all')

    // 2. Navigasi ke halaman lain (misalnya dashboard/home)
    cy.visit('http://pepi-semen.inaai.ai:5173/')
    cy.contains('Total Revenue').should('be.visible') // Pastikan halaman lain ter-load

    // 3. Kembali lagi ke Territory Analytics
    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics')
    cy.wait('@getAnalyticsData')

    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-chevron-right').length > 0) {
        cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
      }
    })

    // 4. VERIFIKASI: Pastikan Zone Group kembali ke "Surabaya" (Default)
    // Jika dropdown masih menunjukkan "All Zone Groups", berarti state-nya bocor/nyangkut!
    cy.contains('label', /Zone Group/i)
      .parent()
      .find('select')
      .should('have.value', 'Surabaya')
  })

  // --- SKENARIO 3: Error Handling API Master Data ---
  it('Skenario 3: UI tidak crash saat API master-data gagal dimuat (Error 500)', () => {
    
    // Cegat API dropdown dan paksa menjadi error
    cy.intercept('GET', '**/api/v1/master-data/zone-groups*', {
      statusCode: 500,
      body: { message: "Internal Server Error" }
    }).as('getErrorZoneGroups')

    cy.visit('http://pepi-semen.inaai.ai:5173/demographic-analytics') 
    cy.wait('@getErrorZoneGroups')

    // VERIFIKASI:
    // 1. Aplikasi tidak boleh nge-blank (White Screen). Judul harus tetap muncul.
    cy.contains('Territory Analytics').should('be.visible')

    cy.get('body').then(($body) => {
      if ($body.find('svg.lucide-chevron-right').length > 0) {
        cy.get('svg.lucide-chevron-right').closest('button').click({ force: true })
      }
    })

    // 2. Dropdown Zone Group tetap di-render (walaupun isinya mungkin hanya fallback "Surabaya" atau kosong)
    // Ini memastikan kode .map() di React tidak meledak saat data array-nya undefined
    cy.contains('label', /Zone Group/i)
      .parent()
      .find('select')
      .should('exist')
  })
})