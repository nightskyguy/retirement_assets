// hysa_data.js — shared dataset for HYSA_Real_Growth.html and HYSA_v_Inflation.html
// HYSA rates: top competitive rates estimated from FRED, FDIC, and Fed funds history.
// CPI: BLS CPI-U annual averages. 2025 finalized (Dec YoY). 2026 is a partial-year estimate.
const RAW_VINTAGE = 'May 2026'; // most recent month with confirmed CPI and HYSA data
const RAW = [
  { yr: 2000, rate: 0.060, cpi: 0.034 },
  { yr: 2001, rate: 0.042, cpi: 0.028 },
  { yr: 2002, rate: 0.018, cpi: 0.016 },
  { yr: 2003, rate: 0.010, cpi: 0.023 },
  { yr: 2004, rate: 0.015, cpi: 0.027 },
  { yr: 2005, rate: 0.033, cpi: 0.034 },
  { yr: 2006, rate: 0.052, cpi: 0.032 },
  { yr: 2007, rate: 0.049, cpi: 0.028 },
  { yr: 2008, rate: 0.030, cpi: 0.038 },
  { yr: 2009, rate: 0.013, cpi: -0.004 },
  { yr: 2010, rate: 0.012, cpi: 0.016 },
  { yr: 2011, rate: 0.011, cpi: 0.032 },
  { yr: 2012, rate: 0.010, cpi: 0.021 },
  { yr: 2013, rate: 0.010, cpi: 0.015 },
  { yr: 2014, rate: 0.010, cpi: 0.016 },
  { yr: 2015, rate: 0.011, cpi: 0.001 },
  { yr: 2016, rate: 0.011, cpi: 0.021 },
  { yr: 2017, rate: 0.013, cpi: 0.021 },
  { yr: 2018, rate: 0.022, cpi: 0.024 },
  { yr: 2019, rate: 0.024, cpi: 0.023 },
  { yr: 2020, rate: 0.009, cpi: 0.012 },
  { yr: 2021, rate: 0.005, cpi: 0.070 },
  { yr: 2022, rate: 0.030, cpi: 0.080 },
  { yr: 2023, rate: 0.051, cpi: 0.041 },
  { yr: 2024, rate: 0.050, cpi: 0.029 },
  { yr: 2025, rate: 0.043, cpi: 0.027 },
  { yr: 2026, rate: 0.040, cpi: 0.032 }, // partial-year estimate: Fed funds 3.50–3.75%, CPI thru May
];
