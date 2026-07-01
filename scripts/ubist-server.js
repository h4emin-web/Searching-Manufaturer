/**
 * UBIST 원료별 시장규모 조회 서버 - 제조원 기준
 * 실행: node scripts/ubist-server.js
 */

const express = require('express');
const XLSX = require('xlsx');
const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

const EXCEL_PATH = 'C:/Users/User/Desktop/2026년 2월 UBIST 데이터 (v2.3).xlsm';
const HTML_PATH  = path.join(__dirname, 'ubist.html');
const PORT = 3001;

console.log('📊 Excel 파일 읽는 중... (약 30초 소요)');
const wb  = XLSX.readFile(EXCEL_PATH, { cellDates: false });
const ws  = wb.Sheets['Data'];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const HEADERS = raw[5];
// 단위 컬럼이 숫자가 아닌 행만 사용 (각 제품이 정상행+오염행 2개씩 존재)
const DATA    = raw.slice(6).filter(function(r) {
  if (r[0] === '') return false;
  var unit = (r[135] !== undefined && r[135] !== '') ? String(r[135]).trim() : '';
  var dose = (r[134] !== undefined && r[134] !== '') ? String(r[134]).trim() : '';
  // 단위가 숫자(0 포함)이면 오염된 행 → 제외
  if (unit !== '' && !isNaN(Number(unit))) return false;
  // 용량에 공백 포함(숫자 2개) → 오염된 행 제외
  if (dose.indexOf(' ') !== -1) return false;
  return true;
});

// ── 컬럼 인덱스 ──────────────────────────────────────────
const COL = {
  name:       HEADERS.indexOf('제품명'),
  atc:        HEADERS.indexOf('ATC'),
  seller:     HEADERS.indexOf('판매사'),
  maker:      HEADERS.indexOf('제조원'),
  price:      HEADERS.indexOf('약가'),
  type:       HEADERS.indexOf('국내/외자'),
  ingredient: HEADERS.indexOf('성분'),
  rxType:     HEADERS.indexOf('일반/전문'),
  code:       HEADERS.indexOf('약품코드'),
  dose:       HEADERS.indexOf('용량'),
  unit:       HEADERS.indexOf('단위'),
};

// 2025년 총합 컬럼 위치 (처방조제액 / 처방조제량 각각 1개씩)
var totalIdx1 = -1, totalIdx2 = -1;
HEADERS.forEach(function(h, i) {
  if (h === '2025년 총합') {
    if (totalIdx1 < 0) totalIdx1 = i;
    else               totalIdx2 = i;
  }
});
if (totalIdx1 < 0) totalIdx1 = 70;
if (totalIdx2 < 0) totalIdx2 = 132;

// 처방조제액 연도별 컬럼
const AMOUNT_START = 10;
const AMOUNT_TOTAL = totalIdx1;  // 처방조제액 2025년 총합
const DISP_TOTAL   = totalIdx2;  // 처방조제량 2025년 총합

const YEARS = ['2021', '2022', '2023', '2024', '2025'];

function getYearAmountCols(y) {
  if (y === '2025') return [AMOUNT_TOTAL];
  var offset = (parseInt(y) - 2021) * 12;
  var cols = [];
  for (var m = 0; m < 12; m++) cols.push(AMOUNT_START + offset + m);
  return cols;
}

// ── 원료별 인덱스 구축 ───────────────────────────────────
console.log('🔑 인덱스 구축 중...');
const INGREDIENT_MAP = {};   // key: 성분명 소문자

DATA.forEach(function(row) {
  var ing = String(row[COL.ingredient] || '').trim();
  if (!ing) return;
  var key = ing.toLowerCase();
  if (!INGREDIENT_MAP[key]) {
    INGREDIENT_MAP[key] = { rawName: ing, products: [] };
  }
  INGREDIENT_MAP[key].products.push(row);
});

console.log('✅ 로드 완료! 총', DATA.length.toLocaleString(), '개 제품 /',
            Object.keys(INGREDIENT_MAP).length.toLocaleString(), '개 성분');

// ── 헬퍼 ─────────────────────────────────────────────────
// 제품 목록 → 제조원별로 그룹핑
function groupByMaker(products) {
  var makerMap = {};

  products.forEach(function(row) {
    var maker = String(row[COL.maker] || '').trim() || '(제조원 불명)';
    if (!makerMap[maker]) {
      makerMap[maker] = { maker: maker, products: [] };
    }
    makerMap[maker].products.push(row);
  });

  // 제조원별 집계
  var groups = Object.values(makerMap).map(function(g) {
    var yearly = {};
    YEARS.forEach(function(y) { yearly[y] = 0; });
    var rawMaterial2025 = 0;

    g.products.forEach(function(row) {
      // 연도별 처방조제액 합산
      YEARS.forEach(function(y) {
        getYearAmountCols(y).forEach(function(ci) {
          var v = Number(row[ci]);
          if (!isNaN(v)) yearly[y] += v;
        });
      });

      // 원료량: 처방조제량(2025총합) × 용량(mg) ÷ 1,000,000
      var disp = Number(row[DISP_TOTAL]);
      var dose = Number(row[COL.dose]);
      if (!isNaN(disp) && !isNaN(dose) && dose > 0) {
        rawMaterial2025 += disp * dose / 1000000;
      }
    });

    // 제품 상세 목록
    var productList = g.products.map(function(row) {
      var disp = Number(row[DISP_TOTAL]) || 0;
      var dose = Number(row[COL.dose]);
      var rawMaterial = (!isNaN(dose) && dose > 0) ? disp * dose / 1000000 : 0;
      return {
        name:        row[COL.name],
        seller:      row[COL.seller],
        type:        row[COL.type],
        rxType:      row[COL.rxType],
        price:       row[COL.price],
        dose:        row[COL.dose],
        unit:        row[COL.unit],
        disp2025:    disp,
        rawMaterial: rawMaterial,
        amount2025: (function() {
          var v = 0;
          getYearAmountCols('2025').forEach(function(ci) {
            var n = Number(row[ci]); if (!isNaN(n)) v += n;
          });
          return v;
        })(),
      };
    });

    // 제품을 25년 원료사용량 기준 내림차순 정렬
    productList.sort(function(a, b) { return b.rawMaterial - a.rawMaterial; });

    return {
      maker:           g.maker,
      productCount:    g.products.length,
      yearly:          yearly,
      rawMaterial2025: rawMaterial2025,
      products:        productList,
    };
  });

  // 제조원을 25년 원료사용량 기준 내림차순 정렬
  groups.sort(function(a, b) { return (b.rawMaterial2025 || 0) - (a.rawMaterial2025 || 0); });
  return groups;
}

function getLocalIP() {
  var ifaces = os.networkInterfaces();
  for (var name of Object.keys(ifaces)) {
    for (var iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

// ── Express ───────────────────────────────────────────────
const app = express();

app.get('/search', function(req, res) {
  var q = (req.query.q || '').toLowerCase().trim();
  if (!q) return res.json({ ingredient: '', makerGroups: [], years: YEARS });

  // 성분명에 검색어가 포함된 모든 제품 수집
  var allProducts = [];
  Object.keys(INGREDIENT_MAP).forEach(function(k) {
    if (k.includes(q)) {
      allProducts = allProducts.concat(INGREDIENT_MAP[k].products);
    }
  });

  if (!allProducts.length) {
    return res.json({ ingredient: q, makerGroups: [], years: YEARS });
  }

  var makerGroups = groupByMaker(allProducts);

  res.json({
    ingredient:  q,
    totalProducts: allProducts.length,
    makerGroups: makerGroups,
    years:       YEARS,
  });
});

app.get('/', function(req, res) { res.sendFile(HTML_PATH); });

app.listen(PORT, '0.0.0.0', async function() {
  var ip  = getLocalIP();
  var url = 'http://' + ip + ':' + PORT;
  console.log('\n🖥️  PC:     http://localhost:' + PORT);
  console.log('📱 모바일: ' + url + '\n');
  try {
    var qr = await QRCode.toString(url, { type: 'terminal', small: true });
    console.log('── 모바일 QR ──────────────────');
    console.log(qr);
    console.log('───────────────────────────────');
    console.log('같은 WiFi 스마트폰으로 QR 스캔\n');
  } catch(e) {}
});
