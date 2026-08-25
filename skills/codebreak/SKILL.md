---
name: codebreak
description: >
  Simpan penjelasan kode (local changes, commit, file, atau deskripsi fitur)
  sebagai dokumen interaktif MDX ke codebreak viewer. Gunakan saat pengguna
  meminta menjelaskan atau mendokumentasikan kode agar bisa dibuka di browser
  lewat `codebreak view`, menambah analisis ke koleksi dokumen proyek, atau
  setelah menyelesaikan perubahan kode yang layak didokumentasikan.
---

# codebreak — dokumentasi kode interaktif via agen

Anda (agen) adalah **penulis dokumennya**. Tidak perlu LLM eksternal terkonfigurasi:
kumpulkan konteks sendiri dengan tool yang Anda punya (baca file, jalankan git/grep),
tulis dokumen mengikuti kontrak di bawah, lalu simpan dengan CLI `codebreak`.
Dokumen otomatis muncul di web viewer lokal (`codebreak view`) tanpa restart.

## Alur kerja

1. **Kumpulkan konteks** sesuai permintaan pengguna:
   - Perubahan lokal: `git status --porcelain` + `git diff HEAD` (+ baca isi file untracked).
   - Commit/range: `git show <ref>` untuk satu commit; `git log --oneline A..B` dan
     `git diff A B` untuk range.
   - File/folder: baca langsung.
   - Deskripsi fitur ("bagaimana payment webhook bekerja?"): cari file relevan sendiri
     (grep/glob nama simbol), lalu baca filenya.
2. **Tulis dokumen** mengikuti kontrak isi & MDX-safety di bawah.
3. **Simpan** lewat CLI:
   ```bash
   codebreak add /tmp/doc.mdx                 # dari file sementara
   cat /tmp/doc.mdx | codebreak add -         # dari stdin
   ```
4. **Selesai**: beri tahu pengguna menjalankan `codebreak view` jika viewer belum
   berjalan. Jangan jalankan `codebreak view` sebagai proses blocking tanpa diminta;
   cukup sarankan. Dokumen baru selalu muncul otomatis di viewer yang sudah jalan.

## Kontrak frontmatter

`codebreak add` menerima markdown **dengan atau tanpa frontmatter** — frontmatter yang
ada dipertahankan dan dinormalisasi:

| Kolom   | Wajib?      | Isi                                                              |
| ------- | ----------- | ---------------------------------------------------------------- |
| title   | disarankan  | judul dokumen; kosong → diambil dari heading pertama             |
| type    | opsional    | `changes` \| `commit` \| `file` \| `description` \| `note` (default `note`) |
| source  | opsional    | mis. `commit abc123`, `src/auth/`, atau pertanyaan pengguna      |

`date`, nama file (slug), dan penanganan tabrakan nama diisi otomatis oleh CLI.
Override per kolom tanpa mengedit file: `--title`, `--type`, `--source`, `--locale`.

## Kontrak isi dokumen (MDX-safe)

- Semua teks dalam **bahasa pengguna**.
- Awali dokumen dengan baris judul `# Judul Dokumen` (atau sertakan frontmatter
  `title:` / flag `--title`) — ini menentukan nama file dan tampilan di viewer.
- Mulai dengan `## Ringkasan` — TL;DR maksimal 6 bullet.
- Satu seksi `### path/ke/file.ext` per file yang dibahas.
- Unit penjelasan dibungkus collapsible HTML native:
  ```markdown
  <details open>
  <summary>Blok: namaFungsi · baris 12-40</summary>

  Penjelasan blok...

  ```ts
  cuplikan kode pendek (< ~30 baris), persis dari sumber
  ```

  </details>
  ```
- Kedalaman sesuai permintaan: `overview` = arsitektur saja tanpa detail fungsi;
  `block` = per fungsi/kelas/blok + rentang baris; `line` = block + referensi `L<n>`
  untuk baris yang subtle/berisiko.
- **Larangan MDX-safety** (melanggar = dokumen gagal render):
  - Jangan tulis karakter `<` telanjang di luar code fence — pakai kata "kurang dari"
    atau bungkus ekspresi dalam backticks.
  - Jangan mulai baris dengan `{` di luar code fence.
  - Tanpa `import`/`export`, tanpa komponen JSX; hanya elemen HTML biasa:
    `<details>`, `<summary>`, `<b>`, `<em>`, `<code>`.

## Referensi perintah lain

- `codebreak explain --changes|--commit <ref>|<path>|"<deskripsi>"` — generate dokumen
  via LLM server (butuh provider terkonfigurasi di `~/.config/codebreak/config.json`).
  Tidak diperlukan untuk alur skill ini.
- `codebreak doctor` — cek kesehatan instalasi.
- Dokumen tersimpan di `<repo>/.codebreak/docs/YYYY-MM-DD-<slug>.mdx`.
