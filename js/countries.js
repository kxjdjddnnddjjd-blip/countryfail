// Справочные данные по странам на 2026 год
window.META = (() => {
  const cur = {};
  const group = (code, list) => list.split(' ').forEach(c => (cur[c] = code));
  group('EUR', 'AT BE CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES HR AD MC SM VA ME XK BG');
  group('USD', 'US EC SV TL FM MH PW');
  group('XOF', 'BJ BF CI GW ML NE SN TG');
  group('XAF', 'CM CF TD CG GQ GA');
  group('XCD', 'AG DM GD KN LC VC');
  group('AUD', 'AU KI NR TV');
  group('CHF', 'CH LI');
  group('ILS', 'IL PS');
  ('AE:AED AF:AFN AL:ALL AM:AMD AO:AOA AR:ARS AZ:AZN BA:BAM BB:BBD BD:BDT BH:BHD BI:BIF BN:BND BO:BOB BR:BRL BS:BSD ' +
   'BT:BTN BW:BWP BY:BYN BZ:BZD CA:CAD CD:CDF CL:CLP CN:CNY CO:COP CR:CRC CU:CUP CV:CVE CZ:CZK DJ:DJF DK:DKK DO:DOP ' +
   'DZ:DZD EG:EGP ER:ERN ET:ETB FJ:FJD GB:GBP GE:GEL GH:GHS GM:GMD GN:GNF GT:GTQ GY:GYD HN:HNL HT:HTG HU:HUF ID:IDR ' +
   'IN:INR IQ:IQD IR:IRR IS:ISK JM:JMD JO:JOD JP:JPY KE:KES KG:KGS KH:KHR KM:KMF KP:KPW KR:KRW KW:KWD KZ:KZT LA:LAK ' +
   'LB:LBP LK:LKR LR:LRD LS:LSL LY:LYD MA:MAD MD:MDL MG:MGA MK:MKD MM:MMK MN:MNT MR:MRU MU:MUR MV:MVR MW:MWK MX:MXN ' +
   'MY:MYR MZ:MZN NA:NAD NG:NGN NI:NIO NO:NOK NP:NPR NZ:NZD OM:OMR PA:PAB PE:PEN PG:PGK PH:PHP PK:PKR PL:PLN PY:PYG ' +
   'QA:QAR RO:RON RS:RSD RU:RUB RW:RWF SA:SAR SB:SBD SC:SCR SD:SDG SE:SEK SG:SGD SL:SLE SO:SOS SR:SRD SS:SSP ST:STN ' +
   'SY:SYP SZ:SZL TH:THB TJ:TJS TM:TMT TN:TND TO:TOP TR:TRY TT:TTD TW:TWD TZ:TZS UA:UAH UG:UGX UY:UYU UZ:UZS VE:VES ' +
   'VN:VND VU:VUV WS:WST YE:YER ZA:ZAR ZM:ZMW ZW:ZWG')
    .split(' ').forEach(s => { const [c, k] = s.split(':'); cur[c] = k; });

  let dn = null;
  try { dn = new Intl.DisplayNames(['ru'], { type: 'currency' }); } catch (e) {}
  const RU_FALLBACK = { ZWG: 'зимбабвийский золотой', SLE: 'леоне', VES: 'венесуэльский боливар', MRU: 'мавританская угия', STN: 'добра' };
  function currencyName(code) {
    if (RU_FALLBACK[code]) return RU_FALLBACK[code];
    try { const n = dn && dn.of(code); if (n && n !== code) return n; } catch (e) {}
    return code;
  }

  // Действующие лидеры (по состоянию на 2026 год)
  const leaders = {
    RU: 'Владимир Путин', US: 'Дональд Трамп', CN: 'Си Цзиньпин', UA: 'Владимир Зеленский', BY: 'Александр Лукашенко',
    KZ: 'Касым-Жомарт Токаев', DE: 'Фридрих Мерц', FR: 'Эмманюэль Макрон', GB: 'Кир Стармер', IT: 'Джорджа Мелони',
    ES: 'Педро Санчес', PL: 'Кароль Навроцкий', TR: 'Реджеп Тайип Эрдоган', JP: 'Санаэ Такаити', IN: 'Нарендра Моди',
    BR: 'Лула да Силва', CA: 'Марк Карни', AU: 'Энтони Албаниз', KR: 'Ли Джэ Мён', KP: 'Ким Чен Ын',
    IR: 'Масуд Пезешкиан', IL: 'Биньямин Нетаньяху', SA: 'Мухаммед ибн Сальман', EG: 'Абдул-Фаттах ас-Сиси',
    AR: 'Хавьер Милей', MX: 'Клаудия Шейнбаум', UZ: 'Шавкат Мирзиёев', AZ: 'Ильхам Алиев', AM: 'Никол Пашинян',
    GE: 'Михаил Кавелашвили', MD: 'Майя Санду', RS: 'Александр Вучич', PK: 'Шахбаз Шариф', ZA: 'Сирил Рамафоса',
    NG: 'Бола Тинубу', ID: 'Прабово Субианто', SY: 'Ахмед аш-Шараа', VE: 'Делси Родригес', CU: 'Мигель Диас-Канель',
    TJ: 'Эмомали Рахмон', KG: 'Садыр Жапаров', TM: 'Сердар Бердымухамедов', AF: 'Хайбатулла Ахундзада',
    PH: 'Фердинанд Маркос', SE: 'Ульф Кристерссон', NO: 'Йонас Гар Стёре', FI: 'Александр Стубб', CZ: 'Андрей Бабиш',
    SK: 'Роберт Фицо', RO: 'Никушор Дан', GR: 'Кириакос Мицотакис', BE: 'Барт де Вевер', DK: 'Метте Фредериксен',
    CL: 'Хосе Антонио Каст', QA: 'Тамим бин Хамад Аль Тани', AE: 'Мухаммед бин Заид', JO: 'Абдалла II',
    MA: 'Мухаммед VI', ET: 'Абий Ахмед', VA: 'Папа Лев XIV', TW: 'Лай Цинде', BD: 'Тарик Рахман',
  };

  // Множитель военной мощи (мобилизация, ядерное оружие, опыт)
  const military = {
    RU: 3.0, US: 1.7, CN: 1.4, IN: 1.3, KP: 6, IL: 2.6, UA: 2.4, IR: 2.0, TR: 1.7, PK: 2.2, KR: 1.4, FR: 1.3, GB: 1.3,
    EG: 1.6, SA: 1.3, PL: 1.5, VN: 1.6, BY: 1.6, AZ: 1.6, AM: 1.3, SY: 1.2, ET: 1.3, CU: 1.5, ER: 2.0, SG: 1.2, GR: 1.2,
    DE: 1.0, JP: 1.0, TW: 1.4, DZ: 1.4, MA: 1.2, CH: 0.6, IE: 0.5, AT: 0.6, LU: 0.4, IS: 0.2, CR: 0.2, PA: 0.3, VA: 0.05,
  };

  const NAMES = {
    slav: { f: ['Александр', 'Дмитрий', 'Сергей', 'Андрей', 'Игорь', 'Михаил', 'Николай', 'Олег', 'Виктор', 'Анна', 'Елена', 'Ольга'],
            l: ['Соколов', 'Морозов', 'Волков', 'Лебедев', 'Новиков', 'Ковальчук', 'Петренко', 'Орлов', 'Белов', 'Захаров'] },
    west: { f: ['Джон', 'Марк', 'Томас', 'Пьер', 'Лукас', 'Ханс', 'Карлос', 'Эмма', 'София', 'Анна-Лена', 'Оливер', 'Габриэль'],
            l: ['Миллер', 'Шмидт', 'Дюбуа', 'Росси', 'Гарсия', 'Ван дер Берг', 'Андерсон', 'Мартен', 'Кляйн', 'Новак'] },
    arab: { f: ['Ахмед', 'Мухаммед', 'Омар', 'Халид', 'Юсеф', 'Али', 'Хасан', 'Самир', 'Лейла', 'Фатима'],
            l: ['аль-Махди', 'Хаддад', 'ибн Рашид', 'аль-Хашими', 'Насралла', 'Мансур', 'аль-Амин', 'Сулейман'] },
    asia: { f: ['Ли', 'Ван', 'Чжан', 'Кэндзи', 'Хироси', 'Мин Джун', 'Арджун', 'Рахул', 'Нгуен', 'Сомчай', 'Айко', 'Прия'],
            l: ['Вэй', 'Мин', 'Танака', 'Сато', 'Пак', 'Шарма', 'Сингх', 'Ван Ань', 'Чен', 'Капур'] },
    afr: { f: ['Кофи', 'Амаду', 'Ибрагим', 'Джозеф', 'Самуэль', 'Нельсон', 'Аиша', 'Грейс', 'Мусса', 'Уильям'],
           l: ['Окафор', 'Диалло', 'Мбеки', 'Траоре', 'Кенийатта', 'Нкрума', 'Бангура', 'Камара', 'Мутаи', 'Банда'] },
    lat: { f: ['Хуан', 'Луис', 'Мигель', 'Диего', 'Габриэла', 'Мария', 'Рафаэль', 'Хосе', 'Пабло', 'Валентина'],
           l: ['Гонсалес', 'Родригес', 'Перес', 'Санчес', 'Рамирес', 'Флорес', 'Гомес', 'да Силва', 'Морено', 'Варгас'] },
  };
  const SLAV = 'RU UA BY PL CZ SK RS HR BA SI MK ME BG KZ KG UZ TJ TM AM AZ GE MD XK';
  const ARAB = 'SA AE QA KW BH OM YE IQ SY JO LB PS EG LY TN DZ MA SD MR DJ SO IR AF PK TR';
  function nameStyle(iso, cont) {
    if (SLAV.includes(iso)) return 'slav';
    if (ARAB.includes(iso)) return 'arab';
    if (cont === 'Asia' || cont === 'Oceania') return 'asia';
    if (cont === 'Africa') return 'afr';
    if (cont === 'South America' || 'MX GT HN SV NI CR PA CU DO'.includes(iso)) return 'lat';
    return 'west';
  }
  function randomLeader(iso, cont) {
    const s = NAMES[nameStyle(iso, cont)];
    const r = a => a[Math.floor(Math.random() * a.length)];
    return r(s.f) + ' ' + r(s.l);
  }

  // Военные союзы на 2026 год (оборонительные: если на члена напали — остальные вступают)
  const alliances = [
    { name: 'НАТО', members: 'AL BE BG CA HR CZ DK EE FI FR DE GR HU IS IT LV LT LU ME NL MK NO PL PT RO SK SI ES SE TR GB US' },
    { name: 'ОДКБ', members: 'RU BY KZ KG TJ' },
    { name: 'Договор РФ–КНДР', members: 'RU KP' },
    { name: 'Договор КНР–КНДР', members: 'CN KP' },
    { name: 'Договор США–Япония', members: 'US JP' },
    { name: 'Договор США–Корея', members: 'US KR' },
    { name: 'АНЗЮС', members: 'US AU NZ' },
    { name: 'Договор США–Филиппины', members: 'US PH' },
    { name: 'Альянс государств Сахеля', members: 'ML BF NE' },
  ].map(a => ({ name: a.name, members: a.members.split(' ') }));
  const rivals = [['НАТО', 'ОДКБ'], ['НАТО', 'Договор РФ–КНДР'], ['Договор США–Корея', 'Договор КНР–КНДР'], ['Договор США–Корея', 'Договор РФ–КНДР']];
  // Военная помощь (без прямого участия в войне)
  const aid = {
    UA: alliances[0].members.concat(['AU', 'JP', 'KR', 'NZ']).filter(c => c !== 'HU' && c !== 'TR' && c !== 'SK'),
    RU: ['KP', 'IR', 'BY'],
  };
  // Горячие точки — здесь ИИ иногда начинает войны
  const tensions = [['IN', 'PK'], ['PK', 'IN'], ['AZ', 'AM'], ['IL', 'IR'], ['CN', 'TW'], ['KP', 'KR'], ['VE', 'GY'], ['ET', 'ER'],
    ['SD', 'SS'], ['RS', 'XK'], ['MA', 'DZ'], ['SA', 'YE'], ['TH', 'KH'], ['RW', 'CD'], ['EG', 'ET'], ['TR', 'SY'], ['IL', 'LB'],
    ['AF', 'PK'], ['KG', 'TJ'], ['CN', 'IN'], ['ML', 'DZ'], ['SO', 'ET']];

  // Дружественные пары — не воюют друг с другом без причины
  const friends = [['RU', 'CN'], ['RU', 'IN'], ['RU', 'IR'], ['RU', 'BY'], ['RU', 'KP'], ['CN', 'PK'], ['CN', 'KP'], ['US', 'IL'],
    ['US', 'GB'], ['US', 'CA'], ['US', 'JP'], ['US', 'KR'], ['US', 'AU'], ['IN', 'IL'], ['TR', 'AZ'], ['SA', 'AE'], ['EG', 'SA'],
    ['RU', 'KZ'], ['CN', 'RU'], ['IN', 'US'], ['FR', 'DE'], ['RU', 'SY'], ['RU', 'VE'], ['RU', 'CU'], ['CN', 'IR']];

  return { currency: cur, currencyName, leaders, military, randomLeader, alliances, rivals, aid, tensions, friends };
})();
