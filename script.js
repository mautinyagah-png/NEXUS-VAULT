// NAVIGATION

const drawer=document.getElementById('drawer');
const overlay=document.getElementById('overlay');

function openDrawer(){
  drawer.classList.add('active');
  overlay.classList.add('active');
}
function closeDrawer(){
  drawer.classList.remove('active');
  overlay.classList.remove('active');
}

document.getElementById('brandMenu').onclick=openDrawer;
document.getElementById('closeDrawer').onclick=closeDrawer;
overlay.onclick=closeDrawer;

function showPage(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById(page)?.classList.add('active');

  document.querySelectorAll('.drawer-link').forEach(b=>{
    b.classList.toggle('active',b.dataset.page===page);
  });

  closeDrawer();
  window.scrollTo({top:0,behavior:'smooth'});
}

document.querySelectorAll('[data-page]').forEach(btn=>{
  btn.addEventListener('click',()=>showPage(btn.dataset.page));
});
document.getElementById('settingsShortcut').onclick=()=>showPage('settings');

// THEME - ALL COMPONENTS USE CSS VARIABLES

const themeSetting=document.getElementById('themeSetting');

function applyTheme(theme){
  document.body.classList.toggle('light',theme==='light');
  themeSetting.value=theme;
  document.querySelector('meta[name="theme-color"]')
    .setAttribute('content',theme==='light'?'#f4f6fb':'#090b14');
  localStorage.setItem('nexus-theme',theme);
}
applyTheme(localStorage.getItem('nexus-theme')||'dark');

themeSetting.addEventListener('change',e=>applyTheme(e.target.value));

// CURRENCY REGION DETECTION

const regionCurrencies={
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

let detectedCurrency='USD';
try{
  const locale=new Intl.Locale(navigator.language);
  detectedCurrency=regionCurrencies[locale.region]||'USD';
}catch(e){}

const currencySetting=document.getElementById('currencySetting');
let localCurrency=localStorage.getItem('nexus-currency')||detectedCurrency;

if(![...currencySetting.options].some(o=>o.value===localCurrency)){
  const option=document.createElement('option');
  option.value=localCurrency;
  option.textContent=localCurrency;
  currencySetting.appendChild(option);
}
currencySetting.value=localCurrency;

document.getElementById('currencyDescription').textContent=
  'Detected from browser region: '+detectedCurrency+
  '. Current display currency: '+localCurrency+'.';

currencySetting.addEventListener('change',()=>{
  localCurrency=currencySetting.value;
  localStorage.setItem('nexus-currency',localCurrency);
  document.getElementById('currencyLabel').textContent=
    localCurrency+' · LOCAL DISPLAY';
  document.getElementById('currencyDescription').textContent=
    'Your display currency is '+localCurrency+'. USD remains the base currency.';
  updatePortfolioDisplay();
});

document.getElementById('currencyLabel').textContent=
  localCurrency+' · LOCAL DISPLAY';

// EXCHANGE RATE SOURCE

let exchangeRates={USD:1};

async function loadExchangeRates(){
  try{
    const response=await fetch('https://open.er-api.com/v6/latest/USD');
    if(!response.ok)throw new Error('Exchange rate request failed');
    const data=await response.json();
    if(data.result==='success'){
      exchangeRates=data.rates;
      updatePortfolioDisplay();
    }
  }catch(error){
    console.warn('Exchange rates unavailable. USD remains available.');
  }
}

function formatMoney(value,currency){
  try{
    return new Intl.NumberFormat(undefined,{
      style:'currency',currency:currency,
      maximumFractionDigits:2
    }).format(value);
  }catch(e){
    return currency+' '+value.toFixed(2);
  }
}

function updatePortfolioDisplay(){
  // Portfolio stays at zero until genuine wallet data is integrated.
  const totalUSD=0;
  const rate=exchangeRates[localCurrency];
  document.getElementById('totalUSD').textContent=
    formatMoney(totalUSD,'USD');

  document.getElementById('totalLocal').textContent=
    rate?formatMoney(totalUSD*rate,localCurrency):
    'Local exchange rate unavailable';
}

loadExchangeRates();

// AI HELP LINE (front-end preview; no external AI service connected yet)
const aiWindow=document.getElementById('aiWindow');
const aiInput=document.getElementById('aiInput');
function toggleAI(force){
  const shouldOpen=typeof force==='boolean'?force:!aiWindow.classList.contains('open');
  aiWindow.classList.toggle('open',shouldOpen);
  if(shouldOpen)setTimeout(()=>aiInput.focus(),80);
}
document.getElementById('aiFloat').addEventListener('click',()=>toggleAI());
document.getElementById('aiClose').addEventListener('click',()=>toggleAI(false));
document.getElementById('openAiFromSupport')?.addEventListener('click',()=>toggleAI(true));

function appendAIMessage(message,type){
  const el=document.createElement('div');
  el.className='ai-message '+type;
  el.textContent=message;
  const box=document.getElementById('aiMessages');
  box.appendChild(el);
  box.scrollTop=box.scrollHeight;
}
function sendAIMessage(){
  const question=aiInput.value.trim();
  if(!question)return;
  appendAIMessage(question,'user');
  aiInput.value='';
  const q=question.toLowerCase();
  let answer='I can help with general NEXUS VAULT guidance. Ask me about wallet connections, security, portfolio tracking or currency settings. This preview assistant is not connected to a live AI model yet.';
  if(/seed phrase|recovery phrase|private key|security|safe/.test(q)){
    answer='Never share your seed phrase, recovery phrase or private keys. A legitimate wallet connection should use the wallet provider’s official approval screen. Review every request carefully and never approve an unfamiliar transaction.';
  }else if(/wallet|connect/.test(q)){
    answer='Open Connect Wallets from the menu to browse providers. The directory is currently a preview; secure connections through official wallet protocols are the next development stage.';
  }else if(/currency|kes|dollar|usd/.test(q)){
    answer='Open Settings to choose your display currency. USD remains the base currency, while your selected local currency is used to show equivalent values.';
  }else if(/portfolio|balance|asset/.test(q)){
    answer='The dashboard is designed to combine balances from connected wallets. Real balances and token prices will be displayed after blockchain data integrations are implemented.';
  }else if(/support|faq|help/.test(q)){
    answer='You can visit the FAQ and Support Centre from the navigation menu or the footer of the website.';
  }
  setTimeout(()=>appendAIMessage(answer,'bot'),250);
}
document.getElementById('aiSend').addEventListener('click',sendAIMessage);
aiInput.addEventListener('keydown',e=>{if(e.key==='Enter')sendAIMessage()});


// WALLET DIRECTORY

const wallets=[
  ['MetaMask','ethereum','metamask','Ethereum & EVM'],
  ['Trust Wallet','multichain','trustwallet','Multichain'],
  ['Coinbase Wallet','multichain','coinbase','Multichain'],
  ['Phantom','solana','phantom','Solana'],
  ['Binance Web3','multichain','binance','Multichain'],
  ['OKX Wallet','multichain','okx','Multichain'],
  ['Exodus','multichain','exodus','Multichain'],
  ['Rabby Wallet','ethereum','rabby','Ethereum & EVM'],
  ['Rainbow','ethereum','rainbow','Ethereum & EVM'],
  ['Ledger','multichain','ledger','Hardware wallet'],
  ['Trezor','multichain','trezor','Hardware wallet'],
  ['Brave Wallet','ethereum','brave','Ethereum & EVM'],
  ['Zerion','ethereum','zerion','Ethereum & EVM'],
  ['Argent','ethereum','argent','Ethereum & EVM'],
  ['Safe','ethereum','safe','Ethereum & EVM'],
  ['Solflare','solana','solflare','Solana'],
  ['Backpack','solana','backpack','Solana'],
  ['Glow','solana','glow','Solana'],
  ['Keplr','cosmos','keplr','Cosmos'],
  ['Leap Wallet','cosmos','leapwallet','Cosmos'],
  ['Leather','bitcoin','leather','Bitcoin'],
  ['Unisat','bitcoin','unisat','Bitcoin'],
  ['Xverse','bitcoin','xverse','Bitcoin'],
  ['Electrum','bitcoin','electrum','Bitcoin'],
  ['imToken','multichain','imtoken','Multichain'],
  ['TokenPocket','multichain','tokenpocket','Multichain'],
  ['Bitget Wallet','multichain','bitget','Multichain'],
  ['Crypto.com Wallet','multichain','cryptocom','Multichain'],
  ['MathWallet','multichain','mathwallet','Multichain'],
  ['Coin98','multichain','coin98','Multichain'],
  ['Talisman','multichain','talisman','Multichain'],
  ['Enkrypt','ethereum','enkrypt','Ethereum & EVM'],
  ['WalletConnect','multichain','walletconnect','Multichain']
];

// Map each wallet to a reliable icon URL (official logos)
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

const grid=document.getElementById('walletGrid');
let currentFilter='all';

function renderWallets(){
  const query=document.getElementById('walletSearch').value.toLowerCase();

  const filtered=wallets.filter(w=>{
    const matchesCategory=currentFilter==='all'||w[1]===currentFilter;
    return matchesCategory&&
      (w[0].toLowerCase().includes(query)||w[3].toLowerCase().includes(query));
  });

  grid.innerHTML='';

  filtered.forEach(w=>{
    const card=document.createElement('div');
    card.className='wallet-card';

    const logo=document.createElement('div');
    logo.className='wallet-logo';

    const iconUrl = walletIconUrls[w[0]];

    if(iconUrl){
      const img=document.createElement('img');
      img.src=iconUrl;
      img.alt=w[0]+' logo';
      img.onerror=()=>{
        img.remove();
        logo.textContent=w[0].slice(0,2).toUpperCase();
      };
      logo.appendChild(img);
    }else{
      logo.textContent=w[0].slice(0,2).toUpperCase();
    }

    const info=document.createElement('div');
    const name=document.createElement('div');
    name.className='wallet-name';
    name.textContent=w[0];

    const type=document.createElement('div');
    type.className='wallet-type';
    type.textContent=w[3];

    info.append(name,type);
    card.append(logo,info);
    grid.appendChild(card);
  });

  if(!filtered.length){
    grid.textContent='No wallets match your search.';
  }
}

renderWallets();

document.getElementById('walletSearch')
  .addEventListener('input',renderWallets);

document.querySelectorAll('.filter').forEach(button=>{
  button.addEventListener('click',()=>{
    document.querySelectorAll('.filter').forEach(b=>b.classList.remove('active'));
    button.classList.add('active');
    currentFilter=button.dataset.filter;
    renderWallets();
  });
});
