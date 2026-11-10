/* ============================================================
   NEXUS VAULT — Bulletproof application logic
   No blocking CDNs · No document.write · All elements defensively accessed
   ============================================================ */

(function () {
  'use strict';

  // Global error logger — never lets one error kill the page silently
  window.addEventListener('error', (e) => {
    console.error('[NEXUS] Error:', e.error || e.message);
  });

  const $ = (id) => document.getElementById(id);

  // ============================================================
  // TOASTS (defined early so error handlers can use it)
  // ============================================================
  function showToast(message, type, duration) {
    type = type || 'info';
    duration = duration || 4500;
    const container = $('toastContainer');
    if (!container) { console.log('[Toast ' + type + ']', message); return; }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ============================================================
  // LAZY SCRIPT LOADER (with timeout + fallbacks)
  // ============================================================
  function loadScript(url, timeoutMs) {
    timeoutMs = timeoutMs || 8000;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      let done = false;
      const timer = setTimeout(() => {
        if (!done) { done = true; script.remove(); reject(new Error('Timeout: ' + url)); }
      }, timeoutMs);
      script.onload = () => {
        if (done) return;
        done = true; clearTimeout(timer); resolve();
      };
      script.onerror = () => {
        if (done) return;
        done = true; clearTimeout(timer); script.remove(); reject(new Error('Failed: ' + url));
      };
      document.head.appendChild(script);
    });
  }

  async function ensureEthers() {
    if (window.ethers) return true;
    const urls = [
      'https://cdn.jsdelivr.net/npm/ethers@6.13.4/dist/ethers.umd.min.js',
      'https://unpkg.com/ethers@6.13.4/dist/ethers.umd.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.4/ethers.umd.min.js'
    ];
    for (const url of urls) {
      try {
        await loadScript(url, 8000);
        if (window.ethers) return true;
      } catch (e) { /* try next */ }
    }
    return false;
  }

  async function ensureQRCode() {
    if (typeof window.QRCode !== 'undefined') return true;
    const urls = [
      'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
      'https://unpkg.com/qrcodejs@1.0.0/qrcode.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
    ];
    for (const url of urls) {
      try {
        await loadScript(url, 8000);
        if (typeof window.QRCode !== 'undefined') return true;
      } catch (e) { /* try next */ }
    }
    return false;
  }

  async function ensureWalletConnect() {
    if (window.EthereumProvider) return window.EthereumProvider;
    const urls = [
      'https://cdn.jsdelivr.net/npm/@walletconnect/ethereum-provider@2.17.2/dist/index.umd.js',
      'https://unpkg.com/@walletconnect/ethereum-provider@2.17.2/dist/index.umd.js'
    ];
    for (const url of urls) {
      try {
        await loadScript(url, 12000);
        if (window.EthereumProvider) return window.EthereumProvider;
        if (window.WalletConnectEthereumProvider) return window.WalletConnectEthereumProvider;
      } catch (e) { /* try next */ }
    }
    return null;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  const drawer = $('drawer');
  const overlay = $('overlay');

  function openDrawer() {
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
  }
  function closeDrawer() {
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
  }

  $('brandMenu') && ($('brandMenu').onclick = openDrawer);
  $('closeDrawer') && ($('closeDrawer').onclick = closeDrawer);
  overlay && (overlay.onclick = closeDrawer);

  function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(page);
    if (target) target.classList.add('active');
    document.querySelectorAll('.drawer-link').forEach(b => {
      b.classList.toggle('active', b.dataset.page === page);
    });
    closeDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Delegated — works for every [data-page] including future ones
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn) return;
    e.preventDefault();
    showPage(btn.dataset.page);
  });

  $('settingsShortcut') && ($('settingsShortcut').onclick = () => showPage('settings'));

  // ============================================================
  // THEME
  // ============================================================
  const themeSetting = $('themeSetting');
  function applyTheme(theme) {
    document.body.classList.toggle('light', theme === 'light');
    if (themeSetting) themeSetting.value = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f6fb' : '#090b14');
    try { localStorage.setItem('nexus-theme', theme); } catch (e) {}
  }
  try {
    applyTheme(localStorage.getItem('nexus-theme') || 'dark');
  } catch (e) { applyTheme('dark'); }
  themeSetting && themeSetting.addEventListener('change', e => applyTheme(e.target.value));

  // ============================================================
  // CURRENCY
  // ============================================================
  const regionCurrencies = {
    KE:'KES',UG:'UGX',TZ:'TZS',NG:'NGN',GH:'GHS',ZA:'ZAR',
    US:'USD',GB:'GBP',IE:'EUR',FR:'EUR',DE:'EUR',IT:'EUR',
    ES:'EUR',PT:'EUR',NL:'EUR',BE:'EUR',AT:'EUR',FI:'EUR',
    GR:'EUR',CY:'EUR',EE:'EUR',LV:'EUR',LT:'EUR',LU:'EUR',
    JP:'JPY',CN:'CNY',IN:'INR',PK:'PKR',BD:'BDT',
    CA:'CAD',AU:'AUD',NZ:'NZD',CH:'CHF',SG:'SGD',
    AE:'AED',SA:'SAR',BR:'BRL',MX:'MXN',PH:'PHP',
    KR:'KRW',TR:'TRY',EG:'EGP',MA:'MAD',RW:'RWF',
    ZM:'ZMW',MW:'MWK',ET:'ETB',ID:'IDR',MY:'MYR',
    TH:'THB',VN:'VND',HK:'HKD',NO:'NOK',SE:'SEK',
    DK:'DKK',PL:'PLN',CZ:'CZK',HU:'HUF',RO:'RON',
    UA:'UAH',IL:'ILS',QA:'QAR',KW:'KWD',BH:'BHD'
  };

  let detectedCurrency = 'USD';
  try {
    const locale = new Intl.Locale(navigator.language);
    detectedCurrency = regionCurrencies[locale.region] || 'USD';
  } catch (e) {}

  const currencySetting = $('currencySetting');
  let localCurrency = 'USD';
  try {
    localCurrency = localStorage.getItem('nexus-currency') || detectedCurrency;
  } catch (e) { localCurrency = detectedCurrency; }

  if (currencySetting) {
    if (![...currencySetting.options].some(o => o.value === localCurrency)) {
      const opt = document.createElement('option');
      opt.value = localCurrency;
      opt.textContent = localCurrency;
      currencySetting.appendChild(opt);
    }
    currencySetting.value = localCurrency;

    const descEl = $('currencyDescription');
    if (descEl) {
      descEl.textContent =
        'Detected from browser region: ' + detectedCurrency +
        '. Current display currency: ' + localCurrency + '.';
    }

    currencySetting.addEventListener('change', () => {
      localCurrency = currencySetting.value;
      try { localStorage.setItem('nexus-currency', localCurrency); } catch (e) {}
      const lbl = $('currencyLabel');
      if (lbl) lbl.textContent = localCurrency + ' · LOCAL DISPLAY';
      const desc = $('currencyDescription');
      if (desc) desc.textContent = 'Your display currency is ' + localCurrency + '. USD remains the base currency.';
      updatePortfolioDisplay();
    });
  }

  const currencyLabelEl = $('currencyLabel');
  if (currencyLabelEl) currencyLabelEl.textContent = localCurrency + ' · LOCAL DISPLAY';

  // ============================================================
  // EXCHANGE RATES
  // ============================================================
  let exchangeRates = { USD: 1 };
  async function loadExchangeRates() {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!res.ok) throw new Error('Rate fetch failed');
      const data = await res.json();
      if (data.result === 'success') {
        exchangeRates = data.rates;
        updatePortfolioDisplay();
      }
    } catch (e) { console.warn('Exchange rates unavailable'); }
  }

  // ============================================================
  // WALLET STATE
  // ============================================================
  let connectedWallets = [];
  let prices = { ETH: 0, SOL: 0, BTC: 0 };
  let pricesLastUpdated = 0;

  function loadConnected() {
    try {
      const raw = localStorage.getItem('nexus-connected-wallets');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) connectedWallets = parsed;
      }
    } catch (e) { connectedWallets = []; }
  }
  function saveConnected() {
    try { localStorage.setItem('nexus-connected-wallets', JSON.stringify(connectedWallets)); } catch (e) {}
  }

  // ============================================================
  // WALLETCONNECT PROJECT ID
  // ============================================================
  let wcProjectId = '';
  try { wcProjectId = localStorage.getItem('nexus-wc-project-id') || ''; } catch (e) {}

  const wcPidInput = $('wcProjectIdInput');
  if (wcPidInput && wcProjectId) wcPidInput.value = wcProjectId;

  const wcPidSave = $('wcProjectIdSave');
  if (wcPidSave) {
    wcPidSave.addEventListener('click', () => {
      const val = (wcPidInput && wcPidInput.value.trim()) || '';
      if (!val) { showToast('Enter a project ID first.', 'error'); return; }
      wcProjectId = val;
      try { localStorage.setItem('nexus-wc-project-id', val); } catch (e) {}
      showToast('✓ WalletConnect Project ID saved.', 'success', 3000);
    });
  }

  // ============================================================
  // PROVIDERS (browser extensions)
  // ============================================================
  const providers = {
    'MetaMask': {
      chain: 'ethereum',
      detect: () => typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask,
      connect: async () => (await window.ethereum.request({ method: 'eth_requestAccounts' }))[0]
    },
    'Coinbase Wallet': {
      chain: 'ethereum',
      detect: () => typeof window.coinbaseWalletExtension !== 'undefined',
      connect: async () => (await window.coinbaseWalletExtension.request({ method: 'eth_requestAccounts' }))[0]
    },
    'Brave Wallet': {
      chain: 'ethereum',
      detect: () => typeof window.ethereum !== 'undefined' && window.ethereum.isBraveWallet,
      connect: async () => (await window.ethereum.request({ method: 'eth_requestAccounts' }))[0]
    },
    'Rabby Wallet': {
      chain: 'ethereum',
      detect: () => typeof window.ethereum !== 'undefined' && window.ethereum.isRabby,
      connect: async () => (await window.ethereum.request({ method: 'eth_requestAccounts' }))[0]
    },
    'Phantom': {
      chain: 'solana',
      detect: () => typeof window.solana !== 'undefined' && window.solana.isPhantom,
      connect: async () => (await window.solana.connect()).publicKey.toString()
    },
    'Solflare': {
      chain: 'solana',
      detect: () => typeof window.solflare !== 'undefined',
      connect: async () => (await window.solflare.connect()).publicKey.toString()
    },
    'Backpack': {
      chain: 'solana',
      detect: () => typeof window.backpack !== 'undefined',
      connect: async () => (await window.backpack.connect()).publicKey.toString()
    },
    'Unisat': {
      chain: 'bitcoin',
      detect: () => typeof window.unisat !== 'undefined',
      connect: async () => (await window.unisat.requestAccounts())[0]
    }
  };

  // ============================================================
  // BALANCE FETCHING
  // ============================================================
  const CHAIN_SYMBOL = { ethereum: 'ETH', solana: 'SOL', bitcoin: 'BTC' };

  async function fetchEthBalance(address) {
    if (window.ethereum && window.ethereum.isMetaMask) {
      try {
        const hex = await window.ethereum.request({
          method: 'eth_getBalance', params: [address, 'latest']
        });
        return parseInt(hex, 16) / 1e18;
      } catch (_) {}
    }
    const res = await fetch('https://eth.llamarpc.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return parseInt(data.result, 16) / 1e18;
  }

  async function fetchSolBalance(address) {
    const res = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getBalance',
        params: [address]
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return (data.result?.value || 0) / 1e9;
  }

  async function fetchBtcBalance(address) {
    const res = await fetch('https://blockstream.info/api/address/' + encodeURIComponent(address));
    if (!res.ok) throw new Error('BTC balance failed');
    const data = await res.json();
    const stats = data.chain_stats || {};
    const sats = (stats.funded_txo_sum || 0) - (stats.spent_txo_sum || 0);
    return sats / 1e8;
  }

  async function fetchBalance(chain, address) {
    if (chain === 'ethereum') return fetchEthBalance(address);
    if (chain === 'solana')   return fetchSolBalance(address);
    if (chain === 'bitcoin')  return fetchBtcBalance(address);
    throw new Error('Unsupported chain: ' + chain);
  }

  // ============================================================
  // PRICES
  // ============================================================
  async function fetchPrices() {
    try {
      const res = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana,bitcoin&vs_currencies=usd'
      );
      if (!res.ok) throw new Error('Prices failed');
      const data = await res.json();
      prices.ETH = data.ethereum?.usd || 0;
      prices.SOL = data.solana?.usd || 0;
      prices.BTC = data.bitcoin?.usd || 0;
      pricesLastUpdated = Date.now();
      return true;
    } catch (e) {
      console.warn('Prices unavailable:', e);
      return false;
    }
  }

  // ============================================================
  // ADD WALLET (shared by all connection methods)
  // ============================================================
  async function addWalletToPortfolio(address, providerName, chain, opts) {
    opts = opts || {};
    const norm = (chain === 'ethereum') ? address.toLowerCase() : address;

    const exists = connectedWallets.some(w => {
      const wAddr = (w.chain === 'ethereum') ? w.address.toLowerCase() : w.address;
      return wAddr === norm && w.chain === chain;
    });
    if (exists) {
      showToast('This address is already connected.', 'info', 3500);
      return false;
    }

    if (!pricesLastUpdated || Date.now() - pricesLastUpdated > 60000) {
      await fetchPrices();
    }

    const wallet = {
      address,
      provider: providerName,
      chain,
      balance: 0,
      balanceUSD: 0,
      symbol: CHAIN_SYMBOL[chain] || '',
      connectedAt: Date.now(),
      imported: !!opts.imported,
      source: opts.source || 'extension'
    };

    // Add immediately so UI updates
    connectedWallets.push(wallet);
    saveConnected();
    renderConnectedWallets();
    renderDashboard();
    renderWalletDirectory();

    // Fetch balance in background
    try {
      const bal = await fetchBalance(chain, address);
      wallet.balance = bal;
      wallet.balanceUSD = bal * (prices[wallet.symbol] || 0);
      saveConnected();
      renderConnectedWallets();
      renderDashboard();
    } catch (e) {
      console.warn('Balance fetch failed:', providerName, e);
    }

    return true;
  }

  // ============================================================
  // WALLET ICONS
  // ============================================================
  const walletIconUrls = {
    'MetaMask': 'https://cdn.simpleicons.org/metamask',
    'Trust Wallet': 'https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/trust-wallet.svg',
    'Coinbase Wallet': 'https://cdn.simpleicons.org/coinbase',
    'Phantom': 'https://cdn.jsdelivr.net/npm/@thesvg/icons/icons/phantom.svg',
    'Binance Web3': 'https://cdn.simpleicons.org/binance',
    'OKX Wallet': 'https://cdn.simpleicons.org/okx',
    'Exodus': 'https://cdn.simpleicons.org/exodus',
    'Rabby Wallet': 'https://cdn.simpleicons.org/rabby',
    'Rainbow': 'https://cdn.simpleicons.org/rainbow',
    'Ledger': 'https://cdn.simpleicons.org/ledger',
    'Trezor': 'https://cdn.simpleicons.org/trezor',
    'Brave Wallet': 'https://cdn.simpleicons.org/brave',
    'Zerion': 'https://cdn.simpleicons.org/zerion',
    'Argent': 'https://cdn.simpleicons.org/argent',
    'Safe': 'https://cdn.simpleicons.org/safe',
    'Solflare': 'https://cdn.simpleicons.org/solflare',
    'Backpack': 'https://cdn.simpleicons.org/backpack',
    'Glow': 'https://cdn.simpleicons.org/glow',
    'Keplr': 'https://cdn.simpleicons.org/keplr',
    'Leap Wallet': 'https://cdn.simpleicons.org/leapwallet',
    'Leather': 'https://api.iconify.design/token:leather.svg',
    'Unisat': 'https://api.iconify.design/token:unisat.svg',
    'Xverse': 'https://api.iconify.design/token:xverse.svg',
    'Electrum': 'https://cdn.simpleicons.org/electrum',
    'imToken': 'https://api.iconify.design/token:imtoken.svg',
    'TokenPocket': 'https://cdn.simpleicons.org/tokenpocket',
    'Bitget Wallet': 'https://cdn.simpleicons.org/bitget',
    'Crypto.com Wallet': 'https://api.iconify.design/token:crypto-com.svg',
    'MathWallet': 'https://api.iconify.design/token:mathwallet.svg',
    'Coin98': 'https://cdn.simpleicons.org/coin98',
    'Talisman': 'https://api.iconify.design/token:talisman.svg',
    'Enkrypt': 'https://api.iconify.design/token:enkrypt.svg',
    'WalletConnect': 'https://cdn.simpleicons.org/walletconnect'
  };

  function walletIcon(providerName, chain, imported) {
    if (imported && chain === 'ethereum') return 'https://cdn.simpleicons.org/ethereum';
    return walletIconUrls[providerName] || null;
  }

  // ============================================================
  // FORMATTERS
  // ============================================================
  function formatMoney(value, currency) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency, maximumFractionDigits: 2
      }).format(value);
    } catch (e) { return currency + ' ' + value.toFixed(2); }
  }
  function shortenAddress(addr) {
    if (!addr) return '';
    if (addr.length <= 16) return addr;
    return addr.slice(0, 8) + '…' + addr.slice(-6);
  }
  function chainLabel(chain) {
    return ({ ethereum: 'ETH', solana: 'SOL', bitcoin: 'BTC', cosmos: 'ATOM' }[chain] || chain);
  }

  // ============================================================
  // PORTFOLIO DISPLAY
  // ============================================================
  function updatePortfolioDisplay() {
    const totalUSD = connectedWallets.reduce((s, w) => s + (w.balanceUSD || 0), 0);
    const rate = exchangeRates[localCurrency];

    const totalEl = $('totalUSD');
    if (totalEl) totalEl.textContent = formatMoney(totalUSD, 'USD');
    const localEl = $('totalLocal');
    if (localEl) {
      localEl.textContent = rate
        ? '≈ ' + formatMoney(totalUSD * rate, localCurrency)
        : 'Local exchange rate unavailable';
    }
    const wcEl = $('walletCount');
    if (wcEl) wcEl.textContent = connectedWallets.length;
    const acEl = $('assetCount');
    if (acEl) acEl.textContent = new Set(connectedWallets.map(w => w.chain)).size;

    const foot = $('portfolioFoot');
    if (foot) {
      if (connectedWallets.length === 0) {
        foot.textContent = 'Combined value of connected wallets · No wallets connected';
      } else if (pricesLastUpdated) {
        foot.textContent = 'Live · Prices updated ' + new Date(pricesLastUpdated).toLocaleTimeString();
      } else {
        foot.textContent = 'Combined value of connected wallets';
      }
    }
  }

  // ============================================================
  // RENDER: DASHBOARD
  // ============================================================
  function renderDashboard() {
    updatePortfolioDisplay();

    const emptyEl = $('walletEmpty');
    const summaryEl = $('walletSummary');

    if (connectedWallets.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (summaryEl) summaryEl.innerHTML = '';
    } else {
      if (emptyEl) emptyEl.classList.add('hidden');
      if (summaryEl) {
        summaryEl.innerHTML = connectedWallets.map(w => {
          const icon = walletIcon(w.provider, w.chain, w.imported);
          const fallback = w.symbol || '?';
          const logoInner = icon
            ? '<img src="' + icon + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + fallback + '\'))">'
            : fallback;
          return `
            <div class="summary-row">
              <div class="wallet-logo">${logoInner}</div>
              <div class="summary-row-info">
                <div class="summary-row-name">${w.provider}</div>
                <div class="summary-row-addr">${shortenAddress(w.address)}</div>
              </div>
              <div class="summary-row-values">
                <div class="summary-row-bal">${w.balance.toFixed(4)} ${w.symbol}</div>
                <div class="summary-row-usd">${formatMoney(w.balanceUSD, 'USD')}</div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    const assetEmpty = $('assetEmpty');
    const assetList = $('assetList');

    if (connectedWallets.length === 0) {
      if (assetEmpty) assetEmpty.classList.remove('hidden');
      if (assetList) assetList.innerHTML = '';
    } else {
      if (assetEmpty) assetEmpty.classList.add('hidden');
      const byChain = {};
      connectedWallets.forEach(w => {
        byChain[w.chain] = (byChain[w.chain] || 0) + (w.balanceUSD || 0);
      });
      const total = Object.values(byChain).reduce((a, b) => a + b, 0) || 1;
      if (assetList) {
        assetList.innerHTML = Object.entries(byChain)
          .sort((a, b) => b[1] - a[1])
          .map(([chain, val]) => {
            const pct = ((val / total) * 100).toFixed(1);
            return `
              <div style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
                  <div style="display:flex;align-items:center;gap:10px">
                    <span class="chain-badge ${chain}">${chainLabel(chain)}</span>
                    <span style="font-size:10px;color:var(--muted)">${pct}%</span>
                  </div>
                  <span style="font-size:11px;font-weight:700">${formatMoney(val, 'USD')}</span>
                </div>
                <div style="width:100%;height:4px;border-radius:2px;background:var(--surface3);overflow:hidden;margin-top:6px">
                  <div style="height:100%;width:${pct}%;background:var(--purple);border-radius:2px"></div>
                </div>
              </div>
            `;
          }).join('');
      }
    }
  }

  // ============================================================
  // RENDER: MY WALLETS
  // ============================================================
  function renderConnectedWallets() {
    const emptyEl = $('connectedEmpty');
    const listEl = $('connectedList');
    if (!emptyEl || !listEl) return;

    if (connectedWallets.length === 0) {
      emptyEl.classList.remove('hidden');
      listEl.innerHTML = '';
      return;
    }

    emptyEl.classList.add('hidden');
    listEl.innerHTML = connectedWallets.map(w => {
      const icon = walletIcon(w.provider, w.chain, w.imported);
      const fallback = w.symbol || '?';
      const logoInner = icon
        ? '<img src="' + icon + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' + fallback + '\'))">'
        : fallback;

      const importTag = w.imported
        ? '<span style="font-size:8px;font-weight:800;color:var(--purple);letter-spacing:.5px;background:rgba(146,117,255,.15);padding:2px 6px;border-radius:4px">IMPORTED</span>'
        : '';

      return `
        <div class="connected-wallet-card">
          <div class="connected-wallet-head">
            <div class="wallet-logo">${logoInner}</div>
            <div class="connected-wallet-info">
              <div class="connected-wallet-title">
                <strong>${w.provider}</strong>${importTag}
                <span class="chain-badge ${w.chain}">${chainLabel(w.chain)}</span>
              </div>
              <div class="connected-wallet-address">${shortenAddress(w.address)}</div>
            </div>
          </div>
          <div>
            <div class="connected-wallet-balance">${w.balance.toFixed(4)} ${w.symbol}</div>
            <div class="connected-wallet-usd">≈ ${formatMoney(w.balanceUSD, 'USD')}</div>
          </div>
          <div class="connected-wallet-actions">
            <span style="font-size:9px;color:var(--muted)">
              ${new Date(w.connectedAt).toLocaleDateString()}
            </span>
            <button class="disconnect-btn"
              data-disconnect-address="${w.address}"
              data-disconnect-chain="${w.chain}">
              Disconnect
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Delegated disconnect
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-disconnect-address]');
    if (!btn) return;
    disconnectWallet(btn.dataset.disconnectAddress, btn.dataset.disconnectChain);
  });

  async function disconnectWallet(address, chain) {
    const idx = connectedWallets.findIndex(w => {
      const wAddr = (w.chain === 'ethereum') ? w.address.toLowerCase() : w.address;
      const bAddr = (chain === 'ethereum') ? address.toLowerCase() : address;
      return wAddr === bAddr && w.chain === chain;
    });
    if (idx === -1) return;
    const removed = connectedWallets.splice(idx, 1)[0];
    saveConnected();
    renderConnectedWallets();
    renderDashboard();
    renderWalletDirectory();
    showToast(removed.provider + ' disconnected.', 'success', 3000);
  }

  // ============================================================
  // REFRESH
  // ============================================================
  async function refreshAllBalances() {
    if (connectedWallets.length === 0) {
      showToast('No wallets to refresh.', 'info', 3500);
      return;
    }
    const buttons = [$('refreshDashboard'), $('refreshWallets')].filter(Boolean);
    buttons.forEach(b => b.classList.add('loading'));
    try {
      await fetchPrices();
      await Promise.allSettled(connectedWallets.map(async w => {
        try {
          const bal = await fetchBalance(w.chain, w.address);
          w.balance = bal;
          w.balanceUSD = bal * (prices[w.symbol] || 0);
        } catch (e) { console.warn('Refresh failed:', w.provider, e); }
      }));
      saveConnected();
      renderConnectedWallets();
      renderDashboard();
      showToast('✓ Balances refreshed.', 'success', 3000);
    } finally {
      buttons.forEach(b => b.classList.remove('loading'));
    }
  }
  $('refreshDashboard') && $('refreshDashboard').addEventListener('click', refreshAllBalances);
  $('refreshWallets') && $('refreshWallets').addEventListener('click', refreshAllBalances);

  // ============================================================
  // MODAL HELPERS
  // ============================================================
  function openModal(id) {
    const el = $(id);
    if (el) el.classList.add('active');
  }
  function closeModal(id) {
    const el = $(id);
    if (el) el.classList.remove('active');
    if (id === 'walletConnectModal') {
      cleanupWalletConnect();
      const pi = $('wcPhraseInput'); if (pi) pi.value = '';
      const u = $('wcUnderstand'); if (u) u.checked = false;
      const ps = $('wcPhraseStatus'); if (ps) ps.innerHTML = '';
      const es = $('wcExtStatus'); if (es) es.innerHTML = '';
    }
  }

  // Delegated close buttons
  document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) { closeModal(closeBtn.dataset.closeModal); return; }
    if (e.target.classList.contains('modal-overlay')) closeModal(e.target.id);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => closeModal(m.id));
    }
  });

  // ============================================================
  // WALLET CONNECT MODAL
  // ============================================================
  let currentWallet = { name: '', chain: '' };
  let wcEthereumProvider = null;

  function cleanupWalletConnect() {
    if (wcEthereumProvider) {
      try { wcEthereumProvider.disconnect(); } catch (_) {}
      wcEthereumProvider = null;
    }
  }

  function openWalletConnectModal(name, chain) {
    currentWallet = { name, chain };

    const titleEl = $('wcTitle');
    if (titleEl) titleEl.textContent = 'Connect ' + name;
    const subtitleEl = $('wcSubtitle');
    if (subtitleEl) subtitleEl.textContent = 'Choose a connection method';

    const logoEl = $('wcLogo');
    if (logoEl) {
      logoEl.innerHTML = '';
      const iconUrl = walletIconUrls[name];
      if (iconUrl) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.alt = name;
        img.style.width = '22px';
        img.style.height = '22px';
        img.style.objectFit = 'contain';
        img.onerror = () => { logoEl.textContent = name.slice(0, 2).toUpperCase(); };
        logoEl.appendChild(img);
      } else {
        logoEl.textContent = name.slice(0, 2).toUpperCase();
      }
    }

    const extBtn = $('wcBtnExtension');
    const isDetected = !!(providers[name] && providers[name].detect());
    if (extBtn) {
      if (isDetected) {
        extBtn.classList.remove('disabled');
        const d = $('wcExtDesc');
        if (d) d.textContent = 'Detected — click to connect via ' + name;
      } else {
        extBtn.classList.add('disabled');
        const d = $('wcExtDesc');
        if (d) d.textContent = name + ' not detected in this browser';
      }
    }

    // Show phrase import only for EVM
    const phraseBtn = $('wcBtnPhrase');
    if (phraseBtn) {
      if (chain === 'ethereum') {
        phraseBtn.classList.remove('disabled');
      } else {
        phraseBtn.classList.add('disabled');
      }
    }

    // Show QR only for EVM
    const qrBtn = $('wcBtnQr');
    if (qrBtn) {
      if (chain === 'ethereum') {
        qrBtn.classList.remove('disabled');
      } else {
        qrBtn.classList.add('disabled');
      }
    }

    // Reset panels
    const methods = $('wcMethods'); if (methods) methods.classList.remove('hidden');
    const pe = $('wcPanelExtension'); if (pe) pe.classList.add('hidden');
    const pp = $('wcPanelPhrase'); if (pp) pp.classList.add('hidden');
    const pq = $('wcPanelQr'); if (pq) pq.classList.add('hidden');

    const pi = $('wcPhraseInput'); if (pi) pi.value = '';
    const u = $('wcUnderstand'); if (u) u.checked = false;
    const ps = $('wcPhraseStatus'); if (ps) ps.innerHTML = '';
    const es = $('wcExtStatus'); if (es) es.innerHTML = '';

    openModal('walletConnectModal');
  }

  // Method selection
  document.querySelectorAll('.method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('disabled')) return;
      const method = btn.dataset.method;
      const methods = $('wcMethods'); if (methods) methods.classList.add('hidden');

      if (method === 'extension') {
        const p = $('wcPanelExtension'); if (p) p.classList.remove('hidden');
        runExtensionConnect();
      } else if (method === 'phrase') {
        const p = $('wcPanelPhrase'); if (p) p.classList.remove('hidden');
        setTimeout(() => { const i = $('wcPhraseInput'); if (i) i.focus(); }, 100);
      } else if (method === 'qr') {
        const p = $('wcPanelQr'); if (p) p.classList.remove('hidden');
        runQrConnect();
      }
    });
  });

  // Back — DELEGATED so it works on dynamically-created buttons
  document.addEventListener('click', (e) => {
    const backBtn = e.target.closest('[data-back-methods]');
    if (!backBtn) return;
    cleanupWalletConnect();
    const methods = $('wcMethods'); if (methods) methods.classList.remove('hidden');
    const pe = $('wcPanelExtension'); if (pe) pe.classList.add('hidden');
    const pp = $('wcPanelPhrase'); if (pp) pp.classList.add('hidden');
    const pq = $('wcPanelQr'); if (pq) pq.classList.add('hidden');
  });

  // ============================================================
  // EXTENSION CONNECT
  // ============================================================
  async function runExtensionConnect() {
    const name = currentWallet.name;
    const chain = currentWallet.chain;
    const statusEl = $('wcExtStatus');
    if (!statusEl) return;

    const provider = providers[name];
    if (!provider || !provider.detect()) {
      statusEl.innerHTML = `
        <div class="modal-warning" style="margin:0">
          <strong>${name} not detected.</strong><br>
          Install the official ${name} browser extension or app, unlock it, then refresh this page.
          <br><br>
          Alternatively, use <strong>Import Phrase</strong> or <strong>Scan QR</strong> above.
        </div>
        <div class="modal-actions" style="margin-top:14px">
          <button class="secondary-btn" data-back-methods>← Back</button>
        </div>
      `;
      return;
    }

    statusEl.innerHTML = `<p style="text-align:center;font-size:11px;color:var(--muted);padding:20px 0"><span class="spinner-inline"></span>Waiting for ${name} to approve…</p>`;

    try {
      const address = await provider.connect();
      if (!address) throw new Error('No address returned.');
      showToast('Connected. Fetching balance…', 'info', 2500);
      const added = await addWalletToPortfolio(address, name, chain, { source: 'extension' });
      if (added) {
        closeModal('walletConnectModal');
        showToast('✓ ' + name + ' connected!', 'success', 4000);
      }
    } catch (err) {
      console.warn('Extension connect error:', err);
      const isReject = err?.code === 4001 || err?.code === 'ACTION_REJECTED';
      statusEl.innerHTML = `
        <div class="modal-warning" style="margin:0">
          <strong>${isReject ? 'Rejected in wallet' : 'Connection failed'}:</strong>
          ${isReject ? 'You cancelled the request.' : (err?.message || 'Unknown error')}
        </div>
        <div class="modal-actions" style="margin-top:14px">
          <button class="secondary-btn" data-back-methods>← Try another method</button>
        </div>
      `;
    }
  }

  // ============================================================
  // PHRASE IMPORT
  // ============================================================
  const importBtn = $('wcImportConfirm');
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      const raw = ($('wcPhraseInput') && $('wcPhraseInput').value.trim()) || '';
      const understood = $('wcUnderstand');
      const statusEl = $('wcPhraseStatus');
      const setError = (msg) => { if (statusEl) statusEl.innerHTML = `<div class="modal-warning" style="margin:0 0 10px;font-size:11px">${msg}</div>`; };
      const setInfo = (msg) => { if (statusEl) statusEl.innerHTML = `<p style="font-size:11px;color:var(--muted);margin-bottom:10px"><span class="spinner-inline"></span>${msg}</p>`; };

      if (!understood || !understood.checked) { setError('Please confirm you understand the warning first.'); return; }
      if (!raw) { setError('Enter a recovery phrase or private key.'); return; }

      setInfo('Loading crypto library…');
      const hasEthers = await ensureEthers();
      if (!hasEthers) {
        setError('⚠️ Could not load ethers.js from any CDN. Check your internet connection and try again.');
        return;
      }

      try {
        let address;

        if (/^0x[0-9a-fA-F]{64}$/.test(raw)) {
          try {
            const w = new window.ethers.Wallet(raw);
            address = w.address;
          } catch (e) {
            setError('Invalid private key: ' + e.message);
            return;
          }
        } else {
          const normalized = raw.toLowerCase().trim().replace(/\s+/g, ' ');
          const wordCount = normalized.split(' ').length;
          if (![12, 15, 18, 21, 24].includes(wordCount)) {
            setError(`Phrase contains ${wordCount} words. It must contain 12, 15, 18, 21, or 24.`);
            return;
          }
          setInfo('Validating phrase…');
          try {
            const w = window.ethers.Wallet.fromPhrase(normalized);
            address = w.address;
          } catch (e) {
            setError('Invalid phrase: ' + (e.message || 'check spelling.'));
            return;
          }
        }

        if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
          setError('Could not derive a valid Ethereum address.');
          return;
        }

        if ($('wcPhraseInput')) $('wcPhraseInput').value = '';
        if ($('wcUnderstand')) $('wcUnderstand').checked = false;

        setInfo('Address: ' + address.slice(0, 10) + '… — fetching balance…');

        const added = await addWalletToPortfolio(address, currentWallet.name, 'ethereum', {
          imported: true, source: 'imported'
        });

        if (added) {
          closeModal('walletConnectModal');
          showToast('✓ Imported: ' + address.slice(0, 6) + '…' + address.slice(-4), 'success', 5000);
        }
      } catch (err) {
        console.error('Import error:', err);
        if ($('wcPhraseInput')) $('wcPhraseInput').value = '';
        setError('Import failed: ' + (err?.message || 'Unknown error'));
      }
    });
  }

  // ============================================================
  // QR CONNECT (real WalletConnect)
  // ============================================================
  async function runQrConnect() {
    const contentEl = $('wcQrContent');
    if (!contentEl) return;

    if (!wcProjectId) {
      contentEl.innerHTML = `
        <div class="qr-setup">
          <h4>📌 WalletConnect Project ID required</h4>
          <p>
            WalletConnect's QR connection needs a free project ID.
            Get yours at <a href="https://cloud.walletconnect.com" target="_blank" rel="noopener">cloud.walletconnect.com</a>
            — sign up, create a project, copy the ID. Takes about 1 minute.
          </p>
          <input type="text" id="qrPidInput" placeholder="Paste your WalletConnect Project ID" autocomplete="off" spellcheck="false">
          <div class="row">
            <button class="secondary-btn" data-back-methods style="flex:1">← Back</button>
            <button class="primary-btn" id="qrPidSave" style="flex:1">Save & Generate QR</button>
          </div>
        </div>
      `;

      setTimeout(() => {
        const input = $('qrPidInput');
        if (input) input.focus();
        const saveBtn = $('qrPidSave');
        if (saveBtn) {
          saveBtn.addEventListener('click', () => {
            const val = input.value.trim();
            if (!val) { showToast('Enter a project ID.', 'error'); return; }
            wcProjectId = val;
            try { localStorage.setItem('nexus-wc-project-id', val); } catch (e) {}
            if ($('wcProjectIdInput')) $('wcProjectIdInput').value = val;
            showToast('✓ Project ID saved. Generating QR…', 'success', 2500);
            runQrConnect();
          });
        }
      }, 50);
      return;
    }

    contentEl.innerHTML = `<p style="text-align:center;font-size:11px;color:var(--muted);padding:20px 0"><span class="spinner-inline"></span>Loading WalletConnect…</p>`;

    try {
      const [EthereumProvider, hasQR] = await Promise.all([
        ensureWalletConnect(),
        ensureQRCode()
      ]);

      if (!EthereumProvider || !EthereumProvider.init) {
        throw new Error('Could not load WalletConnect library from any CDN. Check your internet connection.');
      }
      if (!hasQR) {
        throw new Error('Could not load QR code library. Check your internet connection.');
      }

      const provider = await EthereumProvider.init({
        projectId: wcProjectId,
        chains: [1],
        optionalChains: [1, 137, 56, 42161, 10, 8453],
        showQrModal: false,
        metadata: {
          name: 'NEXUS VAULT',
          description: 'Your crypto. One unified view.',
          url: window.location.href.split('?')[0].split('#')[0],
          icons: []
        }
      });

      wcEthereumProvider = provider;

      const { uri, approval } = await provider.connect();

      contentEl.innerHTML = `
        <div class="qr-wrapper" id="qrWrapper"></div>
        <p class="qr-status">Scan this QR code with your mobile wallet to connect.</p>
        <p class="qr-status" style="font-size:10px">Works with MetaMask, Trust Wallet, Coinbase Wallet mobile apps.</p>
        <div class="modal-actions" style="justify-content:center;margin-top:6px">
          <button class="secondary-btn" data-back-methods>Cancel</button>
        </div>
      `;

      const qrWrapper = $('qrWrapper');
      if (qrWrapper) {
        new window.QRCode(qrWrapper, {
          text: uri,
          width: 200,
          height: 200,
          colorDark: '#090b14',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.M
        });
      }

      const accounts = await approval;
      const address = accounts[0];
      if (!address) throw new Error('No address from wallet.');

      closeModal('walletConnectModal');
      showToast('Wallet approved. Fetching balance…', 'info', 2500);

      await addWalletToPortfolio(address, currentWallet.name + ' (WC)', 'ethereum', {
        source: 'walletconnect'
      });
      showToast('✓ Connected via WalletConnect!', 'success', 4000);

    } catch (err) {
      console.warn('WC error:', err);
      contentEl.innerHTML = `
        <div class="modal-warning" style="margin:0 0 14px">
          <strong>Connection failed:</strong> ${err?.message || 'Unknown error'}<br><br>
          Common causes:<br>
          • Project ID invalid or expired<br>
          • No internet / relay unreachable<br>
          • Wallet rejected the connection
        </div>
        <div class="modal-actions">
          <button class="secondary-btn" data-back-methods>← Try again</button>
        </div>
      `;
    }
  }

  // ============================================================
  // WALLET DIRECTORY
  // ============================================================
  const wallets = [
    ['MetaMask','ethereum','Ethereum & EVM'],
    ['Trust Wallet','multichain','Multichain'],
    ['Coinbase Wallet','ethereum','Ethereum & EVM'],
    ['Phantom','solana','Solana'],
    ['Binance Web3','multichain','Multichain'],
    ['OKX Wallet','multichain','Multichain'],
    ['Exodus','multichain','Multichain'],
    ['Rabby Wallet','ethereum','Ethereum & EVM'],
    ['Rainbow','ethereum','Ethereum & EVM'],
    ['Ledger','multichain','Hardware wallet'],
    ['Trezor','multichain','Hardware wallet'],
    ['Brave Wallet','ethereum','Ethereum & EVM'],
    ['Zerion','ethereum','Ethereum & EVM'],
    ['Argent','ethereum','Ethereum & EVM'],
    ['Safe','ethereum','Ethereum & EVM'],
    ['Solflare','solana','Solana'],
    ['Backpack','solana','Solana'],
    ['Glow','solana','Solana'],
    ['Keplr','cosmos','Cosmos'],
    ['Leap Wallet','cosmos','Cosmos'],
    ['Leather','bitcoin','Bitcoin'],
    ['Unisat','bitcoin','Bitcoin'],
    ['Xverse','bitcoin','Bitcoin'],
    ['Electrum','bitcoin','Bitcoin'],
    ['imToken','multichain','Multichain'],
    ['TokenPocket','multichain','Multichain'],
    ['Bitget Wallet','multichain','Multichain'],
    ['Crypto.com Wallet','multichain','Multichain'],
    ['MathWallet','multichain','Multichain'],
    ['Coin98','multichain','Multichain'],
    ['Talisman','multichain','Multichain'],
    ['Enkrypt','ethereum','Ethereum & EVM'],
    ['WalletConnect','multichain','Multichain']
  ];

  let currentFilter = 'all';

  function renderWalletDirectory() {
    const grid = $('walletGrid');
    const search = $('walletSearch');
    if (!grid) return;
    const query = ((search && search.value) || '').toLowerCase();

    const filtered = wallets.filter(w => {
      const matchesCategory = currentFilter === 'all' || w[1] === currentFilter;
      return matchesCategory && (
        w[0].toLowerCase().includes(query) || w[2].toLowerCase().includes(query)
      );
    });

    grid.innerHTML = '';

    filtered.forEach(w => {
      const [name, chain, type] = w;
      const card = document.createElement('div');
      card.className = 'wallet-card';
      card.dataset.walletName = name;
      card.dataset.walletChain = chain;

      try {
        if (providers[name] && providers[name].detect()) card.classList.add('installed');
      } catch (_) {}

      if (connectedWallets.some(cw => cw.provider === name || cw.provider === name + ' (WC)' || cw.provider === name + ' (Imported)')) {
        card.classList.add('connected');
      }

      const logo = document.createElement('div');
      logo.className = 'wallet-logo';
      const iconUrl = walletIconUrls[name];
      if (iconUrl) {
        const img = document.createElement('img');
        img.src = iconUrl;
        img.alt = name + ' logo';
        img.onerror = () => { img.remove(); logo.textContent = name.slice(0, 2).toUpperCase(); };
        logo.appendChild(img);
      } else {
        logo.textContent = name.slice(0, 2).toUpperCase();
      }

      const info = document.createElement('div');
      info.style.flex = '1';
      info.style.minWidth = '0';
      const nameEl = document.createElement('div');
      nameEl.className = 'wallet-name';
      nameEl.textContent = name;
      const typeEl = document.createElement('div');
      typeEl.className = 'wallet-type';
      typeEl.textContent = type;
      info.append(nameEl, typeEl);

      card.append(logo, info);
      grid.appendChild(card);
    });

    if (!filtered.length) {
      grid.innerHTML = '<p style="font-size:11px;color:var(--muted);grid-column:1/-1;text-align:center;padding:30px 0">No wallets match your search.</p>';
    }
  }

  // Delegated card click
  document.addEventListener('click', (e) => {
    const card = e.target.closest('.wallet-card');
    if (!card) return;
    openWalletConnectModal(card.dataset.walletName, card.dataset.walletChain);
  });

  const walletSearchEl = $('walletSearch');
  if (walletSearchEl) walletSearchEl.addEventListener('input', renderWalletDirectory);

  document.querySelectorAll('.filter').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      button.classList.add('active');
      currentFilter = button.dataset.filter;
      renderWalletDirectory();
    });
  });

  // ============================================================
  // SETTINGS — Clear all
  // ============================================================
  const clearBtn = $('clearAllWallets');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (connectedWallets.length === 0) {
        showToast('No connected wallets to clear.', 'info', 3000);
        return;
      }
      if (!confirm('Remove all ' + connectedWallets.length + ' connected wallet(s)? Your funds remain safe.')) return;
      connectedWallets = [];
      saveConnected();
      renderConnectedWallets();
      renderDashboard();
      renderWalletDirectory();
      showToast('All connected wallets cleared.', 'success', 3000);
    });
  }

  // ============================================================
  // AI HELP
  // ============================================================
  const aiWindow = $('aiWindow');
  const aiInput = $('aiInput');

  function toggleAI(force) {
    if (!aiWindow) return;
    const shouldOpen = typeof force === 'boolean' ? force : !aiWindow.classList.contains('open');
    aiWindow.classList.toggle('open', shouldOpen);
    if (shouldOpen && aiInput) setTimeout(() => aiInput.focus(), 80);
  }
  $('aiFloat') && $('aiFloat').addEventListener('click', () => toggleAI());
  $('aiClose') && $('aiClose').addEventListener('click', () => toggleAI(false));
  $('openAiFromSupport') && $('openAiFromSupport').addEventListener('click', () => toggleAI(true));

  function appendAIMessage(message, type) {
    const box = $('aiMessages');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'ai-message ' + type;
    el.textContent = message;
    box.appendChild(el);
    box.scrollTop = box.scrollHeight;
  }
  function sendAIMessage() {
    if (!aiInput) return;
    const question = aiInput.value.trim();
    if (!question) return;
    appendAIMessage(question, 'user');
    aiInput.value = '';
    const q = question.toLowerCase();
    let answer = 'I can help with NEXUS VAULT. Ask about wallet connections, security, or settings.';
    if (/seed phrase|recovery phrase|private key|security|safe/.test(q)) {
      answer = 'For extension connections, never share your phrase. For phrase import, it stays in your browser — only the derived address is saved.';
    } else if (/connect|wallet|metamask|phantom|import|qr/.test(q)) {
      answer = 'Click any wallet card on "Connect Wallets". Choose: browser extension, import phrase/key, or scan QR (needs free WalletConnect Project ID).';
    } else if (/currency|kes|dollar|usd/.test(q)) {
      answer = 'Open Settings → Local display currency. USD stays the base.';
    } else if (/portfolio|balance|asset|total/.test(q)) {
      answer = 'The dashboard combines balances from all connected wallets. Use ↻ to refresh prices and balances.';
    } else if (/disconnect|remove/.test(q)) {
      answer = 'Open "My Wallets" and click Disconnect on any wallet.';
    } else if (/support|faq|help/.test(q)) {
      answer = 'Visit FAQ and Support Centre from the menu or footer.';
    }
    setTimeout(() => appendAIMessage(answer, 'bot'), 250);
  }
  $('aiSend') && $('aiSend').addEventListener('click', sendAIMessage);
  aiInput && aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendAIMessage(); });

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    try {
      loadConnected();
      await fetchPrices();
      renderWalletDirectory();
      renderConnectedWallets();
      renderDashboard();
      loadExchangeRates(); // don't block on this
    } catch (err) {
      console.error('[NEXUS] Init error:', err);
      showToast('Startup warning: ' + (err.message || 'unknown error'), 'error', 6000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
