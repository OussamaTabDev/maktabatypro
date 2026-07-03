# MaktabatyPro

**MaktabatyPro** is a comprehensive document management and productivity hub built for Moroccan businesses and professionals. It unifies template creation, PDF management, link bookmarking, card layout design, file compression, rich text editing, and calendar planning into a single, elegant desktop application with offline-first architecture.

---

## What It Does

MaktabatyPro replaces a scattered set of tools with one cohesive system. You create and fill document templates, manage a library of PDFs, process PDFs (merge, split, compress, encrypt, watermark, and more), save and organize bookmarks, design card layouts on a canvas, compress images and PDFs, edit rich text documents, and plan your schedule — all with quad-lingual (Arabic/English/French/Spanish) support and RTL layout built in from the ground up. Everything runs locally on your device, no internet required.

---

## Feature Overview

### 1. Template Engine
- **Rich-text template editor** powered by TipTap (ProseMirror) with a comprehensive toolbar — font family, size, bold, italic, underline, strikethrough, subscript, superscript, color, highlight, alignment, lists, indentation, links, tables, inline images
- **Live preview** as you type — what you see is exactly what gets exported
- **Fill mode** — pre-fill templates with structured fields and export to DOCX or PDF
- **Advanced template engine** with conditional blocks (`{{#if}}`/`{{#elif}}`/`{{#else}}`), loops (`{{#each}}` with sort/where), toggleable sections, switch/case blocks
- **System variables** — `{{TODAY}}`, `{{CURRENT_YEAR}}`, `{{DOCUMENT_ID}}`, `{{AUTO_SERIAL}}`, `{{AGE_FROM:BIRTH_DATE}}`, `{{DATE_DIFF}}`, `{{DOCUMENT_ID}}`
- **Math expressions** — safe recursive-descent parser for `{{FIELD1 + FIELD2}}`, ternary operators, null-coalescing
- **Filters and macros** — `upper`, `lower`, `title`, `trim`, `truncate`, custom macros, includes, i18n keys (`{{t:KEY}}`)
- **Multi-language template titles** — Arabic, French, English, Spanish labels per template
- **Categories, tags, favorites** to organize your template library
- **Draft history** with auto-save and version history
- **Batch fill** — fill one template with multiple data rows at once
- **Print queue** — queue documents for batch printing
- **Bulk import** templates from files (DOCX or JSON)
- **QR sharing** — share templates via QR codes
- **Export history** — track and re-download past exports
- **DOCX template import** — import Word documents and auto-detect fillable fields
- **Backup & restore** — full data export/import with encryption
- **Auto-backup** — configurable scheduled backups

### 2. PDF Library
- **Drag-and-drop upload** — drop PDF files directly onto the page
- **IndexedDB storage** — all PDFs stay on your device, no server required
- **Grid and list views** with thumbnails and metadata
- **Categories, tags, date ranges, and seasonal colors**
- **Reminders with system notifications** — get alerted on the right day
- **Calendar filter** — click a day or drag to select a range and instantly filter your library
- **Quick print** or **add to print queue** for batch printing
- **Full analytics dashboard** — views, prints, distribution by category, total size
- **Bulk actions** — delete, archive, favorite, add to print queue
- **Search** — full-text search across titles and notes
- **Notes per document** — attach notes to any PDF
- **Inline preview** — view PDFs directly in the app via blob URL

### 3. PDF Editor (Annotations)
- **Overlay annotations** on top of any PDF page — text, rectangles, arrows, signatures, images
- **Rich-text toolbar** for text overlays: font family, size, bold, italic, underline, strikethrough, subscripts/superscripts, color, highlight, background color, alignment, lists, indentation, links
- **Drag-to-draw** rectangles and arrows directly on the page
- **Signature pad** — draw your signature and stamp it onto the PDF
- **Drag to move and resize** any overlay
- **Lock/unlock** overlays to prevent accidental edits
- **Print with annotations** — renders overlays perfectly in the print output
- **Keyboard shortcuts** — V=select, T=text, R=rect, A=arrow, S=signature, I=image, Ctrl+S=save, Ctrl+D=duplicate, Del=delete, F11=fullscreen

### 4. PDF Toolbox
- **Merge PDF** — combine multiple PDFs with page range selection and per-file rotation
- **Split PDF** — split by visual selection, page ranges, every N pages, or by file size
- **Organize pages** — drag-to-reorder, rotate, duplicate, delete pages visually
- **Rotate PDF** — rotate all or specific pages by 90°/180°/270°
- **Image to PDF** — convert JPG/PNG/WebP to PDF with configurable page size, margins, orientation
- **PDF to Image** — convert PDF pages to PNG/JPEG with configurable DPI
- **Page numbers** — add formatted page numbers (numeric/roman/alpha) with prefix, suffix, font options
- **Watermark** — add text or image watermark with opacity, rotation, position (center/tile), page range
- **Security** — encrypt/decrypt with user/owner passwords, set permissions (print, copy, modify, annotate)
- **Compress** — reduce file size with light/balanced/aggressive levels, optional metadata removal
- **Processing history** — IndexedDB store of all past operations with ability to re-download

### 5. Link Library
- **Save any URL** — auto-fetches the favicon and detects the domain
- **Grid/list views** with colored hero banners per domain (GitHub, YouTube, Twitter, etc.)
- **Categories, tags, seasons, date ranges, and reminders**
- **Automation rules** — if URL/title contains X → auto-tag / auto-categorize / auto-archive / auto-remind
- **Browser bookmark import** — upload an HTML bookmarks file and import all links at once
- **Export bookmarks** as a standard HTML bookmark file
- **Live preview** — click a link to open it in a new tab
- **Copy link to clipboard** with one click
- **Full analytics** — total links, favorites, visits, domain count, distribution
- **Admin service info** — steps, required documents, pricing per service for Moroccan administrative portals

### 6. Card Layout Designer
- **Artboard canvas** — multi-page WYSIWYG canvas built on Konva with drag-select, pan, zoom
- **Image placement** — drag & drop images onto canvas, resize, rotate, crop
- **Layers panel** — layer stack with reorder, visibility toggle, lock
- **Properties panel** — position, size, rotation, opacity per element
- **Image editor** — crop, flip, skew, fit modes (contain/cover)
- **Layout presets** — grid/table layout presets with auto-arrange
- **Alignment tools** — align left/center/right, distribute evenly
- **Undo/redo** — full project history stack
- **Multi-page** — add, delete, reorder pages
- **Export** — export to PDF, print, or canvas image
- **Projects** — save/load/delete projects with encryption
- **Project history** — project version history
- **Batch import** — import multiple images at once

### 7. Rich Text Editor
- **Full TipTap editor** — standalone WYSIWYG document editor with formatting toolbar (fonts, colors, tables, images, links, alignment, lists)
- **Document management** — save, load, delete documents
- **Export** — export to PDF or DOCX

### 8. File Compressor
- **Image compression** — quality slider (light/balanced/aggressive/custom) via `browser-image-compression`
- **PDF compression** — multi-level PDF size reduction
- **Batch processing** — process multiple files simultaneously
- **Download all** — download individual or all compressed files as ZIP
- **Compression stats** — original vs compressed size comparison

### 9. Calendar Planning
- **Month view** — colored timeline blocks per document spanning their date range
- **Year heatmap** — 12-month overview with document density per month
- **Agenda view** — sorted list of all scheduled documents
- **Drag blocks** to move their date range
- **Click a day** to add a new entry or edit an existing one
- **Conflict detection** — warns when too many documents overlap on one day
- **Season filtering** — spring/summer/autumn/winter
- **Status filtering** — active vs expired
- **Bulk select** blocks — move, recolor, or delete
- **Keyboard shortcuts** — T=today, ←→=navigate, A=add, Del=delete selected

### 10. Usage Dashboard
- **Stat cards** — total templates, exports, categories
- **Busiest hours chart** — when you use the app most
- **Category breakdown** — pie/donut chart by template category
- **Daily exports chart** — exports over time
- **Export growth trend** — week-over-week growth
- **Popular templates** — most-used templates ranked
- **Recent activity feed** — latest actions with timestamps
- **Weekly comparison** — this week vs last week

### 11. Command Palette
- Press **⌘K** (or **Ctrl+K**) to open a searchable command palette for fast navigation across all pages and actions

### 12. Global Categories System
- **Unified category management** — global categories with sub-categories, multi-language names (AR/FR/EN/SP)
- **Category icons and colors** — customizable icons per category
- **Parent-child hierarchy** — sub-categories nested under global categories with drag-reorder
- **Auto-categorization** — rules to auto-assign items to categories based on content

### 13. Onboarding Wizard
- **Step-by-step first-run experience** — guides new users through app setup, language selection, theme preference, and feature overview

### 14. PWA Support
- **Progressive Web App** — installable on desktop and mobile via `beforeinstallprompt`
- **Service worker** — offline-capable with vite-plugin-pwa

### 15. Backup & Restore
- **Full backup** — export all templates, PDF library metadata, card layout projects, settings, and link library data as an encrypted JSON file
- **Auto-backup** — configurable scheduled backups (daily/weekly/monthly) with automatic file saving via File System Access API
- **Restore** — import from backup file with integrity verification
