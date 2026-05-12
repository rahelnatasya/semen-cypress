const fs = require('fs');
const path = require('path');

module.exports = {
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        
        // Task buatan kita sendiri murni menggunakan Node.js (Tanpa library glob)
        findFiles({ folder, mask }) {
          
          // 1. Cek apakah folder 'downloads' sudah ada
          // (Kadang Cypress belum membuat foldernya kalau belum ada yang didownload)
          if (!fs.existsSync(folder)) {
            return []; // Kembalikan kosong jika folder tidak ada
          }

          // 2. Baca seluruh nama file yang ada di dalam folder tersebut
          const files = fs.readdirSync(folder);

          // 3. Kita ubah pola '*.xlsx' menjadi sekadar '.xlsx'
          const extension = mask.replace('*', ''); 

          // 4. Saring dan kembalikan hanya file yang berakhiran '.xlsx'
          const matchedFiles = files.filter((file) => file.endsWith(extension));
          
          return matchedFiles;
        }
        
      })
    },
    // ... konfigurasi lainnya tetap biarkan seperti semula
  },
};