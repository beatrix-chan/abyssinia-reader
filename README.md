# ![icon](/src/assets/app-icons/icon-48.svg) Abyssinia Reader

> *Last Updated*: 5<sup>th</sup> September, 2025

> [!IMPORTANT]
> Abyssinia Reader's major files are uploaded to GitHub on **31<sup>st</sup> August 2025**. Code are not properly documented yet, guides are rough drafts only. The pre-release version of the Abyssinia Reader is aimed to be published before the end of September, and officially publish the first release before November. For more inquiries, please contact me via email (beatrix.chan.dev@proton.me). ***Please don't open any issues, pull requests, or fork the repository at this state.***

![Electron](https://img.shields.io/badge/Electron-272a37?style=for-the-badge&logo=electron) ![Version](https://img.shields.io/badge/Version-1.0.0-aquamarine?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMjAgMjAiPjxwYXRoIGZpbGw9IiNmYWZhZmEiIGQ9Ik0xMC4zNjggMGEuNjguNjggMCAwIDEgLjQ4NC4yMDFsOC4zNSA4LjM5Yy41NTguNTg2LjgzNiAxLjI0OS43OTQgMS45NThjLS4wNC42NjQtLjMwNCAxLjI3NC0uODA3IDEuODQ2bC03LjA3NCA3LjAzN2wtLjExNS4wOTJjLS42MzguNDA2LTEuMjYuNTY0LTEuODUuNDI4Yy0uNTE1LS4xMTgtMS4wNTQtLjQzNi0xLjY3Ny0uOTc4bC04LjE2LTguMjE5YS42OC42OCAwIDAgMS0uMTk5LS40N0wwIDEuNDcyQy4wMDcgMS4wNDQuMTI2LjY4MS4zOTIuNDEzQy42NjYuMTM4IDEuMDU1LjAyMyAxLjU4OCAwek02LjQ3MyA0LjU3NGExLjU5IDEuNTkgMCAxIDAgMCAzLjE4Yy44NzkgMCAxLjU5My0uNzExIDEuNTkzLTEuNTljMC0uODc4LS43MTMtMS41OS0xLjU5My0xLjU5Ii8+PC9zdmc+&logoColor=a0ebf9) [![License](https://img.shields.io/badge/License-GPL--3.0_license-e08d3c?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxZW0iIGhlaWdodD0iMWVtIiB2aWV3Qm94PSIwIDAgMTYgMTYiPjxwYXRoIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2Y1YTk3ZiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBkPSJNNC41IDEzLjVoN004LjAxIDF2MTIuMDZNMS41IDMuNWgzbDEuNS0xaDRsMS41IDFoM00uNSAxMEwzIDQuNDhMNS41IDEwQzQgMTEgMiAxMSAuNSAxMG0xMCAwTDEzIDQuNDhMMTUuNSAxMGMtMS41IDEtMy41IDEtNSAwIi8+PC9zdmc+)](LICENSE)
<details>

<summary>Table of Contents</summary>

- [About](#about)
  - [Features](#features)
- [Getting Started](#getting-started)
- [Extra Information](#extra-information)
  - [Development Environment](#development-environment)
  - [Packages](#packages)
  - [Skills Used](#skills-used)
  - [Tools Used](#tools-used)
  - [License](#license)

</details>

## About

The name **Abyssinia Reader** is a direct nod to the Abyssinian cat, emphasizing the unique aspect for this PDF application built with ElectronJS.

### Features

- **No Ads**
- **No Subscription Plans**
- **Completely Open Source**
- **Basics**:
    - Open and read a PDF
    - Highlighters
    - Comment
    - Share PDF
    - Print
    - Signature
    - Stamps
    - Create PDF from images (`.png`/`.jpg`/`.jpeg`/`webp`)
    - Reorganize/reorder pages
    - Rotate and crop
- **Advanced**:
    - Extract text (export as `.txt`)
    - Export as (images)
- **Planned**:
    - Resize document
    - Support more exporting options (`.html`, `.docx`/`rtf`, etc.)
    - In-app edit text
    - Summarize selected sections
    - Password protections
    - Compare between PDFs
    - Translate document

## Getting Started

1. Fork my repository
2. Git clone to your local machine
   ```bash
   git clone https://github.com/<your-username>/abyssinia-reader.git
   ```
3. 
    ```bash
    # cd into project directory
    cd abyssinia-reader
    ```
4. 
    ```bash
    # Install dependencies
    npm install
    # Start the app
    npm start
    ```

## Extra Information

### Development environment

- [miniconda](https://www.anaconda.com/docs/getting-started/miniconda/) as distributor
    - [conda](https://docs.conda.io/en/latest/) as environment manager
- [npm 11.5.2](https://www.npmjs.com/) as package manager
- [VSCodium](https://vscodium.com) as IDE
    - [Cursor](https://cursor.com/en) light debug
    - [Cline (anthropic/claude-sonnet-4)](https://marketplace.visualstudio.com/items?itemName=saoudrizwan.claude-dev) heavy debug
- [Prettier](https://prettier.io/) as coding style

### Packages

> [!NOTE]
> You may also check [`package.json`](package.json)

- [`@fontawesome/fontawesome-free@7.0.0`](https://www.npmjs.com/package/@fortawesome/fontawesome-free/v/7.0.0)
- [`concurrently@9.2.0`](https://www.npmjs.com/package/concurrently/v/9.2.0)
- [`electron@37.3.1`](https://www.npmjs.com/package/electron/v/37.3.1)
- [`fabric@6.7.1`](https://www.npmjs.com/package/fabric/v/6.7.1)
- [`file-type@21.0.0`](https://www.npmjs.com/package/file-type/v/21.0.0)
- [`html-docx-js@0.3.1`](https://www.npmjs.com/package/html-docx-js/v/0.3.1)
- [`jspdf@3.0.1`](https://www.npmjs.com/package/jspdf/v/3.0.1)
- [`konva@9.3.22`](https://www.npmjs.com/package/konva/v/9.3.22)
- [`mammoth@1.10.0`](https://www.npmjs.com/package/mammoth/v/1.10.0)
- [`pdf-lib@1.17.1`](https://www.npmjs.com/package/pdf-lib/v/1.17.1)
- [`pdfjs-dist@3.11.174`](https://www.npmjs.com/package/pdfjs-dist/v/3.11.174)
- [`sharp@0.34.3`](https://www.npmjs.com/package/sharp/v/0.34.3)
- [`wait-on@8.0.4`](https://www.npmjs.com/package/wait-on/v/8.0.4)

### Skills Used

[![ElectronJS](https://skills.syvixor.com/api/icons?i=electron)](https://www.electronjs.org/) [![HTML](https://skills.syvixor.com/api/icons?i=html)](https://developer.mozilla.org/en-US/docs/Web/HTML) [![CSS](https://skills.syvixor.com/api/icons?i=css)](https://developer.mozilla.org/en-US/docs/Web/CSS) [![JavaScript](https://skills.syvixor.com/api/icons?i=js)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

### Tools used

[![Cursor](https://skills.syvixor.com/api/icons?i=cursor)](https://cursor.com/en) [![Cline](https://skills.syvixor.com/api/icons?i=cline)](https://cline.bot)

### License

> Abyssinia Reader is an open source PDF reader and editor built with ElectronJS.
> 
> ***Copyright (C) 2025  Beatrix CHAN. All rights reserved.***
> 
> This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License or any later version.
> 
> This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
> You should have received [a copy of the GNU General Public License](LICENSE) along with this program. If not, see https://www.gnu.org/licenses.

Licensed under the [GPL 3.0](LICENSE) license.
