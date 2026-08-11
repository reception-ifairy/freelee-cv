/**
 * Verifies the dependency-free document reader behind the bot converter
 * (docs/42-bot-converter.md).
 *
 * The `.docx`/`.xlsx` fixtures are **built here**, as real ZIP archives with
 * real deflate streams, rather than checked in as binaries. A committed
 * fixture proves the reader handles that one file; a writer proves it handles
 * the format, and it stays readable in a diff.
 *
 *   npx tsx scripts/verify-document-extract.ts
 */

import { deflateRawSync, crc32 } from 'node:zlib';
import { extractDocument, isSupportedDocument, extensionOf } from '../src/lib/documents/extract';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/* ---------------------------- a minimal ZIP writer ---------------------------- */

function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const source = Buffer.from(content, 'utf8');
    const deflated = deflateRawSync(source);
    const nameBytes = Buffer.from(name, 'utf8');
    const sum = crc32(source);

    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(source.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    nameBytes.copy(local, 30);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(sum, 16);
    central.writeUInt32LE(deflated.length, 20);
    central.writeUInt32LE(source.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    nameBytes.copy(central, 46);

    locals.push(local, deflated);
    centrals.push(central);
    offset += local.length + deflated.length;
  }

  const directory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(centrals.length, 8);
  eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, directory, eocd]);
}

/* --------------------------------- fixtures --------------------------------- */

const DOCX = zip({
  '[Content_Types].xml': '<Types/>',
  'word/document.xml':
    '<?xml version="1.0"?><w:document xmlns:w="w"><w:body>' +
    '<w:p><w:r><w:t>Aurora &amp; Co. Support Bot</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Tone:</w:t></w:r><w:tab/><w:r><w:t>warm, patient, never pushy</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>Never quote prices &lt;without&gt; checking &#8212; ever.</w:t></w:r></w:p>' +
    '</w:body></w:document>',
});

const XLSX = zip({
  'xl/sharedStrings.xml':
    '<sst><si><t>Field</t></si><si><t>Value</t></si><si><t>Persona name</t></si>' +
    '<si><t>Nova &amp; the Concierge</t></si></sst>',
  'xl/worksheets/sheet1.xml':
    '<worksheet><sheetData>' +
    '<row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row>' +
    '<row><c t="s"><v>2</v></c><c t="s"><v>3</v></c></row>' +
    '<row><c t="s"><v>0</v></c><c><v>42</v></c></row>' +
    '<row></row>' +
    '</sheetData></worksheet>',
});

/* ---------------------------------- checks ---------------------------------- */

async function main() {
  console.log('\nDocument extraction\n');

  console.log('Extensions');
  check('.docx is supported', isSupportedDocument('Brand Book.DOCX'));
  check('.exe is not', !isSupportedDocument('payload.exe'));
  check('an extensionless name is not', !isSupportedDocument('README'));
  check('the last dot wins', extensionOf('archive.tar.gz') === '.gz');

  console.log('\nWord');
  const docx = await extractDocument('bot.docx', DOCX);
  const docxText = docx.mode === 'text' ? docx.text : '';
  check('reads the body', docxText.includes('Aurora & Co. Support Bot'));
  check('decodes named entities', docxText.includes('prices <without> checking'));
  check('decodes numeric entities', docxText.includes('checking — ever'));
  check('keeps the tab between label and value', docxText.includes('Tone:\twarm, patient, never pushy'));
  check('paragraphs become lines', docxText.split('\n').length >= 3);
  check('no XML tags survive', !docxText.includes('<w:'));

  console.log('\nExcel');
  const xlsx = await extractDocument('config.xlsx', XLSX);
  const xlsxText = xlsx.mode === 'text' ? xlsx.text : '';
  check('resolves shared strings', xlsxText.includes('Persona name\tNova & the Concierge'));
  check('keeps literal cell values', xlsxText.includes('Field\t42'));
  check('rows are preserved in order', xlsxText.split('\n')[0] === 'Field\tValue');
  check('empty rows are dropped', xlsxText.split('\n').length === 3, xlsxText.split('\n').length + ' rows');

  console.log('\nPlain text');
  const md = await extractDocument('brief.md', Buffer.from('# Nova\n\nAlways answers in Polish.', 'utf8'));
  check('markdown passes through untouched', md.mode === 'text' && md.text.includes('Always answers in Polish.'));
  check('not truncated', md.mode === 'text' && !md.truncated);

  const long = await extractDocument('long.txt', Buffer.from('x'.repeat(200_000), 'utf8'));
  check('an over-long document is truncated', long.mode === 'text' && long.truncated);
  check('truncated to the cap', long.mode === 'text' && long.text.length === 120_000);

  console.log('\nPDF');
  const pdf = await extractDocument('guide.pdf', Buffer.from('%PDF-1.7 fake', 'utf8'));
  check('is handed to the model as a file, not parsed', pdf.mode === 'file');
  check('carries the right media type', pdf.mode === 'file' && pdf.mediaType === 'application/pdf');

  console.log('\nRejections');
  for (const [label, name, bytes] of [
    ['an unsupported type', 'malware.exe', Buffer.from('MZ')],
    ['an empty text file', 'empty.txt', Buffer.from('   \n  ')],
    ['a .docx that is not a ZIP', 'fake.docx', Buffer.from('not a zip at all')],
    ['a ZIP with no document body', 'odd.docx', zip({ 'other.xml': '<x/>' })],
  ] as const) {
    let threw = false;
    try {
      await extractDocument(name, bytes);
    } catch {
      threw = true;
    }
    check(`${label} is refused`, threw);
  }

  console.log(`\n${passed}/${passed + failed} passed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
