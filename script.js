/* ============================================================
   NEXUS VAULT — Application Logic
   Real wallet connection + live balance tracking
   ============================================================ */

// ---------- DOM helpers ----------
const $ = id => document.getElementById(id);

// ============================================================
// NAVIGATION
// ============================================================
const drawer = $('drawer');
const overlay = $('overlay');

function openDrawer(){
  drawer.classList.add('active');
  overlay.classList.add('active');
}
function closeDrawer(){
  drawer.classList.remove('active');
  overlay.classList.remove('active');
}

$('brandMenu').onclick = openDrawer;
$('closeDrawer').onclick = closeDrawer;
overlay.onclick = closeDrawer;

function showPage(page){
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.drawer-link').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });

  closeDrawer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Delegate all [data-page] clicks
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-page]');
  if (!btn) return;
  e.preventDefault();
  showPage(btn.dataset.page);
});

$('settingsShortcut').onclick = () => showPage('settings');

// ============================================================
// THEME
// ============================================================
const themeSetting = $('themeSetting');

function applyTheme(theme){
  document.body.classList.toggle('light', theme === 'light');
  if (themeSetting) themeSetting.value = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#f4f6fb' : '#090b14');
  try { localStorage.setItem('nexus-theme', theme); } catch(e){}
}
applyTheme(localStorage.getItem('nexus-theme') || 'dark');

themeSetting.addEventListener('change', e => applyTheme(e.target.value));

// ============================================================
// CURRENCY & REGIONAL DETECTION
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
} catch(e){}

const currencySetting = $('currencySetting');
let localCurrency = localStorage.getItem('nexus-currency') || detectedCurrency;

if (![...currencySetting.options].some(o => o.value === localCurrency)){
  const opt = document.createElement('option');
  opt.value = localCurrency;
  opt.textContent = localCurrency;
  currencySetting.appendChild(opt);
}
currencySetting.value = localCurrency;

$('currencyDescription').textContent =
  'Detected from browser region: ' + detectedCurrency +
  '. Current display currency: ' + localCurrency + '.';

currencySetting.addEventListener('change', () => {
  localCurrency = currencySetting.value;
  try { localStorage.setItem('nexus-currency', localCurrency); } catch(e){}
  $('currencyLabel').textContent = localCurrency + ' · LOCAL DISPLAY';
  $('currencyDescription').textContent =
    'Your display currency is ' + localCurrency + '. USD remains the base currency.';
  updatePortfolioDisplay();
});

$('currencyLabel').textContent = localCurrency + ' · LOCAL DISPLAY';

// ============================================================
// EXCHANGE RATES (for display currency conversion)
// ============================================================
let exchangeRates = { USD: 1 };

async function loadExchangeRates(){
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error('Rate request failed');
    const data = await res.json();
    if (data.result === 'success'){
      exchangeRates = data.rates;
      updatePortfolioDisplay();
    }
  } catch(e){
    console.warn('Exchange rates unavailable. USD only.');
  }
}
loadExchangeRates();

// ============================================================
// TOASTS
// ============================================================
function showToast(message, type = 'info', duration = 4500){
  const container = $('toastContainer');
  if (!container) return;
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
// WALLET STATE
// ============================================================
// Structure: [{ address, provider, chain, balance, balanceUSD, symbol, connectedAt }]
let connectedWallets = [];
let prices = { ETH: 0, SOL: 0, BTC: 0 };
let pricesLastUpdated = 0;

function loadConnected(){
  try {
    const raw = localStorage.getItem('nexus-connected-wallets');
    if (raw){
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) connectedWallets = parsed;
    }
  } catch(e){
    connectedWallets = [];
  }
}
function saveConnected(){
  try { localStorage.setItem('nexus-connected-wallets', JSON.stringify(connectedWallets)); }
  catch(e){ console.warn('Could not save connected wallets', e); }
}

// ============================================================
// WALLET PROVIDERS (official browser APIs)
// ============================================================
const providers = {
  'MetaMask': {
    chain: 'ethereum',
    detect: () => typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask,
    connect: async () => {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return accounts[0];
    }
  },
  'Coinbase Wallet': {
    chain: 'ethereum',
    detect: () => typeof window.coinbaseWalletExtension !== 'undefined',
    connect: async () => {
      const accounts = await window.coinbaseWalletExtension.request({ method: 'eth_requestAccounts' });
      return accounts[0];
    }
  },
  'Brave Wallet': {
    chain: 'ethereum',
    detect: () => typeof window.ethereum !== 'undefined' && window.ethereum.isBraveWallet,
    connect: async () => {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return accounts[0];
    }
  },
  'Rabby Wallet': {
    chain: 'ethereum',
    detect: () => typeof window.ethereum !== 'undefined' && window.ethereum.isRabby,
    connect: async () => {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return accounts[0];
    }
  },
  'Phantom': {
    chain: 'solana',
    detect: () => typeof window.solana !== 'undefined' && window.solana.isPhantom,
    connect: async () => {
      const resp = await window.solana.connect();
      return resp.publicKey.toString();
    }
  },
  'Solflare': {
    chain: 'solana',
    detect: () => typeof window.solflare !== 'undefined',
    connect: async () => {
      const resp = await window.solflare.connect();
      return resp.publicKey.toString();
    }
  },
  'Backpack': {
    chain: 'solana',
    detect: () => typeof window.backpack !== 'undefined',
    connect: async () => {
      const resp = await window.backpack.connect();
      return resp.publicKey.toString();
    }
  },
  'Unisat': {
    chain: 'bitcoin',
    detect: () => typeof window.unisat !== 'undefined',
    connect: async () => {
      const accounts = await window.unisat.requestAccounts();
      return accounts[0];
    }
  }
};

// ============================================================
// BALANCE FETCHING
// ============================================================
const CHAIN_SYMBOL = { ethereum: 'ETH', solana: 'SOL', bitcoin: 'BTC' };

async function fetchEthBalance(address){
  // Try the user's provider first (avoids rate limits), then public RPC.
  if (window.ethereum){
    try {
      const hex = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      });
      return parseInt(hex, 16) / 1e18;
    } catch(_){ /* fall through */ }
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

async function fetchSolBalance(address){
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

async function fetchBtcBalance(address){
  const res = await fetch('https://blockstream.info/api/address/' + encodeURIComponent(address));
  if (!res.ok) throw new Error('Bitcoin balance request failed');
  const data = await res.json();
  const stats = data.chain_stats || {};
  const sats = (stats.funded_txo_sum || 0) - (stats.spent_txo_sum || 0);
  return sats / 1e8;
}

async function fetchBalance(chain, address){
  if (chain === 'ethereum') return fetchEthBalance(address);
  if (chain === 'solana')   return fetchSolBalance(address);
  if (chain === 'bitcoin')  return fetchBtcBalance(address);
  throw new Error('Unsupported chain: ' + chain);
}

// ============================================================
// PRICES (CoinGecko free tier)
// ============================================================
async function fetchPrices(){
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana,bitcoin&vs_currencies=usd'
    );
    if (!res.ok) throw new Error('Price fetch failed');
    const data = await res.json();
    prices.ETH = data.ethereum?.usd || 0;
    prices.SOL = data.solana?.usd || 0;
    prices.BTC = data.bitcoin?.usd || 0;
    pricesLastUpdated = Date.now();
    return true;
  } catch(e){
    console.warn('Price fetch failed:', e);
    return false;
  }
}

// ============================================================
// CONNECTION FLOW
// ============================================================
const inFlight = new Set();

async function connectWallet(walletName, chain){
  if (inFlight.has(walletName)) return;

  const provider = providers[walletName];

  // Case 1: Not integrated
  if (!provider){
    showToast(
      walletName + ' integration is not available yet in NEXUS VAULT. ' +
      'Currently supported: MetaMask, Coinbase Wallet, Brave Wallet, Rabby, ' +
      'Phantom, Solflare, Backpack and Unisat.',
      'info', 6000
    );
    return;
  }

  // Case 2: Provider not detected
  if (!provider.detect()){
    showToast(
      walletName + ' was not detected in this browser. ' +
      'Please install the official ' + walletName + ' extension or app, ' +
      'unlock it, then refresh this page.',
      'error', 6500
    );
    return;
  }

  // Show loading on card
  const card = document.querySelector('.wallet-card[data-wallet-name="' + CSS.escape(walletName) + '"]');
  inFlight.add(walletName);
  card?.classList.add('connecting');
  const spinner = document.createElement('div');
  spinner.className = 'spinner';
  card?.appendChild(spinner);

  try {
    showToast('Requesting connection to ' + walletName + '...', 'info', 3000);

    const address = await provider.connect();
    if (!address) throw new Error('No address returned by wallet.');

    // Check duplicates
    if (connectedWallets.some(w =>
      w.address.toLowerCase() === address.toLowerCase() &&
      w.chain === chain
    )){
      showToast('This wallet is already connected.', 'info', 3500);
      return;
    }

    showToast('Connected. Fetching balance...', 'info', 3000);

    // Fetch price if stale
    if (!pricesLastUpdated || Date.now() - pricesLastUpdated > 60_000){
      await fetchPrices();
    }

    const wallet = {
      address,
      provider: walletName,
      chain,
      balance: 0,
      balanceUSD: 0,
      symbol: CHAIN_SYMBOL[chain] || '',
      connectedAt: Date.now()
    };

    // Fetch balance (best effort)
    try {
      const bal = await fetchBalance(chain, address);
      wallet.balance = bal;
      wallet.balanceUSD = bal * (prices[wallet.symbol] || 0);
    } catch(e){
      console.warn('Balance fetch failed:', e);
      showToast('Connected, but could not fetch balance. You can refresh later.', 'info', 4500);
    }

    connectedWallets.push(wallet);
    saveConnected();

    renderConnectedWallets();
    renderDashboard();
    renderWalletDirectory();

    showToast('✓ ' + walletName + ' connected successfully!', 'success', 3500);

  } catch(err){
    console.warn('Connection error:', err);
    if (err?.code === 4001 || err?.code === 'ACTION_REJECTED'){
      showToast('Connection request was rejected in your wallet.', 'error', 4000);
    } else {
      showToast('Connection failed: ' + (err?.message || 'Unknown error'), 'error', 5000);
    }
  } finally {
    inFlight.delete(walletName);
    card?.classList.remove('connecting');
    spinner.remove();
  }
}

async function disconnectWallet(address, chain){
  const idx = connectedWallets.findIndex(w =>
    w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
  );
  if (idx === -1) return;
  const removed = connectedWallets.splice(idx, 1)[0];
  saveConnected();
  renderConnectedWallets();
  renderDashboard();
  renderWalletDirectory();
  showToast(removed.provider + ' disconnected.', 'success', 3000);
}

async function refreshAllBalances(){
  if (connectedWallets.length === 0){
    showToast('No wallets to refresh. Connect a wallet first.', 'info', 3500);
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
      } catch(e){
        console.warn('Refresh failed for ' + w.provider, e);
      }
    }));

    saveConnected();
    renderConnectedWallets();
    renderDashboard();
    showToast('✓ Balances refreshed.', 'success', 3000);
  } finally {
    buttons.forEach(b => b.classList.remove('loading'));
  }
}

// ============================================================
// FORMATTERS
// ============================================================
function formatMoney(value, currency){
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency,
      maximumFractionDigits: 2
    }).format(value);
  } catch(e){
    return currency + ' ' + value.toFixed(2);
  }
}

function shortenAddress(addr){
  if (!addr) return '';
  if (addr.length <= 16) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function chainLabel(chain){
  return ({ ethereum: 'ETH', solana: 'SOL', bitcoin: 'BTC', cosmos: 'ATOM' }[chain] || chain);
}

// ============================================================
// UPDATE PORTFOLIO TOTALS
// ============================================================
function updatePortfolioDisplay(){
  const totalUSD = connectedWallets.reduce((s, w) => s + (w.balanceUSD || 0), 0);
  const rate = exchangeRates[localCurrency];

  $('totalUSD').textContent = formatMoney(totalUSD, 'USD');
  $('totalLocal').textContent = rate
    ? '≈ ' + formatMoney(totalUSD * rate, localCurrency)
    : 'Local exchange rate unavailable';

  $('walletCount').textContent = connectedWallets.length;
  const uniqueChains = new Set(connectedWallets.map(w => w.chain));
  $('assetCount').textContent = uniqueChains.size;

  const foot = $('portfolioFoot');
  if (foot){
    if (connectedWallets.length === 0){
      foot.textContent = 'Combined value of connected wallets · No wallets connected';
    } else if (pricesLastUpdated){
      const when = new Date(pricesLastUpdated).toLocaleTimeString();
      foot.textContent = 'Live · Prices updated ' + when;
    } else {
      foot.textContent = 'Combined value of connected wallets';
    }
  }
}

// ============================================================
// RENDER: DASHBOARD PANELS
// ============================================================
function renderDashboard(){
  updatePortfolioDisplay();

  // ---- Connected wallets panel ----
  const emptyEl = $('walletEmpty');
  const summaryEl = $('walletSummary');

  if (connectedWallets.length === 0){
    emptyEl?.classList.remove('hidden');
    if (summaryEl) summaryEl.innerHTML = '';
  } else {
    emptyEl?.classList.add('hidden');
    if (summaryEl){
      summaryEl.innerHTML = connectedWallets.map(w => {
        const icon = walletIconUrls[w.provider];
        const logoInner = icon
          ? '<img src="' + icon + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' +
            w.provider.slice(0, 2).toUpperCase() + '\'))">'
          : w.provider.slice(0, 2).toUpperCase();
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

  // ---- Asset distribution panel ----
  const assetEmpty = $('assetEmpty');
  const assetList = $('assetList');

  if (connectedWallets.length === 0){
    assetEmpty?.classList.remove('hidden');
    if (assetList) assetList.innerHTML = '';
  } else {
    assetEmpty?.classList.add('hidden');
    // aggregate by chain
    const byChain = {};
    connectedWallets.forEach(w => {
      byChain[w.chain] = (byChain[w.chain] || 0) + (w.balanceUSD || 0);
    });
    const total = Object.values(byChain).reduce((a, b) => a + b, 0) || 1;
    const rows = Object.entries(byChain)
      .sort((a, b) => b[1] - a[1])
      .map(([chain, val]) => {
        const pct = ((val / total) * 100).toFixed(1);
        return `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
              <div style="display:flex;align-items:center;gap:10px">
                <span class="chain-badge ${chain}">${chainLabel(chain)}</span>
                <span class="asset-row-pct">${pct}%</span>
              </div>
              <span class="asset-row-value">${formatMoney(val, 'USD')}</span>
            </div>
            <div class="asset-bar"><div class="asset-bar-fill" style="width:${pct}%"></div></div>
          </div>
        `;
      }).join('');
    if (assetList) assetList.innerHTML = rows;
  }
}

// ============================================================
// RENDER: MY WALLETS PAGE
// ============================================================
function renderConnectedWallets(){
  const emptyEl = $('connectedEmpty');
  const listEl = $('connectedList');
  if (!emptyEl || !listEl) return;

  if (connectedWallets.length === 0){
    emptyEl.classList.remove('hidden');
    listEl.innerHTML = '';
    return;
  }

  emptyEl.classList.add('hidden');
  listEl.innerHTML = connectedWallets.map(w => {
    const icon = walletIconUrls[w.provider];
    const logoInner = icon
      ? '<img src="' + icon + '" alt="" onerror="this.replaceWith(document.createTextNode(\'' +
        w.provider.slice(0, 2).toUpperCase() + '\'))">'
      : w.provider.slice(0, 2).toUpperCase();
    return `
      <div class="connected-wallet-card">
        <div class="connected-wallet-head">
          <div class="wallet-logo">${logoInner}</div>
          <div class="connected-wallet-info">
            <div class="connected-wallet-title">
              <strong>${w.provider}</strong>
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
            Connected ${new Date(w.connectedAt).toLocaleDateString()}
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

// Event delegation for disconnect buttons
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-disconnect-address]');
  if (!btn) return;
  disconnectWallet(btn.dataset.disconnectAddress, btn.dataset.disconnectChain);
});

// ============================================================
// WALLET DIRECTORY (with real icons + click-to-connect)
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

// Real official logos — Simple Icons, theSVG, Iconify
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

const grid = $('walletGrid');
let currentFilter = 'all';

function renderWalletDirectory(){
  const query = ($('walletSearch').value || '').toLowerCase();

  const filtered = wallets.filter(w => {
    const matchesCategory = currentFilter === 'all' || w[1] === currentFilter;
    return matchesCategory && (
      w[0].toLowerCase().includes(query) ||
      w[2].toLowerCase().includes(query)
    );
  });

  grid.innerHTML = '';

  filtered.forEach(w => {
    const [name, chain, type] = w;
    const card = document.createElement('div');
    card.className = 'wallet-card';
    card.dataset.walletName = name;
    card.dataset.walletChain = chain;

    // Provider detected?
    if (providers[name] && providers[name].detect()){
      card.classList.add('installed');
    }

    // Already connected?
    if (connectedWallets.some(cw =>
      cw.provider === name
    )){
      card.classList.add('connected');
    }

    const logo = document.createElement('div');
    logo.className = 'wallet-logo';

    const iconUrl = walletIconUrls[name];
    if (iconUrl){
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = name + ' logo';
      img.onerror = () => {
        img.remove();
        logo.textContent = name.slice(0, 2).toUpperCase();
      };
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

  if (!filtered.length){
    grid.innerHTML = '<p style="font-size:11px;color:var(--muted);grid-column:1/-1;text-align:center;padding:30px 0">No wallets match your search.</p>';
  }
}

// Click to connect (event delegation)
grid.addEventListener('click', (e) => {
  const card = e.target.closest('.wallet-card');
  if (!card) return;
  connectWallet(card.dataset.walletName, card.dataset.walletChain);
});

$('walletSearch').addEventListener('input', renderWalletDirectory);

document.querySelectorAll('.filter').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    currentFilter = button.dataset.filter;
    renderWalletDirectory();
  });
});

// ============================================================
// SETTINGS ACTIONS
// ============================================================
$('clearAllWallets').addEventListener('click', () => {
  if (connectedWallets.length === 0){
    showToast('No connected wallets to clear.', 'info', 3000);
    return;
  }
  if (!confirm('Remove all ' + connectedWallets.length + ' connected wallet(s) from this browser? Your funds remain safe.')){
    return;
  }
  connectedWallets = [];
  saveConnected();
  renderConnectedWallets();
  renderDashboard();
  renderWalletDirectory();
  showToast('All connected wallets cleared.', 'success', 3000);
});

// ============================================================
// REFRESH BUTTONS
// ============================================================
$('refreshDashboard')?.addEventListener('click', refreshAllBalances);
$('refreshWallets')?.addEventListener('click', refreshAllBalances);

// ============================================================
// AI HELP LINE (front-end preview)
// ============================================================
const aiWindow = $('aiWindow');
const aiInput = $('aiInput');

function toggleAI(force){
  const shouldOpen = typeof force === 'boolean' ? force : !aiWindow.classList.contains('open');
  aiWindow.classList.toggle('open', shouldOpen);
  if (shouldOpen) setTimeout(() => aiInput.focus(), 80);
}
$('aiFloat').addEventListener('click', () => toggleAI());
$('aiClose').addEventListener('click', () => toggleAI(false));
$('openAiFromSupport')?.addEventListener('click', () => toggleAI(true));

function appendAIMessage(message, type){
  const el = document.createElement('div');
  el.className = 'ai-message ' + type;
  el.textContent = message;
  const box = $('aiMessages');
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function sendAIMessage(){
  const question = aiInput.value.trim();
  if (!question) return;
  appendAIMessage(question, 'user');
  aiInput.value = '';
  const q = question.toLowerCase();
  let answer = 'I can help with general NEXUS VAULT guidance. Ask me about wallet connections, security, portfolio tracking or currency settings.';
  if (/seed phrase|recovery phrase|private key|security|safe/.test(q)){
    answer = 'Never share your seed phrase, recovery phrase or private keys. A legitimate wallet connection uses the wallet provider\u2019s official approval screen. Review every request carefully.';
  } else if (/connect|wallet|metamask|phantom|solflare/.test(q)){
    answer = 'Open "Connect Wallets" from the menu. MetaMask, Coinbase Wallet, Brave Wallet, Rabby, Phantom, Solflare, Backpack and Unisat can be connected directly. Click any wallet card to begin.';
  } else if (/currency|kes|dollar|usd/.test(q)){
    answer = 'Open Settings to choose your display currency. USD remains the base currency, while your selected local currency is used to show equivalent values.';
  } else if (/portfolio|balance|asset|total/.test(q)){
    answer = 'Your dashboard combines balances from all connected wallets. Press the ↻ refresh button to re-fetch current prices and balances.';
  } else if (/disconnect|remove/.test(q)){
    answer = 'Open "My Wallets" and click Disconnect on any wallet. This removes it from NEXUS VAULT only — your funds remain in your wallet.';
  } else if (/support|faq|help/.test(q)){
    answer = 'You can visit the FAQ and Support Centre from the navigation menu or the footer of the website.';
  }
  setTimeout(() => appendAIMessage(answer, 'bot'), 250);
}
$('aiSend').addEventListener('click', sendAIMessage);
aiInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendAIMessage(); });

// ============================================================
// INIT
// ============================================================
async function init(){
  loadConnected();
  await fetchPrices();
  renderWalletDirectory();
  renderConnectedWallets();
  renderDashboard();
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
