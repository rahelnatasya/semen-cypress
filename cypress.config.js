const fs = require('fs');
const path = require('path');
const nodeXlsx = require('node-xlsx');

module.exports = {
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        
        // Task 1: Mencari file
        findFiles({ folder, mask }) {
          if (!fs.existsSync(folder)) return [];
          const files = fs.readdirSync(folder);
          const extension = mask.replace('*', ''); 
          return files.filter((file) => file.endsWith(extension));
        }, // <--- Tanda koma ini yang biasanya tertinggal

        // Task 2: Membaca isi file Excel
        parseXlsx({ filePath }) {
          return new Promise((resolve, reject) => {
            try {
              const excelData = nodeXlsx.parse(fs.readFileSync(filePath));
              resolve(excelData);
            } catch (error) {
              reject(error);
            }
          });
        }, // <--- Tanda koma ini juga wajib ada

        // Task 3: Membersihkan folder (Aman untuk Windows/Linux/Mac)
        clearFolder({ folderPath }) {
          if (fs.existsSync(folderPath)) {
            // Hapus folder beserta isinya
            fs.rmSync(folderPath, { recursive: true, force: true });
            // Buat ulang foldernya dalam keadaan kosong
            fs.mkdirSync(folderPath);
          }
          return null; // Task di Cypress wajib meng-return sesuatu
        }

      })
    },
    // Jika kamu punya konfigurasi lain seperti baseUrl, viewport, dll, taruh di bawah sini
  },
};